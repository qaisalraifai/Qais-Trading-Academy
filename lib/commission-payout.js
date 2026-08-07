// مساعد مشترك: تسجيل مكافأة إنجاز + تحويلها فعليًا للمحفظة + إشعار المستفيد.
// يستخدمه حالياً lib/achievement-engine.js بس (مكافآت المعالم لمرة وحدة).
// عمولات الإحالة (تسجيل/تجديد) لها مسارها الخاص عبر lib/referral-commissions.js
// وجدول commissions + دورة الصرف (payouts) — ما بتمر من هون.

import { creditWallet } from "@/lib/wallets";
import { createNotification } from "@/lib/notifications";

const WALLET_BY_BONUS_TYPE = {
  achievement: "bonus",
};

export async function insertCommissionAndPay(supabaseAdmin, {
  beneficiaryId,
  bonusType,
  amount,
  notifyMessage,
}) {
  if (!beneficiaryId || !amount || amount <= 0) return null;

  const walletType = WALLET_BY_BONUS_TYPE[bonusType] || "bonus";
  await creditWallet(supabaseAdmin, beneficiaryId, walletType, amount, bonusType, null);

  await createNotification(supabaseAdmin, beneficiaryId, {
    type: "commission",
    title: "مكافأة جديدة",
    message: notifyMessage || `حصلت على ${amount} (${bonusType})`,
    link: "/affiliate",
  }).catch((e) => console.error("createNotification failed:", e.message));

  return true;
}
