// Adapter كريبتو تلقائي (NOWPayments أو أي مزوّد مشابه) — Placeholder معماري
// فقط. مسجّل بالـ registry وبجدول payment_providers لكن enabled = false
// افتراضياً (بند صريح: "لا تبدأ بربط أي بوابة دفع فعلية الآن").
//
// لما ينحدد المزوّد النهائي (اللي بيدعم حسابات الأردن)، الشغل المطلوب هون
// هو فقط:
//   1) تعبئة createCheckout() لينشئ فاتورة/عنوان دفع عبر API المزوّد.
//   2) تعبئة verifyAndParseWebhookRaw() للتحقق من توقيع الـ webhook وتحويل
//      حدثه لصيغة موحّدة: { externalRef, invoiceId, status, amount, raw }.
//   3) تفعيل الصف بجدول payment_providers (enabled = true) من لوحة الأدمن.
// بدون أي تعديل على باقي النظام (billing-service، الـ API routes، الواجهة) —
// كلها بتتعامل مع أي Adapter بنفس الطريقة تلقائياً.

export const nowPaymentsAdapter = {
  code: "nowpayments",
  supportsAutoRenew: false, // مبدئياً false لحد ما نأكد إذا المزوّد بيدعم اشتراكات متكررة فعلياً

  async createCheckout() {
    throw new Error("مزوّد الدفع الكريبتو التلقائي لسا قيد الإعداد وغير مفعّل حالياً.");
  },

  async verifyAndParseWebhookRaw() {
    throw new Error("Webhook هاد المزوّد لسا مش مربوط.");
  },

  async cancelSubscription() {
    return null;
  },
};
