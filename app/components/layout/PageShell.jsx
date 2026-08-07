"use client";

import AppShell from "./AppShell";

/* ============================================================================
   PageShell — غلاف كل صفحة ماعدا /dashboard: Trading Radar، Market
   Intelligence، Replay، المحاضرات، البث المباشر، التقويم الاقتصادي،
   الصفقات، الشبكة، التسويق بالعمولة، التقارير، إدارة الحسابات،
   الإعدادات... إلخ.

   صار يستخدم نفس AppShell الموحّد يلي بتستخدمه الداشبورد — نفس الهيدر ونفس
   السايدبار — عشان ما يتغيّر الإطار وقت التنقّل. الأدوات يلي بدها كل الشاشة
   بتستفيد من «وضع التركيز» بالهيدر بدل ما يكون إلها غلاف منفصل.

   بتضل بدون padding وبدون كرت البروفايل — نفس سلوكها السابق بالضبط، فما في
   صفحة رح يتزحزح تخطيطها.
   ============================================================================ */
export default function PageShell({ username, isAdmin = false, daysLeft = null, initials, children }) {
  const computedInitials = initials || (username || "؟").trim().charAt(0).toUpperCase();

  return (
    <AppShell username={username} initials={computedInitials} isAdmin={isAdmin} daysLeft={daysLeft}>
      {children}
    </AppShell>
  );
}
