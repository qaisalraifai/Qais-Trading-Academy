// محرك Infinity Bonus (الفصل 5 و25، بند 7)
// "بعد الوصول لأعلى الرتب، يستمر القائد بالحصول على نسبة من إنتاج الأجيال
// التالية دون حد ثابت" — مخصص لرتبة Crown Ambassador فقط. شهري، عبر cron.
//
// ⚠️ ملاحظة: الملف ما يحدد نسبة دقيقة ولا تعريف "الإنتاج" بالضبط. اعتمدت
// هون: نسبة من إجمالي مبالغ mlm_commissions (كل الأنواع) المدفوعة خلال
// الشهر لكل الفريق تحت الشجرة الكاملة لصاحب رتبة Crown. لازم تأكيد الصيغة
// النهائية قبل التشغيل الفعلي.

import { insertCommissionAndPay } from "@/lib/commission-payout";

const INFINITY_BONUS_PERCENT = 3; // %
const CROWN_LEVEL_ORDER = 6;

/** يرجع كل معرّفات الفريق تحت عضو معيّن (بالشجرة، عبر parent_id) — BFS كامل */
async function getFullDownline(supabaseAdmin, rootId) {
  const all = [];
  const queue = [rootId];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const { data: children } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("parent_id", currentId);

    for (const child of children || []) {
      all.push(child.id);
      queue.push(child.id);
    }
  }
  return all;
}

export async function runMonthlyInfinityBonus(supabaseAdmin) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: crownMembers } = await supabaseAdmin
    .from("profiles")
    .select("id, is_active_member, ranks:rank_id (level_order)")
    .not("rank_id", "is", null);

  const qualified = (crownMembers || []).filter(
    (m) => m.is_active_member && Number(m.ranks?.level_order || 0) >= CROWN_LEVEL_ORDER
  );

  let paidCount = 0;
  for (const leader of qualified) {
    const downlineIds = await getFullDownline(supabaseAdmin, leader.id);
    if (downlineIds.length === 0) continue;

    const { data: teamCommissions } = await supabaseAdmin
      .from("mlm_commissions")
      .select("amount")
      .in("beneficiary_id", downlineIds)
      .eq("status", "approved")
      .gte("created_at", monthStart);

    const totalTeamVolume = (teamCommissions || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    if (totalTeamVolume <= 0) continue;

    const amount = Math.round(((totalTeamVolume * INFINITY_BONUS_PERCENT) / 100) * 100) / 100;
    if (amount <= 0) continue;

    await insertCommissionAndPay(supabaseAdmin, {
      beneficiaryId: leader.id,
      bonusType: "infinity",
      amount,
      notifyMessage: `👑 حصلت على ${amount} دينار Infinity Bonus لهذا الشهر`,
    });
    paidCount += 1;
  }

  return { paidCount };
}
