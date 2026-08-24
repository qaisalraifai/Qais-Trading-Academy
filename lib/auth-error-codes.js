/* ============================================================================
   lib/auth-error-codes.js — تصنيف حالة الجلسة. وحدة **نقيّة** بلا أي تبعية.

   ---------------------------------------------------------------------------
   انفصلت عن `lib/api-auth.js` (اللي بيستورد `next/server`) عشان تنفحص
   بـ`node --test` بلا ما تجرّ Next معها.

   ⚠️ المشكلة اللي بتحلّها: كل مسار كان بيلمّ **أربع حالات مختلفة** برسالة
   وحدة «غير مسجل دخول». وأخطرهن الرابعة: عطل شبكة لحظي لخادم المصادقة كان
   يطلع للمستخدم كأنه مش مسجَّل، فالواجهة بتطلّعه برّا وهو أصلاً داخل.
   ============================================================================ */

export const AUTH_CODES = {
  MISSING: "AUTH_MISSING",
  EXPIRED: "AUTH_EXPIRED",
  INVALID: "AUTH_INVALID",
  UNAVAILABLE: "AUTH_UNAVAILABLE",
};

export const AUTH_MESSAGES = {
  [AUTH_CODES.MISSING]: "ما في جلسة — لازم تسجّل دخول",
  [AUTH_CODES.EXPIRED]: "الجلسة انتهت — سجّل دخول من جديد",
  [AUTH_CODES.INVALID]: "الجلسة مش صالحة — سجّل دخول من جديد",
  [AUTH_CODES.UNAVAILABLE]: "خدمة المصادقة مش متاحة حالياً — جرّب بعد شوي",
};

/** رمز الحالة لكل صنف: مشكلة توكن = ٤٠١ · خدمة واقفة = ٥٠٣ (مش غلط المستخدم). */
export function statusForAuthCode(code) {
  return code === AUTH_CODES.UNAVAILABLE ? 503 : 401;
}

/**
 * بيصنّف خطأ `auth.getUser()` لواحد من `AUTH_CODES`، أو `null` لو الجلسة سليمة.
 *
 * ⚠️ الترتيب مقصود: `error.code` أول (أدق ما بتعطيه المكتبة)، وبعدين
 * `error.name`، وبعدين رقم الحالة، وآخر شي مطابقة نصّية. وأي شي ما انعرف
 * بينزل لـ`INVALID` — **الافتراضي مقفول**، ما بيمرّق مجهولاً.
 *
 * @param {any} error الخطأ الراجع من المكتبة (مرجَّع مش مرمي)
 * @param {boolean} hasUser هل رجع مستخدم فعلاً
 */
export function classifyAuthError(error, hasUser) {
  if (hasUser) return null;
  if (!error) return AUTH_CODES.MISSING; // بلا خطأ وبلا مستخدم = ما في جلسة

  const code = error.code || "";
  const name = error.name || "";
  const status = error.status;
  const msg = String(error.message || "");

  // ١) خادم المصادقة ما ردّ — مش مشكلة توكن
  if (name === "AuthRetryableFetchError") return AUTH_CODES.UNAVAILABLE;
  if (typeof status === "number" && status >= 500) return AUTH_CODES.UNAVAILABLE;

  // ٢) ما في جلسة
  if (name === "AuthSessionMissingError") return AUTH_CODES.MISSING;
  if (code === "session_not_found") return AUTH_CODES.MISSING;

  // ٣) انتهت — التوكن نفسه، أو توكن التجديد
  if (code === "refresh_token_not_found") return AUTH_CODES.EXPIRED;
  if (/expired/i.test(code)) return AUTH_CODES.EXPIRED;
  if (/jwt expired|token (has )?expired|invalid refresh token/i.test(msg)) return AUTH_CODES.EXPIRED;

  // ٤) مش صالح — والافتراضي كمان
  return AUTH_CODES.INVALID;
}

/* ═══════════════════════════════════════════════════════════════════════════
   🔴 **رميات `getUser()` — وهون كان سبب انهيار الإنتاج.**
   ---------------------------------------------------------------------------
   `getUser()` بترجّع أخطاء المصادقة بدل ما ترميها… **إلا لما الكوكي نفسه ما
   ينفكّ**. وقتها الرمية بتطلع من جوّا المكتبة:

       Error: Invalid Base64-URL character "@" at position 0
         at stringFromBase64URL (@supabase/ssr/utils/base64url.js)
         at getItem (@supabase/ssr/cookies.js)
         at __loadSession → _useSession → _getUser → getUser

   وبالكود القديم هالرمية كانت **برّا أي try** فبتطلّع صفحة خطأ HTML:
   `/api/payments/checkout` رجّعت ٥٠٠ بلا JSON، و`/dashboard` رجّعت ٥٠٠ HTML.
   (متحقَّق بالتشغيل مقابل نسخة 1f225ba.)

   ---------------------------------------------------------------------------
   ⚠️ **والتصنيف لازم يفرّق** — أول نسخة من الحارس كانت بتحطّهن كلهن
   `UNAVAILABLE`، يعني بتقول للمستخدم «جرّب بعد شوي». بس كوكي مكسور **ما
   بينصلح بالانتظار**: بيضل مكسور لحد ما ينكتب كوكي جديد. فالمستخدم بينحبس.

   الصح: خلل بفكّ الكوكي = **جلسة غير صالحة** → «سجّل دخول من جديد» →
   تسجيل الدخول بيكتب كوكي سليم فوقه → **بيشفى لحاله**.
   وخادم ما ردّ = `UNAVAILABLE` فعلاً، لأن الانتظار **بينفع** هناك.
   ═══════════════════════════════════════════════════════════════════════════ */

/** بصمات فشل فكّ الكوكي/الجلسة — مش أعطال شبكة. */
const DECODE_FAILURE = /base64|JSON|Unexpected token|Unexpected end of|malformed|invalid character|atob/i;

/**
 * بيصنّف استثناء **مرمي** من `getUser()` (مش الخطأ المرجَّع).
 * @param {any} e
 */
export function classifyThrownAuthError(e) {
  const text = `${e?.name || ""} ${e?.message || ""}`;
  if (DECODE_FAILURE.test(text)) return AUTH_CODES.INVALID;
  return AUTH_CODES.UNAVAILABLE;
}
