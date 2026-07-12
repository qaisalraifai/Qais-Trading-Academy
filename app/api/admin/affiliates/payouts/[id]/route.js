import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

// PATCH /api/admin/affiliates/payouts/[id]  { action: "mark_paid" | "mark_failed", reference?: string }
// التحويل الفعلي بيصير يدوي (برا النظام) حالياً — هون بس بنسجل إنه انحوّل ونقفل العمولات المرتبطة.
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const { action, reference } = await request.json();

  if (!["mark_paid", "mark_failed"].includes(action)) {
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: payout } = await supabase.from("payouts").select("*").eq("id", id).maybeSingle();
  if (!payout) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  if (action === "mark_paid") {
    const { error } = await supabase
      .from("payouts")
      .update({ status: "paid", paid_at: new Date().toISOString(), reference: reference || null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("commissions").update({ status: "paid" }).eq("payout_id", id);
    await logActivity(payout.affiliate_id, "note", `تم صرف عمولة بقيمة $${payout.amount}`, { payoutId: id, reference });
  } else {
    const { error } = await supabase.from("payouts").update({ status: "failed" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // نرجّع العمولات لحالة pending حتى تنضم لدفعة الصرف الجاية
    await supabase.from("commissions").update({ status: "pending", payout_id: null }).eq("payout_id", id);
  }

  return NextResponse.json({ success: true });
}
