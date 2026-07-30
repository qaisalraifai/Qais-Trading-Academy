// مسابقة "أعلى مسوّق بالشهر" — تشتغل مرة وحدة بأول يوم من كل شهر (من
// app/api/cron/route.js)، وبتفتح إنجاز خاص لأعلى مسوّق حسب أرباح الشهر
// الماضي. الكود فريد لكل شهر (مثلاً monthly_top_2026_07) فما بيتكرر.

import { createNotification } from "@/lib/notifications";
import { insertCommissionAndPay } from "@/lib/commission-payout";

export async function runMonthlyTopEarnerContest(admin) {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString();
  const monthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1).toISOString();
  const code = `monthly_top_${prevMonth.getFullYear()}_${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  const { data: definition } = await admin
    .from("achievement_definitions")
    .select("*")
    .eq("metric", "monthly_top_rank")
    .eq("is_active", true)
    .maybeSingle();

  if (!definition) return { skipped: "no_active_definition" };

  const { data: commissions } = await admin
    .from("commissions")
    .select("affiliate_id, commission_amount")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  if (!commissions || commissions.length === 0) return { skipped: "no_commissions" };

  const totals = {};
  for (const c of commissions) {
    totals[c.affiliate_id] = (totals[c.affiliate_id] || 0) + (Number(c.commission_amount) || 0);
  }
  const [topAffiliateId, topAmount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  if (!topAffiliateId) return { skipped: "no_top" };

  const { error } = await admin.from("achievements_unlocked").insert({ user_id: topAffiliateId, achievement_code: code });
  if (error) return { skipped: "already_awarded" }; // UNIQUE constraint = سبق إعطاؤه لهاد الشهر

  if (definition.bonus_amount > 0) {
    await insertCommissionAndPay(admin, {
      beneficiaryId: topAffiliateId,
      bonusType: "achievement",
      amount: definition.bonus_amount,
      notifyMessage: `${definition.icon} أنت أعلى مسوّق الشهر الماضي! (${Math.round(topAmount * 100) / 100}$) — حصلت على $${definition.bonus_amount}`,
    });
  } else {
    await createNotification(admin, topAffiliateId, {
      type: "badge",
      title: `${definition.icon} أنت أعلى مسوّق الشهر الماضي!`,
      message: `حققت أعلى أرباح بين كل المسوّقين الشهر الماضي (${Math.round(topAmount * 100) / 100}$) 🎉`,
      link: "/affiliate",
    }).catch(() => {});
  }

  return { winner: topAffiliateId, amount: topAmount, code };
}
