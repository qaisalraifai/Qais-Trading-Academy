import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "./redact.js";

/* ============================================================================
   `detail` بردود الخطأ بيطلع للعميل. هدول الحراس بيتأكدوا إنه ما بيحمل توكناً
   ولا مفتاحاً — حتى لو الرسالة إجت من مكان ما توقّعناه.
   ============================================================================ */

/** توكن بشكل JWT حقيقي (نفس شكل توكنات Supabase). */
const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9." +
  "dQw4w9WgXcQ_signature_part_here";

test("🔴 توكن JWT ما بيطلع بالرد", () => {
  const out = redactSecrets(`فشل الطلب بالتوكن ${JWT} عند الخادم`);
  assert.ok(!out.includes("eyJhbGci"), "المقطع الأول لسا ظاهر");
  assert.ok(!out.includes("service_role"), "الحمولة لسا ظاهرة");
  assert.ok(out.includes("[توكن محذوف]"));
});

test("🔴 مفاتيح Supabase الجديدة بتنمسح", () => {
  const out = redactSecrets("apikey sb_secret_abc123XYZ_longkey فشل");
  assert.ok(!out.includes("sb_secret_abc123XYZ_longkey"));
});

test("🔴 ترويسة Authorization / apikey بتنمسح", () => {
  for (const s of [
    "Authorization: Bearer abc.def.ghi",
    "apikey=SUPER_SECRET_VALUE",
    "x-api-key: 9f8e7d6c5b4a",
  ]) {
    const out = redactSecrets(s);
    assert.ok(/\[محذوف\]/.test(out), `ما انمسح: ${s} → ${out}`);
  }
});

test("🔴 بارامترات حسّاسة بالروابط بتنمسح", () => {
  const out = redactSecrets(
    "GET https://x.supabase.co/auth/v1/user?access_token=abc123&refresh_token=zzz999 فشل"
  );
  assert.ok(!out.includes("abc123"));
  assert.ok(!out.includes("zzz999"));
});

test("🔴 بيانات اعتماد داخل رابط بتنمسح", () => {
  const out = redactSecrets("connect failed: postgres://admin:s3cr3tpw@db.host:5432/app");
  assert.ok(!out.includes("s3cr3tpw"), out);
});

test("🔴 أي سلسلة طويلة بشكل مفتاح بتنمسح", () => {
  const key = "A".repeat(64);
  assert.ok(!redactSecrets(`key ${key} invalid`).includes(key));
});

test("الطول مسقوف — ما بيطلع جسم رد كامل", () => {
  const out = redactSecrets("خطأ ".repeat(500));
  assert.ok(out.length <= 301, `الطول ${out.length}`);
  assert.ok(out.endsWith("…"));
});

test("الرسائل العادية بتضل مقروءة — الغسل مش تعمية", () => {
  /* لو غسلنا كل شي رجعنا لـ«خطأ غير متوقَّع» بلا خيط، وهاد بالضبط اللي
     بدنا نتجنّبه. هدول لازم يوصلوا كما هم. */
  for (const s of [
    "Dynamic server usage: Route /api/x used cookies",
    'duplicate key value violates unique constraint "profiles_pkey"',
    "fetch failed",
    "Your project's URL and Key are required to create a Supabase client!",
    'Invalid Base64-URL character "@" at position 0',
  ]) {
    assert.equal(redactSecrets(s), s, `انغسل بالغلط: ${s}`);
  }
});

test("مدخلات مش نصّية ما بتكسر", () => {
  assert.equal(redactSecrets(null), "");
  assert.equal(redactSecrets(undefined), "");
  assert.equal(redactSecrets(42), "42");
});
