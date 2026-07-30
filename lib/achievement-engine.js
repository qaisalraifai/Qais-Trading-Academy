// محرك الإنجازات — مبني بالكامل على جدول achievement_definitions (يُدار من
// لوحة الأدمن بدون لمس الكود). كل الإنجازات تراكمية (Lifetime): أول مرة
// يتحقق الشرط تُصرف المكافأة (لو فيها) وتُقفل نهائياً — ما بتُفقد أبداً
// حتى لو تراجعت أرقام المسوّق لاحقاً (مطابق تماماً لقرار "تراكمي دائماً").

import { insertCommissionAndPay } from "@/lib/commission-payout";
import { createNotification } from "@/lib/notifications";

async function getMetricValue(admin, userId, metric) {
  if (metric === "total_referrals") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);
    return count || 0;
  }

  if (metric === "total_earned") {
    const { data } = await admin.from("commissions").select("commission_amount").eq("affiliate_id", userId);
    return (data || []).reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  }

  // monthly_top_rank: يُصرف يدويًا عبر lib/monthly-contest.js (كرون شهري)، مو هون
  return null;
}

async function tryUnlock(admin, userId, code) {
  // محاولة إدراج — لو موجود مسبقًا (UNIQUE constraint) بيرجع error ومنتجاهله
  const { error } = await admin.from("achievements_unlocked").insert({ user_id: userId, achievement_code: code });
  return !error; // true = أول مرة (لازم يُصرف)، false = مفتوحة مسبقًا
}

/** تُستدعى بعد أي إحالة/تجديد/دفعة جديدة — تفحص كل الإنجازات المفعّلة */
export async function checkAchievements(admin, userId) {
  const { data: definitions } = await admin
    .from("achievement_definitions")
    .select("*")
    .eq("is_active", true)
    .neq("metric", "monthly_top_rank"); // هاي تُدار من كرون منفصل

  for (const def of definitions || []) {
    const value = await getMetricValue(admin, userId, def.metric);
    if (value === null || value < def.threshold) continue;

    const firstTime = await tryUnlock(admin, userId, def.code);
    if (!firstTime) continue;

    if (def.bonus_amount > 0) {
      await insertCommissionAndPay(admin, {
        beneficiaryId: userId,
        bonusType: "achievement",
        amount: def.bonus_amount,
        notifyMessage: `${def.icon} إنجاز جديد: ${def.title_ar} — حصلت على $${Number(def.bonus_amount).toFixed(2)}`,
      });
    } else {
      await createNotification(admin, userId, {
        type: "badge",
        title: `${def.icon} إنجاز جديد: ${def.title_ar}`,
        message: def.description_ar || "",
        link: "/affiliate",
      }).catch(() => {});
    }
  }
}
