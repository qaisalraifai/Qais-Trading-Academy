"use client";

import WorkspaceShell from "./WorkspaceShell";

/* ============================================================================
   غلاف كل Workspace مستقلة (كل صفحة ماعدا /dashboard نفسها): Trading Radar،
   Market Intelligence، Replay، المحاضرات، البث المباشر، التقويم الاقتصادي،
   الصفقات، الاستراتيجيات، الشبكة، التسويق بالعمولة، التقارير، إدارة الحسابات،
   الإعدادات... إلخ. يستخدم WorkspaceShell الخفيف (Top Bar + Rail مصغّر قابل
   للطي) بدل الـ Sidebar الكبيرة المستخدمة بـ /dashboard فقط، عشان كل أداة
   تاخد كامل عرض وارتفاع الشاشة وتحس إنها برنامج مستقل.
   ============================================================================ */
export default function PageShell({ username, isAdmin = false, daysLeft = null, initials, children }) {
  const computedInitials = initials || (username || "؟").trim().charAt(0).toUpperCase();

  return (
    <WorkspaceShell username={username} initials={computedInitials} isAdmin={isAdmin} daysLeft={daysLeft}>
      {children}
    </WorkspaceShell>
  );
}
