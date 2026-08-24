import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isNextControlFlow } from "@/lib/api-guard";
import {
  AUTH_CODES,
  AUTH_MESSAGES,
  classifyAuthError,
  classifyThrownAuthError,
  statusForAuthCode,
} from "@/lib/auth-error-codes";

/* ============================================================================
   lib/api-auth.js — حالة الجلسة بمسارات API، مصنَّفة ومسمّاة.

   ---------------------------------------------------------------------------
   ⚠️ المشكلة: كل مسار كان بيكتب نفس السطرين:

       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, 401);

   وهاد بيلمّ **أربع حالات مختلفة تماماً** برسالة وحدة:

     · ما في جلسة أصلاً        → لازم يسجّل دخول
     · التوكن انتهى             → لازم تجديد، وبيانات الحساب سليمة
     · التوكن مش صالح           → جلسة مكسورة، لازم تنظيف وتسجيل جديد
     · خادم المصادقة ما ردّ     → **مش غلط المستخدم إطلاقاً**

   والرابعة هي الخطيرة: عطل شبكة لحظي كان بيطلع للمستخدم كـ«غير مسجل دخول»،
   فالواجهة بتطلّعه برّا وهو أصلاً مسجَّل. بترجع ٥٠٣ بدل ٤٠١ فالواجهة بتعرف
   إنها تعيد المحاولة بدل ما تنظّف الجلسة.

   ---------------------------------------------------------------------------
   ⚠️ التصنيف بيقرا `error.code` أول (أدق ما بتعطيه المكتبة)، وبعدين
   `error.name`، وبعدين رقم الحالة، وآخر شي مطابقة نصّية. وأي شي ما انعرف
   بينزل لـ`AUTH_INVALID` — **الافتراضي مقفول**، ما بيمرّق مجهولاً.
   ============================================================================ */

// التصنيف والرسائل بـ`lib/auth-error-codes.js` — وحدة نقيّة مفحوصة.
export { AUTH_CODES, classifyAuthError };

/** رد JSON منظَّم لحالة مصادقة. */
export function authErrorResponse(code) {
  return NextResponse.json(
    { error: AUTH_MESSAGES[code], code },
    { status: statusForAuthCode(code) }
  );
}

/**
 * بيرجّع `{ user }` لو الجلسة سليمة، أو `{ response }` جاهز للإرجاع.
 *
 * الاستعمال:
 *   const auth = await requireUser();
 *   if (auth.response) return auth.response;
 *   const userId = auth.user.id;
 */
export async function requireUser() {
  let data, error;
  try {
    ({ data, error } = await createClient().auth.getUser());
  } catch (e) {
    // ⚠️ استثناءات تحكّم Next بتمرق كما هي — شوفي `lib/api-guard.js`.
    if (isNextControlFlow(e)) throw e;

    // `getUser` بترجّع أخطاء المصادقة بدل ما ترميها، فالرمية هون معناها
    // إشي أعمق (بناء العميل، متغيّر بيئة ناقص) — مش حالة توكن.
    // ⚠️ التصنيف بيفرّق بين كوكي مكسور (جلسة غير صالحة — بتشفى بتسجيل
    //    دخول) وخادم ما ردّ (بتشفى بالانتظار). شوفي `auth-error-codes.js`.
    console.error("[api-auth] getUser رمى:", e);
    return { response: authErrorResponse(classifyThrownAuthError(e)) };
  }

  const user = data?.user ?? null;
  const code = classifyAuthError(error, !!user);
  if (code) return { response: authErrorResponse(code) };
  return { user };
}
