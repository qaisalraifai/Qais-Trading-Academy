import { NextResponse } from "next/server";
import { listEnabledProviders } from "@/lib/payments/registry";

// GET /api/payments/methods
// بيرجع وسائل الدفع المفعّلة حالياً (يقرأها من جدول payment_providers) —
// صفحة /payment بتبني الأزرار حسب هاد الرد، فتفعيل/تعطيل وسيلة من لوحة
// الأدمن بينعكس فوراً على الواجهة بدون أي تعديل كود.
export async function GET() {
  const providers = await listEnabledProviders();
  return NextResponse.json({ providers });
}
