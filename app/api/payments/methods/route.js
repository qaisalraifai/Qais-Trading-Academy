import { NextResponse } from "next/server";
import { listEnabledProviders } from "@/lib/payments/registry";

// يمنع Next.js من تجميد نتيجة هالـ route وقت البناء (Build Time) — لازم
// يقرأ من الداتابيس بكل طلب، لأنه تفعيل/تعطيل وسيلة دفع من لوحة الأدمن
// المفروض ينعكس فوراً بدون إعادة نشر (Redeploy) للموقع كامل.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/payments/methods
// بيرجع وسائل الدفع المفعّلة حالياً (يقرأها من جدول payment_providers) —
// صفحة /payment بتبني الأزرار حسب هاد الرد، فتفعيل/تعطيل وسيلة من لوحة
// الأدمن بينعكس فوراً على الواجهة بدون أي تعديل كود.
export async function GET() {
  const providers = await listEnabledProviders();
  return NextResponse.json({ providers });
}
