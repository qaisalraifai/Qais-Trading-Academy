// نظام عمولة الإحالة المباشرة (بدون طبقات، بدون شجرة ثنائية) — راعي واحد
// مباشر (referred_by) بس، بدون مستوى 2 أو 3.
//
// مصدرين للدخل، وقيمتهم الفعلية بالدولار تعتمد على مستوى المسوّق الحالي
// (Bronze → Elite، انظر lib/tiers.js) — كل ما ترقّى، دخله من كل عمليات
// التسجيل/التجديد الجاية بيرتفع فوراً:
//   1) عمولة تسجيل (Signup): تُدفع مرة وحدة، بس بعد ما العضو المُحال يكمّل
//      أول درس فعلياً (شرط حماية من التسجيل الشكلي). لحد هيك بتضل الحالة
//      "awaiting_lesson". القيمة تُقفل عند التسجيل (مستوى المسوّق وقتها)
//      ولا تتغيّر لاحقاً حتى لو تغيّر مستواه قبل ما تتحرر.
//   2) عمولة تجديد (Renewal): تُدفع تلقائياً كل شهر يجدد فيه العضو المُحال،
//      بمستوى المسوّق الحالي وقت التجديد بالضبط (مو وقت أول تسجيل) —
//      هيك الترقية بترفع دخله فوراً على كل عملائه الحاليين، مو بس الجدد.

import { createNotification } from "@/lib/notifications";
import { checkAndAwardBadges } from "@/lib/badges";
import { trackReferralForWheel } from "@/lib/bonus-wheel";
import { checkAchievements } from "@/lib/achievement-engine";
import { syncAffiliateTier, getCurrentTierRates } from "@/lib/tiers";

// يولّد كود مسوّق فريد قصير من اسم المستخدم + رقم عشوائي
export function generateAffiliateCode(username) {
  const base = (username || "AFF")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\u0600-\u06FF]/g, "")
    .slice(0, 8) || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

/** إعدادات عامة غير متعلقة بالمستوى (دورة الصرف، الحد الأدنى) */
export async function getReferralSettings(supabaseAdmin) {
  const { data } = await supabaseAdmin
    .from("affiliate_settings")
    .select("min_payout_usd, payout_cycle_days")
    .eq("id", 1)
    .maybeSingle();

  return {
    minPayoutUsd: Number(data?.min_payout_usd) || 0,
    payoutCycleDays: Number(data?.payout_cycle_days) || 14,
  };
}

/**
 * بعد أول دفعة ناجحة لعضو جديد (اشتراك أول مرة): نسجّل عمولة التسجيل
 * لراعيه المباشر، بقيمة مستوى الراعي الحالي وقت التسجيل، بس بحالة
 * "awaiting_lesson" — ما بتصير قابلة للصرف إلا لما العضو يكمّل أول درس.
 */
