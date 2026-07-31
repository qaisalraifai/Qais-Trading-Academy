// Adapter بوابة Whop (بطاقات بنكية) — بس هلأ ملفوف بالواجهة الموحّدة
// (lib/payments/registry.js) بدل ما يكون مستدعى مباشرة من الـ API routes.
// السلوك الفعلي (استدعاء Whop SDK) نفسه القديم بالضبط، ما تغيّر أي شي جوهري.

import { getWhop } from "@/lib/whop";

export const whopAdapter = {
  code: "whop",
  supportsAutoRenew: true,

  /**
   * بينشئ جلسة دفع (checkout configuration) عند Whop، ويحط invoice.id
   * بالـ metadata حتى الـ webhook يقدر يربط الدفعة بالفاتورة الصحيحة
   * بغض النظر عن نوعها (تسجيل أول أو تجديد).
   */
  async createCheckout({ user, invoice }) {
    const planId = process.env.WHOP_PLAN_ID;
    if (!planId) {
      throw new Error("متغير WHOP_PLAN_ID غير مضبوط بإعدادات المشروع.");
    }

    const whop = getWhop();
    const config = await whop.checkoutConfigurations.create({
      plan_id: planId,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?type=subscription`,
      metadata: { user_id: user.id, invoice_id: invoice.id },
    });

    return { mode: "embed", sessionId: config.id };
  },

  /** يتحقق من توقيع الـ webhook ويرجّع الحدث محلل (نفس منطق app/api/webhook القديم) */
  async verifyAndParseWebhookRaw(bodyText, headers) {
    const whop = getWhop();
    return whop.webhooks.unwrap(bodyText, { headers });
  },

  async cancelSubscription(externalRef) {
    // إلغاء اشتراك Whop حالياً بيصير من صفحة الطالب المستضافة على whop.com/orders
    // (نفس ما هو معمول بـ app/api/account) — ما في حاجة API إلغاء من عندنا هلأ.
    return null;
  },
};
