import { runBillingCycle } from "@/lib/payments/billing-service";

// GET /api/cron/billing — يشتغل يومياً (راجع vercel.json)
// بيغطي كل المشتركين اللي وسيلة دفعهم ما فيها تجديد تلقائي (دفع يدوي USDT،
// ولاحقاً كريبتو تلقائي إذا ما دعم اشتراكات متكررة):
//   1) ينشئ فاتورة التجديد القادمة قبل الاستحقاق بأسبوع.
//   2) يرسل تذكير قبل 7 أيام، وتذكير قبل 3 أيام، وتنبيه يوم الاستحقاق.
//   3) يعلّق أي اشتراك خلصت فترة السماح تبعه بدون سداد.
// (اشتراكات Whop التلقائية ما بتتأثر — بتتجدد لحالها عبر الـ webhook.)
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBillingCycle();
    return Response.json({ success: true, ...result });
  } catch (e) {
    console.error("runBillingCycle failed:", e);
    return Response.json({ error: e.message || "billing cycle failed" }, { status: 500 });
  }
}
