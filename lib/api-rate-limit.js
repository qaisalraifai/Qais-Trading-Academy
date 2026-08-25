import { NextResponse } from "next/server";
import { hit, LIMITS } from "@/lib/rate-limit";

/* ============================================================================
   lib/api-rate-limit.js — الغلاف المربوط بـNext لمحدِّد المعدّل.

   المنطق النقي بـ`lib/rate-limit.js` (مفحوص). هون: استخراج معرّف العميل
   وبناء رد ٤٢٩.
   ============================================================================ */

/**
 * معرّف العميل. على Vercel `x-forwarded-for` بتنضبط من المنصّة والأول فيها
 * هو عنوان العميل.
 *
 * ⚠️ قابلة للتزوير مبدئياً بأي بيئة ما بتضبطها بوّابة موثوقة. مقبول: الغاية
 * رفع كلفة الإساءة لا منعها، والبديل الحقيقي حدّ على مستوى الحساب أو مخزَّن
 * مشترك — شوفي التعليق برأس `lib/rate-limit.js`.
 */
function clientId(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * بيفحص الحدّ. بيرجّع رد ٤٢٩ **لو تجاوز**، أو `null` لو مسموح.
 *
 * الاستعمال:
 *   const limited = checkRateLimit(request, "createProfile");
 *   if (limited) return limited;
 *
 * @param {Request} request
 * @param {keyof typeof LIMITS} bucket
 */
export function checkRateLimit(request, bucket) {
  const conf = LIMITS[bucket];
  if (!conf) return null; // اسم غلط ما بيقفل المسار — الفشل مفتوح هون عن قصد

  const result = hit(`${bucket}:${clientId(request)}`, conf);
  if (result.ok) return null;

  return NextResponse.json(
    {
      error: "طلبات كتير بوقت قصير — جرّب بعد شوي",
      code: "RATE_LIMITED",
      retryAfterSeconds: result.retryAfterSec,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}
