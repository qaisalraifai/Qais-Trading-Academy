import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-server";
import { getProfileRow } from "@/lib/profile-cache";

// دالة مساعدة موحّدة: تجيب بيانات البروفايل اللازمة لتغليف أي صفحة بـ <AppShell>
// (الاسم، هل أدمن، أيام الاشتراك المتبقية) — تُستخدم من كل صفحات app/*/page.js
//
// بوابة اختيار الدفعة: أول ما يسجّل الطالب دخول، لازم يختار دفعته مرة وحدة
// (صفحة كاملة /select-batch) قبل ما يوصل لأي محتوى تاني بالمنصة — بث، دورات،
// إعلانات... إلخ. بما إنه هاي الدالة مستخدمة من كل صفحة تقريبًا، هي المكان
// المركزي المناسب للتحقق، بدل ما نكرر الفحص بكل صفحة لحالها.
// options.skipBatchGate=true بتستخدم بس من صفحة /select-batch نفسها (لتفادي
// حلقة تحويل لا نهائية) ومن صفحات الأدمن الخالصة.
/* ============================================================================
   نسخة خفيفة: بيانات البروفايل **بلا** بوابة الدفعة.

   ⚠️ ليش انبنت: بعد ما انتقل الغلاف للياوت `app/(shell)/layout.js`، صار
   اللياوت هو اللي بينفّذ بوابة الدفعة مرة وحدة. بس كم صفحة لسا بتحتاج
   البيانات نفسها **لمنطقها** هي — مثلاً `/accounts` بتفحص `isAdmin` عشان
   تحوّل غير الأدمن، و`/settings` بتمرّر الاسم للمكوّن.

   هدول لو ضلّوا ينادوا `getShellProfile` بينعيدوا بوابة الدفعة عبثاً =
   رحلة شبكية زايدة لكل فتحة. فهاي بتجيب صف `profiles` وبس.
   ============================================================================ */
/* ⚠️ الإيميل بديل **كسول** للاسم.
   -------------------------------------------------------------------------
   كان بينقرا من كائن `user` اللي جايي من `auth.getUser()` — يعني كل تحميل
   بيدفع تلك الرحلة الشبكية حتى لو الاسم موجود بالبروفايل (وهو موجود بالعادة).
   هلق الهوية بتيجي من ترويسة الـmiddleware المتحقَّقة (`getVerifiedUserId`)،
   والإيميل ما بينجلب إلا بالحالة النادرة اللي ما فيها اسم. */
async function usernameFor(supabase, profile) {
  if (profile?.username) return profile.username;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/* ⚠️ بتاخد **معرّف** مش كائن مستخدم كامل: الهوية صارت تيجي من ترويسة
   الـmiddleware المتحقَّقة (`getVerifiedUserId`)، فما عاد في كائن `user`
   بالصفحات — وهاد بالضبط المقصود، لأن بناءه كان يكلّف رحلة شبكية. */
export async function getProfileBasics(supabase, userId) {
  /* ⚠️ الصف بينجاب من `lib/profile-cache.js` — موحَّد لكل الطلب. اللياوت
     بينده `getShellProfile` وبعدها الصفحة بتنده هاي، فبلا التوحيد بيصيروا
     استعلامين لنفس الصف. مقيس بخط الأساس. */
  const profile = await getProfileRow(userId);

  const username = await usernameFor(supabase, profile);
  let daysLeft = null;
  if (profile?.subscription_end) {
    const diffMs = new Date(profile.subscription_end).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  return { username, isAdmin: profile?.role === "admin", daysLeft };
}

export async function getShellProfile(supabase, userId, options = {}) {
  /* ⚠️ الاستعلامان **متوازيان مش متسلسلين**.
     ---------------------------------------------------------------------
     `batch_enrollments` ما بتعتمد على نتيجة `profiles` — الاتنين بيسألوا
     عن `user.id` اللي معنا أصلاً. كانوا متسلسلين، يعني كل انتقال بين
     صفحات المنصّة بيدفع **رحلتين شبكيتين ورا بعض** لـSupabase بدل وحدة.

     الأدمن بيتخطّى بوابة الدفعة، فطلبه بينبعت بس لما يكون فيه احتمال
     نحتاجه — بننتظر نتيجته بعد ما نعرف الدور. هيك ما بنزيد حملاً على
     الأدمن، وبنوفّر رحلة كاملة على الطالب.

     ⚠️ ما تغيّر ولا سلوك: نفس الفحوصات ونفس التحويل لـ/select-batch. */
  const needsBatchGate = !options.skipBatchGate;
  /* ⚠️ `.catch` لازم هون: الأدمن بيتخطّى البوابة فما بينتظر هالوعد أبداً،
     ووعد مرفوض بلا مستمع بيرمي unhandledRejection ويوقّع العملية بالإنتاج.
     الفشل بينحوّل لـ`{count: null}` — يعني «ما قدرنا نتأكد»، وتحت بينعامل
     زي «ما في تسجيل» فبيحوّل لـ/select-batch: نفس سلوك ما قبل التعديل لما
     كان الاستعلام يفشل. */
  const enrollmentPromise = needsBatchGate
    ? createAdminClient()
        .from("batch_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .then((r) => r, () => ({ count: null }))
    : null;

  const profile = await getProfileRow(userId);

  const username = await usernameFor(supabase, profile);
  const isAdmin = profile?.role === "admin";

  if (needsBatchGate && !isAdmin) {
    const { count } = await enrollmentPromise;
    if (!count) redirect("/select-batch");
  }

  let daysLeft = null;
  if (profile?.subscription_end) {
    const diffMs = new Date(profile.subscription_end).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return { username, isAdmin, daysLeft, initials: (username || "؟").trim().charAt(0).toUpperCase() };
}
