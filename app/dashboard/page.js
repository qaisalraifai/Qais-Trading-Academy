import { createClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ⚠️ الاستعلامان متوازيان — `batch_enrollments` ما بتعتمد على `profiles`،
  // الاتنين بيسألوا عن `user.id` اللي معنا أصلاً. كانوا متسلسلين فكان فتح
  // الداشبورد يدفع رحلتين شبكيتين ورا بعض بدل وحدة. (نفس التعديل بـ
  // lib/shell-profile.js لباقي الصفحات.)
  // ⚠️ `.catch` لازم: الأدمن ما بينتظر هالوعد، ووعد مرفوض بلا مستمع بيرمي
  // unhandledRejection. الفشل بيصير {count:null} = نفس سلوك فشل الاستعلام قبل.
  const enrollmentPromise = createAdminClient()
    .from("batch_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .then((r) => r, () => ({ count: null }));

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, subscription_end, current_streak, longest_streak")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email;
  const isAdmin = profile?.role === "admin";

  // بوابة اختيار الدفعة — الداشبورد ما بيستخدم getShellProfile (عندها منطق
  // بروفايل خاص فيها)، فلازم نفس الفحص هون تحديدًا كمان.
  if (!isAdmin) {
    const { count } = await enrollmentPromise;
    if (!count) redirect("/select-batch");
  }

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