export async function recordSignupCommission(supabaseAdmin, { referredUserId, paymentId, amount }) {
  if (!referredUserId || !amount || amount <= 0) return null;

  const { data: referredProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, username, referred_by")
    .eq("id", referredUserId)
    .maybeSingle();

  const sponsorId = referredProfile?.referred_by;
  if (!sponsorId) return null;

  const tier = await getCurrentTierRates(supabaseAdmin, sponsorId);
  const commissionAmount = Math.round(tier.signupAmount * 100) / 100;
  if (commissionAmount <= 0) return null;

  // شرط الفصل: بس لو العضو أكمل أول درس فعلاً قبل حتى ما ندفع، منعمل approve فوري
  const alreadyCompletedFirstLesson = await hasCompletedFirstLesson(supabaseAdmin, referredUserId);

  const { data: row, error } = await supabaseAdmin
    .from("commissions")
    .insert({
      affiliate_id: sponsorId,
      source_user_id: referredUserId,
      payment_id: paymentId || null,
      type: "signup",
      tier_code: tier.tierCode,
      payment_amount: amount,
      commission_amount: commissionAmount,
      status: alreadyCompletedFirstLesson ? "pending" : "awaiting_lesson",
    })
    .select("id")
    .single();

  if (error) {
    console.error("recordSignupCommission insert failed:", error.message);
    return null;
  }

  if (alreadyCompletedFirstLesson) {
    await payOutApprovedCommission(supabaseAdmin, row.id, sponsorId, commissionAmount, "signup");
  } else {
    await createNotification(supabaseAdmin, sponsorId, {
      type: "commission",
      title: "🎓 عضو جديد بانتظار أول درس",
      message: `${referredProfile?.username || "عضو"} سجّل عن طريقك — عمولتك ($${commissionAmount.toFixed(2)}) بتتحرر أول ما يكمّل أول درس`,
      link: "/affiliate",
    }).catch(() => {});
  }

  await syncAffiliateTier(supabaseAdmin, sponsorId).catch(() => {});
  await checkAchievements(supabaseAdmin, sponsorId).catch(() => {});

  return row.id;
}

/**
 * بعد أي تجديد شهري ناجح: نسجّل عمولة التجديد لراعي العضو المباشر فوراً،
 * بقيمة مستوى الراعي الحالي **وقت التجديد بالضبط** — لو ترقّى، عمولته
 * على هالعميل (وكل عملائه) بترتفع من نفس اللحظة.
 */
export async function recordRenewalCommission(supabaseAdmin, { referredUserId, paymentId, amount }) {
  if (!referredUserId || !amount || amount <= 0) return null;

  const { data: referredProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, username, referred_by")
    .eq("id", referredUserId)
    .maybeSingle();

  const sponsorId = referredProfile?.referred_by;
  if (!sponsorId) return null;

  const tier = await getCurrentTierRates(supabaseAdmin, sponsorId);
  const commissionAmount = Math.round(tier.renewalAmount * 100) / 100;
  if (commissionAmount <= 0) return null;

  const { data: row, error } = await supabaseAdmin
    .from("commissions")
    .insert({
      affiliate_id: sponsorId,
      source_user_id: referredUserId,
      payment_id: paymentId || null,
      type: "renewal",
      tier_code: tier.tierCode,
      payment_amount: amount,
      commission_amount: commissionAmount,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("recordRenewalCommission insert failed:", error.message);
    return null;
  }

  await createNotification(supabaseAdmin, sponsorId, {
    type: "commission",
    title: "💰 عمولة تجديد جديدة",
    message: `${referredProfile?.username || "أحد أعضاء شبكتك"} جدّد اشتراكه — حصلت على $${commissionAmount.toFixed(2)}`,
    link: "/affiliate",
  }).catch(() => {});

  await checkAndAwardBadges(supabaseAdmin, sponsorId).catch(() => {});
  await syncAffiliateTier(supabaseAdmin, sponsorId).catch(() => {});
  await checkAchievements(supabaseAdmin, sponsorId).catch(() => {});

  return row.id;
}

/** هل أكمل هالعضو أي درس (lecture_progress.completed = true) ولو مرة وحدة؟ */
export async function hasCompletedFirstLesson(supabaseAdmin, userId) {
  const { count } = await supabaseAdmin
    .from("lecture_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true);

  return (count || 0) > 0;
}

/**
 * تُستدعى فور ما عضو يكمّل درس (أي درس). لو هاي أول مرة يكمّل فيها درس،
 * منفحص إذا في عمولة تسجيل بانتظاره (awaiting_lesson) ومنحررها فوراً لراعيه.
 * القيمة المحررة هي نفسها المسجّلة وقت التسجيل (مقفولة، ما بتتغيّر).
 */
export async function releaseSignupCommissionIfEligible(supabaseAdmin, referredUserId) {
  if (!referredUserId) return;

  const { data: pendingRow } = await supabaseAdmin
    .from("commissions")
    .select("id, affiliate_id, commission_amount")
    .eq("source_user_id", referredUserId)
    .eq("type", "signup")
    .eq("status", "awaiting_lesson")
    .maybeSingle();

  if (!pendingRow) return;

  await payOutApprovedCommission(
    supabaseAdmin,
    pendingRow.id,
    pendingRow.affiliate_id,
    Number(pendingRow.commission_amount),
    "signup"
  );
}

async function payOutApprovedCommission(supabaseAdmin, commissionId, sponsorId, amount, type) {
  const { error } = await supabaseAdmin
    .from("commissions")
    .update({ status: "pending" })
    .eq("id", commissionId)
    .eq("status", "awaiting_lesson");

  if (error) {
    console.error("payOutApprovedCommission update failed:", error.message);
    return;
  }

  await createNotification(supabaseAdmin, sponsorId, {
    type: "commission",
    title: "🎉 تحررت عمولة التسجيل",
    message: `المدعو كمّل أول درس — عمولتك ($${amount.toFixed(2)}) صارت مستحقة وبتنضم لأقرب دورة صرف`,
    link: "/affiliate",
  }).catch(() => {});

  await trackReferralForWheel(supabaseAdmin, sponsorId).catch(() => {});
  await checkAndAwardBadges(supabaseAdmin, sponsorId).catch(() => {});
}
