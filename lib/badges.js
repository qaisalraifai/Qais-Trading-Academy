import { createNotification } from "@/lib/notifications";

// تعريف الشارات ومنطق الاستحقاق. لازم يطابق كودات جدول badges بقاعدة البيانات.
export const BADGE_RULES = [
  { code: "first_referral", check: (s) => s.paidReferrals >= 1 },
  { code: "ten_referrals", check: (s) => s.paidReferrals >= 10 },
  { code: "fifty_referrals", check: (s) => s.paidReferrals >= 50 },
  { code: "hundred_dollars", check: (s) => s.totalEarned >= 100 },
  { code: "thousand_dollars", check: (s) => s.totalEarned >= 1000 },
  { code: "network_builder", check: (s) => s.totalNetwork >= 20 },
  { code: "sharp_shooter", check: (s) => s.clicks >= 20 && s.conversionRate >= 20 },
];

/**
 * يحسب إحصائيات المسوّق اللازمة لفحص الشارات (إحالات مباشرة + أرباح + نقرات).
 * النظام مسطّح الآن — إحالة مباشرة واحدة بس (referred_by)، بدون طبقات.
 */
export async function computeAffiliateStats(admin, affiliateId) {
  const { data: direct } = await admin.from("profiles").select("id").eq("referred_by", affiliateId);
  const directIds = (direct || []).map((r) => r.id);

  const { data: commissions } = await admin
    .from("commissions")
    .select("commission_amount, type, source_user_id")
    .eq("affiliate_id", affiliateId);
  const totalEarned = (commissions || []).reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  const paidReferrals = new Set((commissions || []).filter((c) => c.type === "signup").map((c) => c.source_user_id)).size;

  const { data: clickRows } = await admin.from("affiliate_clicks").select("id, converted_user_id").eq("affiliate_id", affiliateId);
  const clicks = (clickRows || []).length;
  const conversions = (clickRows || []).filter((c) => c.converted_user_id).length;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  return {
    totalNetwork: directIds.length,
    totalEarned,
    paidReferrals,
    clicks,
    conversions,
    conversionRate,
  };
}

/**
 * يفحص شارات المسوّق ويمنحه أي شارة جديدة استحقّها (idempotent بفضل UNIQUE constraint)،
 * وبيبعث إشعار لكل شارة جديدة. بترجع لستة الشارات الجديدة الممنوحة بهاي المرة.
 */
export async function checkAndAwardBadges(admin, affiliateId) {
  const stats = await computeAffiliateStats(admin, affiliateId);

  const { data: existing } = await admin.from("affiliate_badges").select("badge_code").eq("affiliate_id", affiliateId);
  const earnedCodes = new Set((existing || []).map((b) => b.badge_code));

  const newlyEarned = [];
  for (const rule of BADGE_RULES) {
    if (earnedCodes.has(rule.code)) continue;
    if (rule.check(stats)) newlyEarned.push(rule.code);
  }

  if (newlyEarned.length === 0) return [];

  const { data: badgeDefs } = await admin.from("badges").select("code, title, icon").in("code", newlyEarned);
  const defsByCode = Object.fromEntries((badgeDefs || []).map((b) => [b.code, b]));

  const { error } = await admin
    .from("affiliate_badges")
    .insert(newlyEarned.map((code) => ({ affiliate_id: affiliateId, badge_code: code })));
  if (error) {
    console.error("checkAndAwardBadges insert failed:", error.message);
    return [];
  }

  for (const code of newlyEarned) {
    const def = defsByCode[code];
    await createNotification(admin, affiliateId, {
      type: "badge",
      title: `شارة جديدة: ${def?.title_ar || def?.code || ""}`.trim(),
      message: `مبروك! حصلت على شارة "${def?.title || code}"`,
      link: "/affiliate",
    });
  }

  return newlyEarned;
}
