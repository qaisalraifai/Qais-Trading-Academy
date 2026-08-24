/* ============================================================================
   lib/route-access.js — سياسة الوصول للمسارات. وحدة **نقيّة** بلا أي تبعية.

   ---------------------------------------------------------------------------
   انفصلت عن `middleware.js` عشان تنفحص. الـmiddleware بيستورد منها ولا بيعرّف
   ولا مسار عنده، فما بيقدروا يتناقضوا.

   طبقتان:
     · `SESSION_PATHS`      — جلسة مطلوبة، بلا شرط اشتراك.
     · `SUBSCRIPTION_PATHS` — جلسة + `subscription_status === "active"`.

   وكل شي مش بالقائمتين = **عام**.

   ⚠️ **كل صفحة غير عامة بتفحص الجلسة بنفسها وبتحوّل لـ/login** — فالمصادقة
   مضمونة بالصفحات أصلاً. اللي بتضيفه هالسياسة:
     · طبقة الجلسة: قطع الرحلة قبل رسم الصفحة. **بلا كلفة زيادة** —
       `auth.getUser()` بينفّذ بالـmiddleware أصلاً لكل انتقال.
     · طبقة الاشتراك: **بتكلّف استعلام `profiles` زيادة** لكل انتقال، فما
       بتنحط إلا على محتوى مدفوع.
   ============================================================================ */

/** جلسة مطلوبة، **بلا** شرط اشتراك. */
export const SESSION_PATHS = [
  /* 🔴 مسارات الدفع لازم تضل مفتوحة لحساب `inactive` — هون بيروح ليدفع.
        حطّها بطبقة الاشتراك = حلقة تحويل مقفلة وما بيقدر يشترك أبداً.
        (محروسة باختبار — شوفي `route-access.test.js`) */
  "/payment",
  "/payment-success",
  // إدارة الحساب لازم توصلها حتى لو الاشتراك واقف
  "/settings",
  // تهيئة أول دخول
  "/select-batch",
  "/choose",
  /* لوحات الإدارة: الفرض الفعلي بمسارات `/api/admin` (٦٤/٦٤ فيها
     `requireAdmin`) وبتحويل من طرف العميل. هون بس بنمنع رسم الشِل لزائر
     بلا جلسة — مش مكان فرض دور الأدمن. */
  "/admin",
];

/** جلسة + اشتراك فعّال — محتوى الأعضاء المدفوع. */
export const SUBSCRIPTION_PATHS = [
  // كانت موجودة من قبل هالجولة
  "/dashboard",
  "/lecture",
  "/course",
  "/quiz",
  "/backtest",
  "/replay",
  "/affiliate",
  /* ⚠️ ما إلها صفحة حالياً. انتركت عمداً: لو انضافت صفحة `/discord` بعدين
        بتكون محمية من أول يوم بدل ما تنكشف لحد ما حدا ينتبه. */
  "/discord",
  // انضافت هالجولة — كلها جوّا مجموعة `(shell)` يعني منطقة الأعضاء
  "/trading-radar",
  "/market-intelligence",
  "/reports",
  "/trader-dna",
  "/economic-calendar",
  "/live-sessions",
  "/ai-trades",
  "/courses",
  "/accounts",
  "/mlm",
];

/**
 * مطابقة **على حدود المقاطع**.
 *
 * ⚠️ القديم كان `pathname.startsWith(p)` خام، فمدخل `/course` كان يطابق
 * `/courses` كمان — يعني صفحة كانت محمية **بالصدفة**، وأي مسار جديد بيبلّش
 * بنفس الحروف بيندرج بلا قصد. هيك القائمة بتقول اللي بتقصده حرفياً.
 */
export function matchesPath(pathname, list) {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** طبقة الوصول لمسار: `"public"` · `"session"` · `"subscription"`. */
export function accessTierFor(pathname) {
  if (pathname.startsWith("/api")) return "public"; // مسارات API بتحرس حالها
  if (matchesPath(pathname, SUBSCRIPTION_PATHS)) return "subscription";
  if (matchesPath(pathname, SESSION_PATHS)) return "session";
  return "public";
}
