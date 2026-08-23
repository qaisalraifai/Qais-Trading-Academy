import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /* ⚠️ بوابة اختيار الدفعة **انشالت من هون** — صارت بـ`app/(shell)/layout.js`
     اللي فوق كل صفحات المنصّة. كانت مكرَّرة هون لأن الداشبورد ما كان
     يستعمل `getShellProfile`، وتكرارها هلق بيعني رحلة شبكية زايدة بكل فتحة
     على فحص انعمل أصلاً باللياوت. نفس السلوك بالضبط، مرة وحدة. */
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, subscription_end, current_streak, longest_streak")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email;
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
