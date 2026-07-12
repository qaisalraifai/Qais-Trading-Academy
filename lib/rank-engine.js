// محرك الرتب Rank Engine (الفصل 6-7 و36 من الخطة)
// بيتفحص بعد كل تحديث CV (يُستدعى من compensation-engine.js) — لو العضو
// استوفى شروط رتبة أعلى، بيرقّيه فورًا (وممكن يقفز أكثر من رتبة دفعة وحدة
// لو استوفى الشروط)، وبيدفعله مكافأة الرتبة مرة وحدة لكل رتبة يوصلها.

import { insertCommissionAndPay } from "@/lib/commission-payout";

export async function checkAndPromoteRank(supabaseAdmin, userId) {
  const { data: member, error } = await supabaseAdmin
    .from("profiles")
    .select("id, rank_id, cv_left, cv_right")
    .eq("id", userId)
    .maybeSingle();

  if (error || !member) return;

  const { count: directCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("sponsor_id", userId);

  const totalTeamCv = Number(member.cv_left || 0) + Number(member.cv_right || 0);

  const { data: ranks } = await supabaseAdmin
    .from("ranks")
    .select("*")
    .order("level_order", { ascending: true });

  if (!ranks || ranks.length === 0) return;

  const currentRank = ranks.find((r) => r.id === member.rank_id);
  const currentLevel = currentRank?.level_order || 0;

  // نلاقي أعلى رتبة يستوفي شروطها العضو (ممكن تكون أكثر من رتبة فوق رتبته الحالية)
  let targetRank = null;
  for (const rank of ranks) {
    if (
      rank.level_order > currentLevel &&
      (directCount || 0) >= rank.min_direct_members &&
      totalTeamCv >= rank.min_total_cv
    ) {
      targetRank = rank; // بضل يكمّل التكرار حتى يوصل لأعلى رتبة مستحقة
    }
  }

  if (!targetRank) return;

  // كل الرتب المتوسطة بين رتبته الحالية والرتبة الجديدة — بتستحق مكافآتها كمان
  const skippedRanks = ranks.filter(
    (r) => r.level_order > currentLevel && r.level_order <= targetRank.level_order
  );

  await supabaseAdmin.from("profiles").update({ rank_id: targetRank.id }).eq("id", userId);

  for (const rank of skippedRanks) {
    if (rank.bonus_amount > 0) {
      await insertCommissionAndPay(supabaseAdmin, {
        beneficiaryId: userId,
        bonusType: "rank",
        amount: rank.bonus_amount,
        notifyMessage: `🎉 مبروك! ترقيت لرتبة ${rank.name_ar} وحصلت على ${rank.bonus_amount} دينار`,
      });
    }
  }
}
