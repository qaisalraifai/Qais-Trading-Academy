"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import ProfileHeaderCard from "./ProfileHeaderCard";

// غلاف موحّد لكل صفحة (Workspace مستقلة أو /dashboard) — نفس الـ Header والـ
// Sidebar بكل مكان. التنقل بين الأدوات صار عبر روابط Next.js حقيقية (كل واحد
// إله مساره الخاص)، فالـ Sidebar بيحدد العنصر النشط تلقائياً من الـ URL الحالي
// بدل ما يعتمد على state يوصله من هون.
export default function AppShell({
  username,
  initials,
  isAdmin = false,
  daysLeft = null,
  balance,
  formatBalance,
  showProfileHeader = true,
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  const balanceLabel = formatBalance
    ? formatBalance(balance)
    : balance != null
      ? `💰 $${Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;

  return (
    <div className="flex min-h-screen flex-col font-sans" dir="rtl">
      <Header
        username={username}
        initials={initials}
        showMenuButton
        onMenuToggle={() => setMobileNavOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:flex">
          <Sidebar isAdmin={isAdmin} daysLeft={daysLeft} onLogout={handleLogout} />
        </div>

        <main className="page-container min-w-0 flex-1">
          {showProfileHeader && (
            <ProfileHeaderCard
              username={username}
              initials={initials}
              balance={balance}
              balanceLabel={balanceLabel}
            />
          )}
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        isAdmin={isAdmin}
        daysLeft={daysLeft}
        onLogout={handleLogout}
      />
    </div>
  );
}
