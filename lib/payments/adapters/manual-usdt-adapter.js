// Adapter الدفع اليدوي بالـ USDT — بدون أي طرف ثالث. الطالب يحوّل بنفسه
// لمحفظة من محافظ الأدمن، يرفع TXID + صورة إثبات، وتنشأ عملية دفع بحالة
// "بانتظار المراجعة" لحد ما الأدمن يوافق أو يرفض من لوحة التحكم.

import { createAdminClient } from "@/lib/supabase-server";

export const manualUsdtAdapter = {
  code: "manual_usdt",
  supportsAutoRenew: false,

  /**
   * ما بينشئ جلسة دفع خارجية — بس بيرجّع قائمة المحافظ الفعّالة حتى تُعرض
   * للطالب بالواجهة (عنوان + QR لكل شبكة). التقديم الفعلي (TXID + صورة)
   * بيصير بخطوة تانية عبر lib/payments/billing-service.js#submitManualPayment.
   */
  async createCheckout({ invoice }, adminClient) {
    const admin = adminClient || createAdminClient();
    const { data: wallets, error } = await admin
      .from("crypto_wallets")
      .select("id, network, currency, address, label")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error("تعذر جلب محافظ الاستلام: " + error.message);
    if (!wallets || wallets.length === 0) {
      throw new Error("ما في محافظ USDT مفعّلة حالياً — تواصل مع الدعم.");
    }

    return {
      mode: "manual",
      invoiceId: invoice.id,
      wallets,
      instructions:
        "اختر الشبكة المناسبة، حوّل المبلغ بالضبط لعنوان المحفظة، وبعدين ارفع رقم العملية (TXID) وصورة إثبات التحويل.",
    };
  },

  // ما في Webhook تلقائي لهاد المزوّد — المراجعة يدوية بالكامل عبر لوحة الأدمن.
  async verifyAndParseWebhookRaw() {
    return null;
  },

  async cancelSubscription() {
    return null;
  },
};
