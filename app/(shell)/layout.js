import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

/* ============================================================================
   app/(shell)/layout.js — الغلاف المشترك لكل صفحات المنصّة الداخلية.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنى: **الشِل كان مرسوماً جوّا كل صفحة، مش بلياوت.**

   كل صفحة كانت تعمل نفس الشي بالحرف:

       const supabase = createClient();
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) redirect("/login");
       const shellProfile = await getShellProfile(supabase, user);
       return <PageShell {...shellProfile}> … </PageShell>;

   ونتيجتها اتنتين:

   ١) **الإطار بينهدم وينعاد بناؤه بكل انتقال.** السايدبار والهيدر جزء من
      شجرة الصفحة، فلما تنتقل من صفحة لصفحة بتتفكّك كلها وتترسم من جديد —
      حتى لو البيانات جاهزة. هاد اللي بيخلّي التنقّل يبان «قفزة» مش انتقالاً.

   ٢) **`getShellProfile` بتنعاد مع كل انتقال.** وهي رحلتان لـSupabase
      (`profiles` و`batch_enrollments`)، فوق `auth.getUser()`.

   بـApp Router، اللياوت **ما بينعاد تنفيذه** لما تتنقّل بين صفحات تحته —
   الراوتر بيجيب الأجزاء المتغيّرة بس ويعيد استعمال اللياوت من ذاكرته. فنقل
   الشِل لهون بيحل التنتين مع بعض: الإطار بيضل ثابت، والفحوصات بتصير مرة
   وحدة بكل تحميل كامل بدل كل ضغطة رابط.

   ⚠️ مجموعة مسارات `(shell)` — الأقواس بتمنع ظهورها بالـURL. `/replay`
   بتضل `/replay` بالضبط. **ولا رابط تغيّر.**

   ⚠️ `select-batch` **مقصود إنها برّا** المجموعة: هي الوحيدة اللي بتمرّر
   `skipBatchGate`، ولو دخلت هون كانت بوابة الدفعة تحوّلها لنفسها = حلقة
   تحويل لا نهائية. بتضل حاملة غلافها الخاص.

   ⚠️ الأمان ما ضعف: الـmiddleware لسا بيفحص كل مسار محمي، وكل صفحة لسا
   بتجيب `user` لاستعلاماتها الخاصة. هاد الفحص **إضافي** مش بديل.
   ============================================================================ */
export default async function ShellLayout({ children }) {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — الفحص انعمل هناك أصلاً،
     وإعادته هون رحلة شبكية تانية لنفس الشي. بترجع لـ`auth.getUser()`
     لو الترويسة غابت (شوفي `lib/auth-context.js`). */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  const shellProfile = await getShellProfile(supabase, userId);

  return <PageShell {...shellProfile}>{children}</PageShell>;
}
