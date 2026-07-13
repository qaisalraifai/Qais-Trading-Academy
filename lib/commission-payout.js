// مساعد مشترك: تسجيل عمولة + تحويلها فعليًا للمحفظة + إشعار المستفيد.
// تستخدمه كل محركات العمولات (compensation-engine, binary-engine,
// rank-engine, matching-engine, leadership-engine) حتى ما نكرر نفس المنطق.

import { creditWallet } from "@/lib/wallets";
import { createNotification } from "@/lib/notifications";
import { applyCommissionCap } from "@/lib/commission-caps";

const WALLET_BY_BONUS_TYPE = {
  direct: "commission",
  renewal: "commission",
  binary: "commission",
  matching: "commission",
  rank: "bonus",
  leadership: "bonus",
  infinity: "bonus",
  fast_start: "bonus",
  achievement: "bonus",
};

export async function insertCommissionAndPay(supabaseAdmin, {
  beneficiaryId,
  sourceUserId = null,
  paymentId = null,
  bonusType,
  cvValue = null,
  amount,
  notifyMessage,
}) {
  if (!beneficiaryId || !amount || amount <= 0) return null;

  // الفصل 30: سقف يومي/شهري حسب رتبة المستفيد — يحمي من أي خلل يدفع مبالغ ضخمة بالغلط
  const cappedAmount = await applyCommissionCap(supabaseAdmin, beneficiaryId, amount);
  if (cappedAmount <= 0) {
    console.warn(`insertCommissionAndPay: تم إيقاف الدفع لـ ${beneficiaryId} (${bonusType}) — تجاوز السقف المسموح`);
    return null;
  }
  const wasCapped = cappedAmount < amount;

  const { data, error } = await supabaseAdmin
    .from("mlm_commissions")
    .insert({
      beneficiary_id: beneficiaryId,
      source_user_id: sourceUserId,
      payment_id: paymentId,
      bonus_type: bonusType,
      cv_value: cvValue,
      amount: cappedAmount,
      status: "approved",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`insertCommissionAndPay (${bonusType}) failed:`, error.message);
    return null;
  }

  const walletType = WALLET_BY_BONUS_TYPE[bonusType] || "commission";
  await creditWallet(supabaseAdmin, beneficiaryId, walletType, cappedAmount, bonusType, data.id);

  await createNotification(supabaseAdmin, beneficiaryId, {
    type: "commission",
    title: "💰 عمولة جديدة",
    message:
      (notifyMessage || `حصلت على ${cappedAmount} دينار (${bonusType})`) +
      (wasCapped ? " (تم تطبيق السقف اليومي/الشهري)" : ""),
    link: "/affiliate",
  }).catch((e) => console.error("createNotification failed:", e.message));

  return data.id;
}
