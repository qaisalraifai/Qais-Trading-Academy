import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { jsonHandler } from "@/lib/api-guard";
import { requireUser } from "@/lib/api-auth";
import { startCheckout } from "@/lib/payments/billing-service";

// POST /api/payments/checkout  { providerCode: "whop" | "manual_usdt" | ... }
// نقطة الدخول الموحّدة لبدء أي عملية دفع، بغض النظر عن المزوّد. بتحل محل
// app/api/checkout القديم (اللي ضل شغال لأجل التوافق ومربوط بنفس المنطق).
async function POSTImpl(request) {
  const limited = checkRateLimit(request, "payment");
  if (limited) return limited;

  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let providerCode;
  try {
    const body = await request.json();
    providerCode = body?.providerCode;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  if (!providerCode) {
    return NextResponse.json({ error: "لازم تحدد وسيلة الدفع" }, { status: 400 });
  }

  try {
    const { invoice, transaction, plan, checkout } = await startCheckout({ userId: user.id, providerCode });
    return NextResponse.json({
      invoiceId: invoice.id,
      transactionId: transaction.id,
      plan,
      checkout, // { mode: "embed"|"redirect"|"manual", ... } — الشكل يعتمد على المزوّد
    });
  } catch (e) {
    console.error("startCheckout failed:", e.message);
    return NextResponse.json({ error: e.message || "تعذر بدء عملية الدفع" }, { status: 502 });
  }
}

export const POST = jsonHandler(POSTImpl);
