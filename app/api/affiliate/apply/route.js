import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { generateAffiliateCode } from "@/lib/referral-commissions";
import { logActivity } from "@/lib/activity-log";

// POST /api/affiliate/apply — الطالب يطلب ينضم لبرنامج التسويق بالعمولة
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, affiliate_status, affiliate_code")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "الملف الشخصي غير موجود" }, { status: 400 });
  }

  if (profile.affiliate_status === "pending") {
    return NextResponse.json({ error: "طلبك قيد المراجعة أصلاً" }, { status: 400 });
  }
  if (profile.affiliate_status === "approved") {
    return NextResponse.json({ error: "أنت مسوّق مفعّل أصلاً" }, { status: 400 });
  }

  // نولّد كود مسوّق فريد لو ما عنده، ونتأكد إنه مش مكرر
  let code = profile.affiliate_code;
  if (!code) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateAffiliateCode(profile.username);
      const { data: clash } = await admin
        .from("profiles")
        .select("id")
        .eq("affiliate_code", candidate)
        .maybeSingle();
      if (!clash) {
        code = candidate;
        break;
      }
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      affiliate_status: "pending",
      affiliate_code: code,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(user.id, "note", "طلب انضمام لبرنامج التسويق بالعمولة");

  return NextResponse.json({ success: true, status: "pending" });
}
