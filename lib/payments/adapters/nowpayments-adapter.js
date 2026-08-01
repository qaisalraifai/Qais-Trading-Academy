// Adapter كريبتو تلقائي عبر NOWPayments — تفعيل فوري بدون مراجعة أدمن،
// وبواجهة داخل موقعنا بالكامل (بدون تحويل الطالب لصفحة خارجية).
// التوثيق: https://documenter.getpostman.com/view/7907941/2s93JusNJt
//
// آلية الشغل (Direct Payment API، مو Hosted Invoice):
//   1) الطالب يختار عملة كريبتو من واجهتنا (createCheckout بترجع قائمة
//      عملات ثابتة مدعومة، بدون أي نداء API بعد).
//   2) بعد الاختيار، createPaymentForCurrency بينشئ "Payment" فعلي عند
//      NOWPayments ويحط invoice.id بحقل order_id، وبيرجع عنوان محفظة +
//      مبلغ محدد نعرضهم إحنا بواجهتنا (QR، نسخ العنوان...) — تماماً متل
//      شاشة الدفع اليدوي، بس المزوّد هو يلي بيتحقق من الشبكة تلقائياً.
//   3) لما تتغير حالة الدفع، NOWPayments بترسل IPN (POST) لرابط الـ webhook
//      تبعنا مع توقيع HMAC-SHA512 بالهيدر x-nowpayments-sig، لازم نتحقق منه
//      قبل ما نصدّق المحتوى (لأي حد يقدر يبعت POST مزيف لنفس الرابط).

import crypto from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

// قائمة العملات المعروضة للطالب — عدّل هون لو بدك تضيف/تحذف عملة. الأكواد
// لازم تطابق أكواد NOWPayments بالضبط (GET /v1/currencies لكل القائمة الكاملة).
export const SUPPORTED_CURRENCIES = [
  { code: "usdttrc20", label: "USDT", network: "TRC20 (Tron)" },
  { code: "usdtbsc", label: "USDT", network: "BEP20 (BNB Chain)" },
  { code: "btc", label: "Bitcoin", network: "BTC" },
  { code: "eth", label: "Ethereum", network: "ERC20" },
  { code: "trx", label: "TRON", network: "TRX" },
];

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
  supportsAutoRenew: false, // ندعم Custody لاحقاً لو دعمت اشتراكات متكررة فعلية؛ حالياً كل دفعة عملية مستقلة

  /**
   * ما بينادي NOWPayments أبداً بهاي المرحلة — بس بيرجّع قائمة العملات
   * حتى نعرضها بواجهتنا ونخلي الطالب يختار قبل ما ننشئ عملية دفع فعلية.
   */
  async createCheckout() {
    return { mode: "crypto_select", currencies: SUPPORTED_CURRENCIES };
  },

  /**
   * بعد ما الطالب يختار عملة، هاي بتنشئ عملية دفع فعلية عند NOWPayments
   * وترجع عنوان محفظة + مبلغ محدد نعرضهم إحنا بواجهتنا مباشرة.
   */
  async createPaymentForCurrency({ invoice, plan, payCurrency }) {
    const apiKey = requireEnv("NOWPAYMENTS_API_KEY");
    const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");

    const res = await fetch(`${API_BASE}/payment`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: plan.amount,
        price_currency: "usd",
        pay_currency: payCurrency,
        order_id: invoice.id,
        order_description: plan.name || "Qais Trading Academy subscription",
        ipn_callback_url: `${appUrl}/api/webhook/nowpayments`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "تعذر إنشاء عملية الدفع عند NOWPayments");
    }

    return {
      paymentId: String(data.payment_id),
      payAddress: data.pay_address,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
      payinExtraId: data.payin_extra_id || null, // بعض العملات بتحتاج Memo/Tag إضافي
      network: data.network || null,
      expiresAt: data.expiration_estimate_date || null,
    };
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
