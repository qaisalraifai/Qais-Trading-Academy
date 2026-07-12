// محرك مكافآت الإنجاز Achievement Bonus (الفصل 5 و25 من الخطة)
// مكافآت تُدفع مرة وحدة فقط لما العضو يوصل لمعلم معيّن — محمية من التكرار
// عبر جدول achievements_unlocked (UNIQUE على user_id + achievement_code).

import { insertCommissionAndPay } from "@/lib/commission-payout";

// المعالم المدعومة حاليًا (قابلة للتوسعة لاحقًا بسهولة)
const REFERRAL_MILESTONES = [
  { code: "first_10_referrals", count: 10, amount: 20, label: "أول 10 إحالات" },
  { code: "first_100_referrals", count: 100, amount: 150, label: "أول 100 عضو" },
  { code: "first_1000_referrals", count: 1000, amount: 1000, label: "أول 1000 عضو" },
];
const CV_MILESTONE = { code: "first_million_cv", cv: 1_000_000, amount: 5000, label: "أول مليون CV" };

async function tryUnlock(supabaseAdmin, userId, code) {
  // محاولة إدراج — لو موجود مسبقًا (UNIQUE constraint) بيرجع error ومنتجاهله
  const { error } = await supabaseAdmin
    .from("achievements_unlocked")
    .insert({ user_id: userId, achievement_code: code });
  return !error; // true = أول مرة (لازم يتدفع)، false = مدفوعة مسبقًا
}

/** تُستدعى بعد أي تغيير بعدد المباشرين أو CV الفريق (من compensation-engine.js) */
export async function checkAchievements(supabaseAdmin, userId) {
  const { count: directCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("sponsor_id", userId);

  for (const milestone of REFERRAL_MILESTONES) {
    if ((directCount || 0) < milestone.count) continue;
    const firstTime = await tryUnlock(supabaseAdmin, userId, milestone.code);
    if (!firstTime) continue;
    await insertCommissionAndPay(supabaseAdmin, {
      beneficiaryId: userId,
      bonusType: "achievement",
      amount: milestone.amount,
      notifyMessage: `🏆 إنجاز جديد: ${milestone.label} — حصلت على ${milestone.amount} دينار`,
    });
  }

  const { data: member } = await supabaseAdmin
    .from("profiles")
    .select("cv_left, cv_right")
    .eq("id", userId)
    .maybeSingle();

  const totalCv = Number(member?.cv_left || 0) + Number(member?.cv_right || 0);
  if (totalCv >= CV_MILESTONE.cv) {
    const firstTime = await tryUnlock(supabaseAdmin, userId, CV_MILESTONE.code);
    if (firstTime) {
      await insertCommissionAndPay(supabaseAdmin, {
        beneficiaryId: userId,
        bonusType: "achievement",
        amount: CV_MILESTONE.amount,
        notifyMessage: `🏆 إنجاز جديد: ${CV_MILESTONE.label} — حصلت على ${CV_MILESTONE.amount} دينار`,
      });
    }
  }
}
