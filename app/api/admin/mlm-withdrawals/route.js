import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { creditWallet } from "@/lib/wallets";

// GET: لائحة طلبات السحب (فلترة اختيارية status=pending)
export async function GET(request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin
    .from("mlm_withdrawals")
    .select("*, profiles:user_id (username)")
    .order("requested_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: withdrawals, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ withdrawals });
}

// POST: يوافق أو يرفض طلب سحب — { withdrawalId, action: "approve" | "reject", note }
export async function POST(request) {
  const { user, error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { withdrawalId, action, note } = await request.json();
  if (!withdrawalId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: withdrawal, error: fetchError } = await supabaseAdmin
    .from("mlm_withdrawals")
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "طلب السحب غير موجود" }, { status: 404 });
  }
  if (withdrawal.status !== "pending") {
    return NextResponse.json({ error: "تمت معالجة هذا الطلب مسبقًا" }, { status: 400 });
  }

  if (action === "reject") {
    // نرجّع المبلغ لمحفظة السحب لأنه كان اتخصم فورًا وقت الطلب
    await creditWallet(supabaseAdmin, withdrawal.user_id, "withdrawal", Number(withdrawal.amount), "withdrawal_rejected_refund", withdrawal.id);
  }

  const newStatus = action === "approve" ? "paid" : "rejected";

  await supabaseAdmin
    .from("mlm_withdrawals")
    .update({
      status: newStatus,
      admin_note: note || null,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", withdrawalId);

  // الفصل 53: سجل تدقيق كامل — من وافق/رفض ومتى ولإيش
  await supabaseAdmin.from("audit_log").insert({
    actor_admin_id: user.id,
    target_user_id: withdrawal.user_id,
    action: action === "approve" ? "withdrawal_approved" : "withdrawal_rejected",
    details: { withdrawalId, amount: withdrawal.amount, note: note || null },
  });

  return NextResponse.json({ success: true });
}
