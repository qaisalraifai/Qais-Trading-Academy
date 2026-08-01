// Adapter كريبتو تلقائي عبر NOWPayments — تفعيل فوري بدون مراجعة أدمن.
// التوثيق: https://documenter.getpostman.com/view/7907941/2s93JusNJt
//
// آلية الشغل:
//   1) createCheckout بينشئ "Invoice" عند NOWPayments (صفحة دفع مستضافة عندهم)
//      ويحط invoice.id (فاتورتنا الداخلية) بحقل order_id، حتى نقدر نربط
//      إشعار الدفع (IPN) بالفاتورة الصحيحة.
//   2) NOWPayments بترجع رابط دفع (invoice_url) — الطالب يدفع أي كريبتو
//      يختاره وهنن بيحولوه تلقائياً حسب إعداد "Primary balance".
//   3) لما تتغير حالة الدفع، NOWPayments بترسل IPN (POST) لرابط الـ webhook
//      تبعنا مع توقيع HMAC-SHA512 بالهيدر x-nowpayments-sig، لازم نتحقق منه
//      قبل ما نصدّق المحتوى (لأي حد يقدر يبعت POST مزيف لنفس الرابط).

import crypto from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`متغير البيئة ${name} غير مضبوط — لسا ما ربطنا NOWPayments فعلياً.`);
  return value;
}

/** يفرز مفاتيح الكائن أبجدياً بشكل متكرر (recursive) — نفس خوارزمية NOWPayments بالضبط */
function sortObjectDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortObjectDeep);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function computeIpnSignature(secret, payload) {
  const sorted = sortObjectDeep(payload);
  const hmac = crypto.createHmac("sha512", secret);
  hmac.update(JSON.stringify(sorted));
  return hmac.digest("hex");
}

export const nowPaymentsAdapter = {
  code: "nowpayments",
  supportsAutoRenew: false, // ندعم Custody لاحقاً لو دعمت اشتراكات متكررة فعلية؛ حالياً كل دفعة فاتورة مستقلة

  async createCheckout({ invoice, plan }) {
    const apiKey = requireEnv("NOWPAYMENTS_API_KEY");
    const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");

    const res = await fetch(`${API_BASE}/invoice`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: plan.amount,
        price_currency: "usd",
        order_id: invoice.id,
        order_description: plan.name || "Qais Trading Academy subscription",
        ipn_callback_url: `${appUrl}/api/webhook/nowpayments`,
        success_url: `${appUrl}/payment-success?type=subscription`,
        cancel_url: `${appUrl}/payment`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "تعذر إنشاء فاتورة NOWPayments");
    }

    return { mode: "redirect", url: data.invoice_url, externalRef: String(data.id) };
  },

  /**
   * يتحقق من توقيع الـ IPN ويرجّع حدث موحّد، أو null لو التوقيع غلط.
   * bodyText: الجسم الخام (raw) متل ما وصل بالضبط — لازم نستخدمه لإعادة
   * التوقيع بدل ما نعتمد على الكائن المحلَّل (JSON.parse قد يغيّر ترتيب/شكل النص).
   */
  async verifyAndParseWebhookRaw(bodyText, headers) {
    const secret = requireEnv("NOWPAYMENTS_IPN_SECRET");
    const signature = headers.get("x-nowpayments-sig");
    if (!signature) return null;

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return null;
    }

    const expected = computeIpnSignature(secret, payload);
    if (expected !== signature) return null;

    return {
      invoiceId: payload.order_id || null,
      externalRef: String(payload.payment_id || payload.id || ""),
      status: payload.payment_status, // waiting | confirming | confirmed | sending | partially_paid | finished | failed | refunded | expired
      amount: payload.price_amount,
      raw: payload,
    };
  },

  async cancelSubscription() {
    return null; // لا يوجد اشتراك متكرر فعلي بهاد المزوّد حالياً
  },
};
