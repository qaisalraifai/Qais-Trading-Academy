// محرك عمولة المطابقة Matching Bonus (الفصل 5 و25 من الخطة)
// شهري — بيشتغل من cron مرة بأول كل شهر (انظر app/api/cron/route.js).
// نسبة المطابقة بتيجي من عمود matching_percent بجدول ranks (حسب رتبة الراعي).

import { insertCommissionAndPay } from "@/lib/commission-payout";

export async function runMonthlyMatchingBonus(supabaseAdmin) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: sponsors } = await supabaseAdmin
    .from("profiles")
    .select("id, is_active_member, ranks:rank_id (matching_percent)")
    .not("rank_id", "is", null);

  let paidCount = 0;

  for (const sponsor of sponsors || []) {
    const percent = Number(sponsor.ranks?.matching_percent || 0);
    // الفصل 8: عضو غير نشط يتوقف استحقاقه لـ Matching
    if (percent <= 0 || !sponsor.is_active_member) continue;

    const { data: downlineIds } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("sponsor_id", sponsor.id);

    const ids = (downlineIds || []).map((d) => d.id);
    if (ids.length === 0) continue;

    const { data: earnings } = await supabaseAdmin
      .from("mlm_commissions")
      .select("amount")
      .in("beneficiary_id", ids)
      .eq("status", "approved")
      .gte("created_at", monthStart);

    const totalEarned = (earnings || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    if (totalEarned <= 0) continue;

    const amount = Math.round(((totalEarned * percent) / 100) * 100) / 100;
    if (amount <= 0) continue;

    await insertCommissionAndPay(supabaseAdmin, {
      beneficiaryId: sponsor.id,
      bonusType: "matching",
      amount,
      notifyMessage: `حصلت على ${amount} دينار عمولة مطابقة (Matching Bonus) لهذا الشهر`,
    });
    paidCount += 1;
  }

  return { paidCount };
}
