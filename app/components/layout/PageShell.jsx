"use client";

import AppShell from "./AppShell";

// غلاف جاهز لأي Workspace مستقلة (زي /trading-radar، /replay، /mlm...) عشان
// تاخد نفس الـ Sidebar والـ Header المستخدمين بكل المنصة، بدون تكرار. كل صفحة
// هلأ إلها مسارها (URL) الخاص، فالـ Sidebar بيعرف وحده أي عنصر هو النشط.
export default function PageShell({ username, isAdmin = false, daysLeft = null, initials, showProfileHeader = false, children }) {
  const computedInitials = initials || (username || "؟").trim().charAt(0).toUpperCase();

  return (
    <AppShell username={username} initials={computedInitials} isAdmin={isAdmin} daysLeft={daysLeft} showProfileHeader={showProfileHeader}>
      {children}
    </AppShell>
  );
}
