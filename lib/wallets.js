// مساعد التعامل مع المحافظ الأربع (الفصل 9 و17 من الخطة)

const VALID_WALLET_TYPES = ["commission", "bonus", "cashback", "withdrawal"];

/**
 * يضيف (أو يخصم لو amount سالب) مبلغ من محفظة عضو معيّنة، وبيسجل الحركة
 * بجدول wallet_transactions. بينشئ صف المحفظة تلقائيًا لو أول مرة.
 */
export async function creditWallet(supabaseAdmin, userId, walletType, amount, reason, referenceId = null) {
  if (!VALID_WALLET_TYPES.includes(walletType)) {
    throw new Error(`creditWallet: نوع محفظة غير معروف: ${walletType}`);
  }
  if (!userId || !amount) return null;

  // upsert بسيط: نجيب المحفظة، لو مش موجودة ننشئها برصيد صفر
  let { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("wallet_type", walletType)
    .maybeSingle();

  if (!wallet) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: userId, wallet_type: walletType, balance: 0 })
      .select("id, balance")
      .single();
    if (createError) throw new Error(`creditWallet: فشل إنشاء المحفظة — ${createError.message}`);
    wallet = created;
  }

  const newBalance = Number(wallet.balance || 0) + Number(amount);

  const { error: updateError } = await supabaseAdmin
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  if (updateError) throw new Error(`creditWallet: فشل تحديث الرصيد — ${updateError.message}`);

  const { error: txError } = await supabaseAdmin.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: userId,
    amount: Number(amount),
    reason,
    reference_id: referenceId,
  });

  if (txError) console.error("creditWallet: فشل تسجيل الحركة —", txError.message);

  return newBalance;
}
