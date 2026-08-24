import { NextResponse } from "next/server";
import { redactSecrets } from "@/lib/redact";

/* ============================================================================
   lib/api-guard.js — مسار API ما بيرجّع HTML أبداً.

   ---------------------------------------------------------------------------
   ⚠️ الفجوة اللي بيسدّها:

   مسارات الدفع كانت كلها بتحرس `startCheckout` بـ`try/catch` وترجّع JSON —
   بس السطرين اللي **قبلها** كانوا مكشوفين:

       const supabase = createClient();                    // بيقرا متغيرات بيئة
       const { data: { user } } = await supabase.auth.getUser();   // رحلة شبكية

   أي رمية هون (متغيّر بيئة ناقص، فشل شبكة لخادم المصادقة، أو `data` راجعة
   `null` فالتفكيك بينهار) بتطلع **بلا ماسك** — وNext بيردّ صفحة خطأ HTML.
   والواجهة بتناديها بـ`res.json()` فبتشوف `Unexpected token '<'` بدل السبب.

   الحارس بيلفّ الهاندلر كله فبيصير أي انهيار **JSON برمز ٥٠٠**.

   ---------------------------------------------------------------------------
   ⚠️ ما بيغطّي الحالات اللي الهاندلر ما بيوصلها أصلاً — مهلة تنفيذ المنصّة
   (٥٠٤)، أو مسار مش موجود بالنسخة المنشورة (٤٠٤). هدولا بيضلوا HTML من
   المنصّة، وبينكشفوا من الطرف التاني: `readJson` بـ`lib/http-json.js` بتطلّع
   **رقم الحالة** بالرسالة. الطبقتان معاً بيغطوا الصنفين.
   ============================================================================ */

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️ **Next بيستعمل الاستثناءات كتحكّم داخلي — وهدول ممنوع تنبلع.**
   ---------------------------------------------------------------------------
   `redirect()` و`notFound()` بينفّذوا برمي استثناء عليه `digest` مخصوص، و
   قراءة `cookies()` وقت البناء بترمي `DYNAMIC_SERVER_USAGE` عشان Next يعرف
   إنّ المسار ديناميكي.

   أول نسخة من الحارس كانت بتمسك **كل شي**، فطلعت بسجلّ البناء:

       [api-auth] getUser رمى: Dynamic server usage: Route /api/payments/status
       couldn't be rendered statically because it used `cookies`

   يعني الحارس كان يبلع إشارة داخلية لـNext ويرجّع ٥٠٠ محلها. بهالنسخة
   المسارات طلعت ديناميكية بأي حال فما صار ضرر، بس `redirect()` جوّا مسار
   ملفوف كان بينقلب رد خطأ بدل ما يحوّل — عطل صامت بانتظار أول استعمال.

   فبينمرقوا كما هم، والحارس بيمسك الأخطاء الحقيقية وبس.
   ═══════════════════════════════════════════════════════════════════════════ */
const NEXT_DIGESTS = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "DYNAMIC_SERVER_USAGE"];

/** هل هاد استثناء تحكّم من Next (مش خطأ فعلي)؟ */
export function isNextControlFlow(e) {
  const digest = e?.digest;
  return typeof digest === "string" && NEXT_DIGESTS.some((d) => digest.startsWith(d));
}

/**
 * بيلفّ هاندلر Route ليضمن رد JSON بكل الحالات.
 * @param {(request: Request, ctx?: any) => Promise<Response>} fn
 */
export function jsonHandler(fn) {
  return async function guardedHandler(request, ctx) {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (isNextControlFlow(e)) throw e;
      // بينكتب بسجلّ الخادم كامل — الرد بياخد الرسالة وبس، بلا stack.
      console.error(`[api-guard] انهيار غير متوقَّع بـ ${request?.method} ${request?.url}:`, e);
      return NextResponse.json(
        { error: "خطأ غير متوقَّع بالخادم", detail: redactSecrets(e?.message || String(e)) },
        { status: 500 }
      );
    }
  };
}
