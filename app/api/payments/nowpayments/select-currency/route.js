import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { jsonHandler } from "@/lib/api-guard";
import { requireUser } from "@/lib/api-auth";
import { selectCryptoCurrency } from "@/lib/payments/billing-service";

// POST /api/payments/nowpayments/select-currency  { transactionId, payCurrency }
// بيرجع عنوان محفظة + مبلغ محدد نعرضهم مباشرة بواجهتنا (بدون أي تحويل خارجي)
async function POSTImpl(request) {
  const limited = checkRateLimit(request, "payment");
  if (limited) return limited;

  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const body = await request.json().catch(() => ({}));
  const { transactionId, payCurrency } = body || {};
  if (!transactionId || !payCurrency) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  try {
    const payment = await selectCryptoCurrency({ userId: user.id, transactionId, payCurrency });
    return NextResponse.json({ payment });
  } catch (e) {
    console.error("selectCryptoCurrency failed:", e.message);
    return NextResponse.json({ error: e.message || "تعذر إنشاء عملية الدفع" }, { status: 400 });
  }
}

export const POST = jsonHandler(POSTImpl);
