"use client";

import { useRouter } from "next/navigation";
import AppShell from "./AppShell";

// غلاف جاهز لأي صفحة مستقلة (زي /affiliate، /mlm، /discord...) عشان تاخد نفس
// الـ sidebar والـ header المستخدمين بالداشبورد، بدون ما تكرر منطق التنقل بكل مرة.
// الضغط على أي عنصر بالسايدبار بيرجّع المستخدم لـ /dashboard (وين تعيش كل التبويبات فعليًا).
export default function PageShell({ username, isAdmin = false, daysLeft = null, initials, showProfileHeader = false, children }) {
  const router = useRouter();
  const goToDashboard = () => router.push("/dashboard");
  const computedInitials = initials || (username || "؟").trim().charAt(0).toUpperCase();

  return (
    <AppShell
      username={username}
      initials={computedInitials}
      isAdmin={isAdmin}
      daysLeft={daysLeft}
      activeKey={null}
      setActiveKey={goToDashboard}
      onNavToLectures={goToDashboard}
      showProfileHeader={showProfileHeader}
    >
      {children}
    </AppShell>
  );
}
