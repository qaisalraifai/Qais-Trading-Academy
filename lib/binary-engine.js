// محرك العمولة الثنائية Binary Bonus (الفصل 5 و25 من الخطة)
// بيشتغل على كل جد اتأثر بإضافة CV جديدة (يُستدعى من compensation-engine.js
// مباشرة بعد bumpAncestorsCv).
//
// المبدأ: كل عضو عنده "بركة" CV غير مُطابقة بكل رجل (carry_left/carry_right).
// كل مرة، منطابق أصغر قيمة من الاثنين (الرجل الأضعف)، مندفع عمولة عليها،
// ومنطرحها من الرجلين — الفائض بالرجل الأقوى بضل مخزّن (Carry Forward)
// للدورة الجاية تلقائيًا لأنه ببساطة ما انطرح.

import { insertCommissionAndPay } from "@/lib/commission-payout";

const BINARY_BONUS_PERCENT = 10; // % من قيمة الـCV المُطابقة — قابل للتعديل لاحقًا من إعدادات الأدمن

export async function processBinaryBonus(supabaseAdmin, userId) {
  const { data: member, error } = await supabaseAdmin
    .from("profiles")
    .select("id, carry_left, carry_right, is_active_member")
    .eq("id", userId)
    .maybeSingle();

  if (error || !member) return;

  // الفصل 8: عضو غير نشط (ما جدد خلال 30 يوم) يتوقف استحقاقه لـ Binary
  if (!member.is_active_member) return;

  const left = Number(member.carry_left || 0);
  const right = Number(member.carry_right || 0);
  const matched = Math.min(left, right);

  if (matched <= 0) return;

  const amount = Math.round(((matched * BINARY_BONUS_PERCENT) / 100) * 100) / 100;

  // نطرح الجزء المُطابق من الرجلين — الباقي (الفرق) بضل بالعمود كـ Carry Forward تلقائيًا
  await supabaseAdmin
    .from("profiles")
    .update({ carry_left: left - matched, carry_right: right - matched })
    .eq("id", userId);

  if (amount > 0) {
    await insertCommissionAndPay(supabaseAdmin, {
      beneficiaryId: userId,
      sourceUserId: null,
      paymentId: null,
      bonusType: "binary",
      cvValue: matched,
      amount,
      notifyMessage: `حصلت على ${amount} دينار عمولة ثنائية (Binary Bonus)`,
    });
  }
}

/** يعالج Binary Bonus لكل الأجداد المتأثرين دفعة وحدة (تُستدعى مباشرة بعد bumpAncestorsCv) */
export async function processBinaryBonusForAncestors(supabaseAdmin, ancestorIds) {
  for (const id of ancestorIds || []) {
    await processBinaryBonus(supabaseAdmin, id).catch((e) =>
      console.error(`processBinaryBonus failed for ${id}:`, e.message)
    );
  }
}
