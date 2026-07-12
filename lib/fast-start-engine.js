// مكافأة البداية السريعة Fast Start Bonus (الفصل 5، بند 1)
// "يحصل عليه عند أول تسجيل" — بتُدفع للعضو الجديد نفسه (مش لراعيه)، مرة
// وحدة بس، عند أول اشتراك ناجح.

import { insertCommissionAndPay } from "@/lib/commission-payout";

const FAST_START_BONUS_AMOUNT = 10; // دينار — قابل للتعديل لاحقًا من إعدادات الأدمن

export async function payFastStartBonus(supabaseAdmin, userId) {
  await insertCommissionAndPay(supabaseAdmin, {
    beneficiaryId: userId,
    bonusType: "fast_start",
    amount: FAST_START_BONUS_AMOUNT,
    notifyMessage: `🎉 مكافأة الانطلاقة السريعة: حصلت على ${FAST_START_BONUS_AMOUNT} دينار لانضمامك للأكاديمية`,
  });
}
