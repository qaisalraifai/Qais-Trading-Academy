import { nowPaymentsAdapter } from "@/lib/payments/adapters/nowpayments-adapter";
import { markInvoicePaid } from "@/lib/payments/billing-service";

// حالات NOWPayments اللي معناها "استلمنا الفلوس فعلاً" — finished هي النهائية،
// confirmed كمان مقبولة (تأكيد على البلوكتشين قبل التحويل النهائي للرصيد)
const PAID_STATUSES = new Set(["finished", "confirmed"]);

// POST /api/webhook/nowpayments — رابط الـ IPN المسجّل بلوحة NOWPayments
export async function POST(request) {
  const bodyText = await request.text();

  const event = await nowPaymentsAdapter.verifyAndParseWebhookRaw(bodyText, request.headers).catch((e) => {
    console.error("nowpayments webhook verify failed:", e.message);
    return null;
  });

  if (!event) {
    // توقيع غلط أو مش مضبوط — منرفض بهدوء بدون ما نعطي تفاصيل تفيد مهاجم محتمل
    return new Response("invalid signature", { status: 401 });
  }

  console.log("NOWPayments IPN:", event.invoiceId, event.status);

  if (!PAID_STATUSES.has(event.status)) {
    // حالة وسيطة (waiting/confirming/sending...) — منسجلها بس ما منفعّل شي بعد
    return new Response("ok", { status: 200 });
  }

  if (!event.invoiceId) {
    console.error("nowpayments webhook: missing order_id/invoiceId in payload");
    return new Response("missing order_id", { status: 400 });
  }

  try {
    await markInvoicePaid({
      invoiceId: event.invoiceId,
      providerCode: "nowpayments",
      externalRef: event.externalRef,
      rawPayload: event.raw,
    });
  } catch (e) {
    console.error("markInvoicePaid (nowpayments) failed:", e.message);
    return new Response("processing error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
