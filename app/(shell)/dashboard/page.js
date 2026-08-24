import { createClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getProfileRow } from "@/lib/profile-cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  /* ⚠️ الهوية من ترويسة الـmiddleware المتحقَّقة مش من `auth.getUser()`.
     -------------------------------------------------------------------------
     كانت الصفحة تعيد نفس الفحص اللي عمله الـmiddleware قبل شوي بنفس الطلب —
     رحلة شبكية كاملة لخادم Supabase لنتيجة موجودة أصلاً. مقيس: فتحة
     `/dashboard` كانت تكلّف `auth:user` **مرتين**.

     🔴 **نموذج الثقة ما ضعف.** `getVerifiedUserId` ما بتثق بالترويسة لأنها
     موجودة — بتثق فيها لأن الـmiddleware بيمسحها **بلا شرط** من كل طلب قبل
     أي فرع، وما بيكتبها إلا من `auth.getUser()` متحقَّقة. ولو غابت (مسار ما
     مرّ على الـmiddleware) بترجع للفحص الكامل. نفس الضمان بالضبط. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  const supabase = createClient();

  /* ⚠️ بوابة اختيار الدفعة **انشالت من هون** — صارت بـ`app/(shell)/layout.js`
     اللي فوق كل صفحات المنصّة. كانت مكرَّرة هون لأن الداشبورد ما كان
     يستعمل `getShellProfile`، وتكرارها هلق بيعني رحلة شبكية زايدة بكل فتحة
     على فحص انعمل أصلاً باللياوت. نفس السلوك بالضبط، مرة وحدة. */
  /* ⚠️ نفس الصف اللي جابه اللياوت قبل شوي بنفس الطلب — موحَّد بـ
     `lib/profile-cache.js` فما بينجاب مرتين. مقيس بخط الأساس ٢٠٢٦-٠٨-٢٤. */
  const profile = await getProfileRow(userId);

  /* ⚠️ الإيميل بديل **كسول** للاسم — نفس نمط `lib/shell-profile.js`.
     `profiles.email` مش مضمونة التعبئة (`create-profile` ما بتكتبها)، فما
     منعتمد عليها. والرحلة ما بتنعمل إلا بالحالة النادرة اللي ما فيها اسم. */
  let username = profile?.username;
  if (!username) {
    const { data: { user } } = await supabase.auth.getUser();
    username = user?.email ?? null;
  }
  const isAdmin = profile?.role === "admin";

  return (
    <Suspense fallback={null}>
      <DashboardClient
        username={username}
        isAdmin={isAdmin}
        subscriptionEnd={profile?.subscription_end || null}
        currentStreak={profile?.current_streak || 0}
      />
    </Suspense>
  );
}
