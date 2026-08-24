/* ============================================================================
   lib/signup-guard.js — إثبات ملكية `userId` وقت التسجيل. وحدة **نقيّة**.

   ---------------------------------------------------------------------------
   🔴 المشكلة: `/api/create-profile` بياخد `userId` من **جسم الطلب** ويشتغل
   بمفتاح الخدمة (بيتجاوز RLS). وما بيقدر يشترط جلسة، لأنه بينندى مباشرة بعد
   `supabase.auth.signUp()` — ولما تفعيل الإيميل مطلوب، `signUp` بترجّع
   مستخدماً **بلا جلسة**.

   المسار الحيّ (`app/signup/page.js`):
       signUp() → POST /api/create-profile → signInWithPassword() → /payment

   و`admin.getUserById(userId)` لحاله **ما بيثبت الملكية** — بيثبت إنّ المعرّف
   موجود وبس. فأي حدا بيعرف معرّف حساب ما إله بروفايل كان يقدر يحجزله اسماً
   ويربطه بكود إحالته (سرقة عمولة). مقيس فعلياً قبل الإصلاح.

   ---------------------------------------------------------------------------
   بوابتان، والأقوى بتسبق:

   ١) **جلسة موجودة → لازم تطابق.** لما تفعيل الإيميل مطفي، `signUp` بتعطي
      جلسة فوراً — إثبات كامل ومجاني.

   ٢) **ما في جلسة → الحساب لازم يكون جديد جداً.** المعرّف UUIDv4 عشوائي فما
      بينعرف إلا لمين أنشأه؛ وربطه بنافذة دقائق معناها إنّ المهاجم لازم
      **يخمّن UUID عشوائياً أُنشئ قبل دقائق**. أما معرّف حساب قديم — وهو
      الخطر الحقيقي — فبينرفض.

   ⚠️ `sessionUserId === null` معناها **«ما قدرنا نتأكد»** مش «مش صاحبه»:
   كوكي مكسور أو خادم مصادقة ما ردّ بينزلوا لبوابة الحداثة، ما بينرفضوا
   مباشرة. وإلا صار عطل شبكة لحظي بيكسر التسجيل.
   ============================================================================ */

/** نافذة «الحساب لسا جديد» — سخيّة لشبكة بطيئة، ضيّقة على مهاجم. */
export const SIGNUP_WINDOW_MS = 10 * 60 * 1000;

export const SIGNUP_VERDICT = {
  OK: "ok",
  SESSION_MISMATCH: "session_mismatch",
  WINDOW_EXPIRED: "window_expired",
};

/**
 * هل المنادي يقدر يثبت إنه صاحب `requestedUserId`؟
 *
 * @param {object} p
 * @param {string|null} p.sessionUserId   معرّف الجلسة، أو null لو ما تأكدنا
 * @param {string}      p.requestedUserId المعرّف الجاي بجسم الطلب
 * @param {string|null} p.createdAt       `created_at` من `admin.getUserById`
 * @param {number}     [p.now]            للاختبار
 * @param {number}     [p.windowMs]       للاختبار
 * @returns {string} واحد من `SIGNUP_VERDICT`
 */
export function signupOwnershipVerdict({
  sessionUserId,
  requestedUserId,
  createdAt,
  now = Date.now(),
  windowMs = SIGNUP_WINDOW_MS,
}) {
  if (sessionUserId) {
    return sessionUserId === requestedUserId
      ? SIGNUP_VERDICT.OK
      : SIGNUP_VERDICT.SESSION_MISMATCH;
  }

  const created = Date.parse(createdAt ?? "");
  if (!Number.isFinite(created)) return SIGNUP_VERDICT.WINDOW_EXPIRED;

  const ageMs = now - created;
  /* ⚠️ العمر السالب (تاريخ إنشاء بالمستقبل — انحراف ساعة أو قيمة مدسوسة)
     بينرفض كمان. الشرط «جوّا النافذة» مش «أقل من النافذة». */
  if (ageMs < 0 || ageMs > windowMs) return SIGNUP_VERDICT.WINDOW_EXPIRED;

  return SIGNUP_VERDICT.OK;
}
