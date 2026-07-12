// مكافأة البداية السريعة Fast Start Bonus (الفصل 5، بند 1)
// "يحصل عليه عند أول تسجيل" — بتُدفع للعضو الجديد نفسه (مش لراعيه)، مرة
// وحدة بس، عند أول اشتراك ناجح.

import { insertCommissionAndPay } from "@/lib/commission-payout";
import { getSetting } from "@/lib/mlm-settings";

export async function payFastStartBonus(supabaseAdmin, userId) {
  const amount = await getSetting(supabaseAdmin, "fast_start_bonus_amount");
  await insertCommissionAndPay(supabaseAdmin, {
    beneficiaryId: userId,
    bonusType: "fast_start",
    amount,
    notifyMessage: `🎉 مكافأة الانطلاقة السريعة: حصلت على ${amount} دينار لانضمامك للأكاديمية`,
  });
}
