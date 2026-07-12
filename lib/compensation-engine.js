// محرك العمولات الأساسي (الفصل 5، 25، 27 من الخطة)
// بيشتغل عند كل دفعة ناجحة (أول اشتراك أو تجديد شهري) — مستقل بالكامل
// عن نظام الـ3 مستويات القديم بـ lib/affiliate.js، وما بيلمسه.
//
// اللي بيعمله:
//   1. يحدّث CV الشخصي للعضو + CV الأجداد بالشجرة (إجمالي + بركة Binary)
//   2. يفعّل العضو (is_active_member) ويحدّث last_renewal_at
//   3. Direct Bonus (أول اشتراك) / Renewal Bonus (تجديد) — لراعي العضو
//   4. Binary Bonus — لكل الأجداد المتأثرين، على الرجل الأضعف
//   5. Rank Engine — يفحص ترقية العضو نفسه وكل أجداده المتأثرين
//
// مؤجل لمراحل جاية: Matching وLeadership (شهريان، عبر cron — انظر
// lib/matching-engine.js وlib/leadership-engine.js)، وFast Start/Achievement.

import { bumpAncestorsCv } from "@/lib/binary-tree";
import { insertCommissionAndPay } from "@/lib/commission-payout";
import { processBinaryBonusForAncestors } from "@/lib/binary-engine";
import { checkAndPromoteRank } from "@/lib/rank-engine";

// ثوابت الخطة (الفصل 2، 25) — 1 دينار = 1 CV، بغض النظر عن عملة التحصيل الفعلية بباديل
const FIRST_SUBSCRIPTION_CV = 300;
const RENEWAL_CV = 100;
const DIRECT_BONUS_AMOUNT = 20; // دينار
const RENEWAL_BONUS_AMOUNT = 8; // دينار — نسبة أقل من الاشتراك الأول

/**
 * نقطة الدخول: تُستدعى من webhook الدفع بعد كل عملية دفع ناجحة (أول اشتراك أو تجديد).
 *
 * @param {object} supabaseAdmin
 * @param {object} p
 * @param {string} p.userId - العضو اللي دفع
 * @param {string} p.paymentId - id صف payments
 * @param {boolean} p.isFirstPayment - true لأول اشتراك، false للتجديد الشهري
 */
export async function processMlmCommissionsForPayment(supabaseAdmin, { userId, paymentId, isFirstPayment }) {
  if (!userId) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, sponsor_id, parent_id, leg, cv_personal")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("processMlmCommissionsForPayment: profile not found", profileError?.message);
    return;
  }

  const cvValue = isFirstPayment ? FIRST_SUBSCRIPTION_CV : RENEWAL_CV;

  // 1) CV الشخصي + تفعيل العضو
  await supabaseAdmin
    .from("profiles")
    .update({
      cv_personal: Number(profile.cv_personal || 0) + cvValue,
      is_active_member: true,
      last_renewal_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // 2) CV الأجداد بالشجرة (الإجمالي لشروط الرتب + بركة Binary غير المُطابقة)
  let touchedAncestors = [];
  if (profile.parent_id && profile.leg) {
    touchedAncestors = await bumpAncestorsCv(supabaseAdmin, profile.parent_id, profile.leg, cvValue).catch((e) => {
      console.error("bumpAncestorsCv failed:", e.message);
      return [];
    });
  }

  // 3) Direct Bonus (أول اشتراك) أو Renewal Bonus (تجديد) — لراعي العضو المباشر
  if (profile.sponsor_id) {
    if (isFirstPayment) {
      await insertCommissionAndPay(supabaseAdmin, {
        beneficiaryId: profile.sponsor_id,
        sourceUserId: userId,
        paymentId,
        bonusType: "direct",
        amount: DIRECT_BONUS_AMOUNT,
        notifyMessage: `حصلت على ${DIRECT_BONUS_AMOUNT} دينار عمولة مباشرة (Direct Bonus)`,
      });
    } else {
      await insertCommissionAndPay(supabaseAdmin, {
        beneficiaryId: profile.sponsor_id,
        sourceUserId: userId,
        paymentId,
        bonusType: "renewal",
        amount: RENEWAL_BONUS_AMOUNT,
        notifyMessage: `حصلت على ${RENEWAL_BONUS_AMOUNT} دينار عمولة تجديد (Renewal Bonus)`,
      });
    }
  }

  // 4) Binary Bonus لكل الأجداد المتأثرين (على الرجل الأضعف، مع Carry Forward تلقائي)
  await processBinaryBonusForAncestors(supabaseAdmin, touchedAncestors);

  // 5) Rank Engine — العضو نفسه وكل أجداده (تغيّرت أعداد المباشرين/CV الفريق عندهم)
  await checkAndPromoteRank(supabaseAdmin, userId).catch((e) =>
    console.error("checkAndPromoteRank failed for", userId, e.message)
  );
  for (const ancestorId of touchedAncestors) {
    await checkAndPromoteRank(supabaseAdmin, ancestorId).catch((e) =>
      console.error("checkAndPromoteRank failed for", ancestorId, e.message)
    );
  }

  // TODO (مراحل جاية): Fast Start Bonus، Achievement Bonus، Infinity Bonus
}
