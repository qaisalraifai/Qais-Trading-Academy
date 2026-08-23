import { NextResponse } from "next/server";

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

/**
 * بيلفّ هاندلر Route ليضمن رد JSON بكل الحالات.
 * @param {(request: Request, ctx?: any) => Promise<Response>} fn
 */
export function jsonHandler(fn) {
  return async function guardedHandler(request, ctx) {
    try {
      return await fn(request, ctx);
    } catch (e) {
      // بينكتب بسجلّ الخادم كامل — الرد بياخد الرسالة وبس، بلا stack.
      console.error(`[api-guard] انهيار غير متوقَّع بـ ${request?.method} ${request?.url}:`, e);
      return NextResponse.json(
        { error: "خطأ غير متوقَّع بالخادم", detail: e?.message || String(e) },
        { status: 500 }
      );
    }
  };
}
