import { NextResponse } from "next/server";
import { requireAdmin, requireAdminRole } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const BUCKET = "kyc-documents";

// GET: لائحة طلبات KYC المعلّقة (أو بأي حالة عبر ?status=)
export async function GET(request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "pending";

  const supabaseAdmin = createAdminClient();
  const { data: profiles, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("id, username, kyc_status, kyc_document_url, is_flagged_suspicious, flagged_reason")
    .eq("kyc_status", statusFilter);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  // نولّد رابط مؤقت (Signed URL) لكل مستند حتى الأدمن يقدر يشوفه (البكت خاص/private)
  const withUrls = await Promise.all(
    (profiles || []).map(async (p) => {
      if (!p.kyc_document_url) return { ...p, documentSignedUrl: null };
      const { data } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(p.kyc_document_url, 60 * 10); // صالح 10 دقائق
      return { ...p, documentSignedUrl: data?.signedUrl || null };
    })
  );

  return NextResponse.json({ profiles: withUrls });
}

// POST: يوافق/يرفض — { userId, action: "verify" | "reject", note }
export async function POST(request) {
  const { user, error, status } = await requireAdminRole(["compliance_manager"]);
  if (error) return NextResponse.json({ error }, { status });

  const { userId, action, note } = await request.json();
  if (!userId || !["verify", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const newStatus = action === "verify" ? "verified" : "rejected";

  await supabaseAdmin.from("profiles").update({ kyc_status: newStatus }).eq("id", userId);

  await supabaseAdmin.from("audit_log").insert({
    actor_admin_id: user.id,
    target_user_id: userId,
    action: action === "verify" ? "kyc_verified" : "kyc_rejected",
    details: { note: note || null },
  });

  return NextResponse.json({ success: true });
}
