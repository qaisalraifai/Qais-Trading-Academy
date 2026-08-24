import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_CODES,
  AUTH_MESSAGES,
  classifyAuthError,
  classifyThrownAuthError,
  statusForAuthCode,
} from "./auth-error-codes.js";

/* ============================================================================
   تصنيف حالة الجلسة.

   الأشكال تحت **مأخوذة من `@supabase/auth-js` نفسها** (نسخة 2.65.0) مش
   مخترعة: `AuthSessionMissingError` بـ`lib/errors.js`، وأكواد `bad_jwt` و
   `session_not_found` و`refresh_token_not_found` بـ`lib/error-codes.d.ts`.
   ============================================================================ */

test("جلسة سليمة → ما في تصنيف خطأ", () => {
  assert.equal(classifyAuthError(null, true), null);
  assert.equal(classifyAuthError({ name: "AuthApiError" }, true), null);
});

test("١) ما في جلسة → AUTH_MISSING", () => {
  // الشكل الحقيقي: AuthSessionMissingError('Auth session missing!', ..., 400)
  assert.equal(
    classifyAuthError({ name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 }, false),
    AUTH_CODES.MISSING
  );
  assert.equal(classifyAuthError({ code: "session_not_found" }, false), AUTH_CODES.MISSING);
  // بلا خطأ وبلا مستخدم = ما في جلسة كمان
  assert.equal(classifyAuthError(null, false), AUTH_CODES.MISSING);
});

test("٢) توكن منتهي → AUTH_EXPIRED", () => {
  assert.equal(
    classifyAuthError({ code: "bad_jwt", status: 401, message: "JWT expired" }, false),
    AUTH_CODES.EXPIRED
  );
  assert.equal(classifyAuthError({ code: "refresh_token_not_found" }, false), AUTH_CODES.EXPIRED);
  assert.equal(classifyAuthError({ message: "Invalid Refresh Token: Already Used" }, false), AUTH_CODES.EXPIRED);
  assert.equal(classifyAuthError({ code: "otp_expired" }, false), AUTH_CODES.EXPIRED);
});

test("٣) توكن غير صالح → AUTH_INVALID", () => {
  assert.equal(
    classifyAuthError({ code: "bad_jwt", status: 401, message: "invalid JWT: unable to parse or verify signature" }, false),
    AUTH_CODES.INVALID
  );
});

test("٤) 🔴 خادم المصادقة ما ردّ → AUTH_UNAVAILABLE مش «غير مسجل دخول»", () => {
  /* أهم تمييز بالملف. لو انصنّف ٤٠١، الواجهة بتنظّف الجلسة وبتطلّع مستخدماً
     **مسجَّلاً فعلاً** برّا على عطل شبكة لحظي. */
  assert.equal(
    classifyAuthError({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 }, false),
    AUTH_CODES.UNAVAILABLE
  );
  assert.equal(classifyAuthError({ status: 500, message: "Internal" }, false), AUTH_CODES.UNAVAILABLE);
  assert.equal(classifyAuthError({ status: 503 }, false), AUTH_CODES.UNAVAILABLE);
});

test("⚠️ المجهول بينزل لـINVALID — الافتراضي مقفول", () => {
  assert.equal(classifyAuthError({ message: "something nobody expected" }, false), AUTH_CODES.INVALID);
  assert.equal(classifyAuthError({}, false), AUTH_CODES.INVALID);
});

test("خدمة واقفة = ٥٠٣ · مشكلة توكن = ٤٠١", () => {
  assert.equal(statusForAuthCode(AUTH_CODES.UNAVAILABLE), 503);
  for (const c of [AUTH_CODES.MISSING, AUTH_CODES.EXPIRED, AUTH_CODES.INVALID]) {
    assert.equal(statusForAuthCode(c), 401, c);
  }
});

test("كل رمز إله رسالة عربية — ما في undefined بيوصل المستخدم", () => {
  for (const code of Object.values(AUTH_CODES)) {
    const msg = AUTH_MESSAGES[code];
    assert.equal(typeof msg, "string", code);
    assert.ok(msg.length > 5, `${code} رسالته فاضية`);
  }
});

/* ══════════════ رميات getUser — سبب انهيار الإنتاج ══════════════ */

test("🔴 كوكي مكسور → INVALID مش UNAVAILABLE — وإلا بينحبس المستخدم", () => {
  /* الرمية الحقيقية المسجَّلة من @supabase/ssr وقت تشخيص الانهيار:
       Error: Invalid Base64-URL character "@" at position 0
     كوكي مكسور **ما بينصلح بالانتظار**. لو انصنّف UNAVAILABLE بتطلع للمستخدم
     «جرّب بعد شوي» فبيضل يجرّب على كوكي ما رح يتغيّر. INVALID بتوجّهه لتسجيل
     دخول جديد — وهاد بيكتب كوكي سليم فوقه فبيشفى لحاله. */
  const real = new Error('Invalid Base64-URL character "@" at position 0');
  assert.equal(classifyThrownAuthError(real), AUTH_CODES.INVALID);

  for (const m of [
    "Unexpected token < in JSON at position 0",
    "Unexpected end of JSON input",
    "malformed cookie value",
    "InvalidCharacterError: atob failed",
  ]) {
    assert.equal(classifyThrownAuthError(new Error(m)), AUTH_CODES.INVALID, m);
  }
});

test("رمية مش متعلّقة بالفكّ → UNAVAILABLE (الانتظار بينفع هون)", () => {
  assert.equal(classifyThrownAuthError(new Error("fetch failed")), AUTH_CODES.UNAVAILABLE);
  assert.equal(classifyThrownAuthError(new Error("ECONNREFUSED")), AUTH_CODES.UNAVAILABLE);
  assert.equal(classifyThrownAuthError(undefined), AUTH_CODES.UNAVAILABLE);
  assert.equal(
    classifyThrownAuthError(new Error("Your project's URL and Key are required")),
    AUTH_CODES.UNAVAILABLE
  );
});

test("ترتيب الأولوية: `status >= 500` بيسبق مطابقة نص «expired»", () => {
  /* خادم بيرجّع ٥٠٠ ورسالته صدفةً فيها الكلمة → المشكلة بالخدمة مش بالتوكن. */
  assert.equal(
    classifyAuthError({ status: 500, message: "upstream said token expired" }, false),
    AUTH_CODES.UNAVAILABLE
  );
});
