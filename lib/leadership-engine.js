// محرك صندوق القيادة Leadership Pool (الفصل 5 و25 و52 من الخطة)
// شهري — بيوزّع نسبة ثابتة من إيرادات الشهر (10% من الاشتراك الأول / 15%
// من التجديد، حسب الفصل 3-4) بالتساوي على كل القادة المؤهلين (رتبة Leader فأعلى).
//
// ⚠️ ملاحظة: طريقة التوزيع (بالتساوي) قرار مبدئي مؤقت — الملف ما يحدد آلية
// دقيقة (بالتساوي؟ بنسبة CV؟ بنسبة الفريق؟)، فلازم يتأكد صاحب المشروع
// من الصيغة النهائية قبل ما تشتغل بأموال حقيقية.

import { insertCommissionAndPay } from "@/lib/commission-payout";
import { getSetting } from "@/lib/mlm-settings";

const LEADER_MIN_LEVEL_ORDER = 3; // Leader فما فوق (حسب جدول ranks)

export async function runMonthlyLeadershipPool(supabaseAdmin) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // إجمالي إيرادات الشهر من جدول payments (النظام الحالي بالدولار عبر Paddle)
  const { data: paymentsThisMonth } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("status", "paid")
    .gte("created_at", monthStart);

  const totalRevenue = (paymentsThisMonth || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  if (totalRevenue <= 0) return { poolAmount: 0, paidCount: 0 };

  // متوسط تقريبي بين 10% (اشتراك أول) و15% (تجديد) — إلى حين وجود تقسيم دقيق حسب نوع الدفعة
  const leadershipPoolPercent = await getSetting(supabaseAdmin, "leadership_pool_percent");
  const poolAmount = Math.round(((totalRevenue * leadershipPoolPercent) / 100) * 100) / 100;

  const { data: leaders } = await supabaseAdmin
    .from("profiles")
    .select("id, is_active_member, ranks:rank_id (level_order)")
    .not("rank_id", "is", null);

  const qualifiedLeaders = (leaders || []).filter(
    (l) => l.is_active_member && Number(l.ranks?.level_order || 0) >= LEADER_MIN_LEVEL_ORDER
  );

  if (qualifiedLeaders.length === 0) return { poolAmount, paidCount: 0 };

  const sharePerLeader = Math.round((poolAmount / qualifiedLeaders.length) * 100) / 100;
  if (sharePerLeader <= 0) return { poolAmount, paidCount: 0 };

  let paidCount = 0;
  for (const leader of qualifiedLeaders) {
    await insertCommissionAndPay(supabaseAdmin, {
      beneficiaryId: leader.id,
      bonusType: "leadership",
      amount: sharePerLeader,
      notifyMessage: `حصلت على ${sharePerLeader} دينار من صندوق القيادة لهذا الشهر`,
    });
    paidCount += 1;
  }

  return { poolAmount, paidCount };
}
