import { createNotification } from "@/lib/notifications";

// كل ما يوصل المسوّق لهاد العدد من الإحالات المدفوعة (مستوى 1) بنفس الشهر، بياخد لفة عجلة إضافية
export const REFERRALS_PER_SPIN = 5;

// جوائز العجلة مع أوزانها (weight أعلى = احتمال أعلى)
export const WHEEL_PRIZES = [
  { label: "5$ بونص نقدي", type: "cash", value: 5, weight: 35 },
  { label: "10$ بونص نقدي", type: "cash", value: 10, weight: 22 },
  { label: "شهادة تقدير + Shoutout", type: "shoutout", value: 0, weight: 15 },
  { label: "25$ بونص نقدي", type: "cash", value: 25, weight: 12 },
  { label: "زيادة عمولة 5% لمدة أسبوع", type: "boost", value: 5, weight: 10 },
  { label: "50$ بونص نقدي", type: "cash", value: 50, weight: 4 },
  { label: "حظ أوفر المرة الجاي", type: "none", value: 0, weight: 2 },
];

export function currentPeriod() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export function spinWheel() {
  const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const prize of WHEEL_PRIZES) {
    if (r < prize.weight) return prize;
    r -= prize.weight;
  }
  return WHEEL_PRIZES[WHEEL_PRIZES.length - 1];
}

/**
 * تُستدعى بعد كل عمولة مستوى 1 (إحالة مباشرة دفعت). بتحدّث عدّاد الإحالات
 * الشهري، وإذا عبر عتبة REFERRALS_PER_SPIN بتضيف لفة عجلة وبتبعث إشعار.
 */
export async function trackReferralForWheel(admin, affiliateId) {
  const period = currentPeriod();

  const { data: existing } = await admin
    .from("bonus_wheel_progress")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .eq("period", period)
    .maybeSingle();

  const prevCount = existing?.referrals_count || 0;
  const prevSpinsEarned = existing?.spins_earned || 0;
  const newCount = prevCount + 1;
  const newSpinsEarned = Math.floor(newCount / REFERRALS_PER_SPIN);
  const gainedSpin = newSpinsEarned > prevSpinsEarned;

  const { error } = await admin.from("bonus_wheel_progress").upsert(
    {
      affiliate_id: affiliateId,
      period,
      referrals_count: newCount,
      spins_earned: newSpinsEarned,
      spins_used: existing?.spins_used || 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "affiliate_id,period" }
  );
  if (error) console.error("trackReferralForWheel upsert failed:", error.message);

  if (gainedSpin) {
    await createNotification(admin, affiliateId, {
      type: "wheel_credit",
      title: "كسبت لفة عجلة بونص",
      message: `وصلت لـ ${newCount} إحالة مدفوعة هالشهر — روح لف العجلة وخذ جائزتك`,
      link: "/affiliate",
    });
  }
}
