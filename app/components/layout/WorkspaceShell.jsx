"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Home, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase-client";
import { NAV_ITEMS, HOME_NAV, LOGOUT_ITEM } from "./navigation";
import MobileNav from "./MobileNav";

/* ============================================================================
   WorkspaceShell — الغلاف الخفيف لكل "Workspace" مستقلة (كل أداة ماعدا
   /dashboard نفسها). بدل الـ Sidebar الكبيرة الثابتة، هون بس:
     - Top Bar رفيع واحترافي (رجوع للداشبورد + اسم الأداة الحالية + البروفايل)
     - Rail جانبي مصغّر (أيقونات فقط) قابل للتوسيع/الطي بالنقر
   الهدف: الأداة نفسها تاخد كامل عرض وارتفاع الشاشة، وتحس إنها برنامج مستقل
   (زي TradingView / Bloomberg Terminal) مش قسم داخل داشبورد.
   ============================================================================ */

function isPathActive(pathname, href) {
  if (!pathname || !href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceShell({ username, initials, isAdmin = false, daysLeft = null, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeItem = visibleNavItems.find((item) => isPathActive(pathname, item.href));
  const title = activeItem?.label || "Workspace";
  const LogoutIcon = LOGOUT_ITEM.icon;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen flex-col bg-surface-0" dir="rtl">
      {/* Top Bar رفيع */}
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-gold-400/10 bg-gradient-to-b from-surface-3/95 to-surface-0/95 px-3 shadow-header backdrop-blur-glass">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:border-gold-400/40 hover:text-gold-200 lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Link
            href={HOME_NAV.href}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-gold-200 transition-all duration-300 ease-premium hover:scale-105 hover:border-gold-400/40"
            aria-label="لوحة التحكم"
            title="لوحة التحكم"
          >
            <Home className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:border-gold-400/40 hover:text-gold-200 lg:flex"
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </button>

          <span className="mx-1 h-4 w-px shrink-0 bg-gold-400/15" />
          <span className="truncate text-sm font-bold text-text-primary">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden max-w-[8rem] truncate text-xs font-bold text-text-secondary sm:block">{username}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-400/40 bg-surface-1 text-xs font-bold text-gold-200">
            {initials}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Rail جانبي مصغّر — أيقونات فقط، يتوسع بالنقر */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col overflow-y-auto border-l border-gold-400/10 bg-surface-1/60 py-3 transition-all duration-300 ease-premium lg:flex",
            collapsed ? "w-14 items-center px-1.5" : "w-52 items-stretch px-2"
          )}
        >
          <nav className="flex flex-1 flex-col gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md p-2.5 text-text-muted transition-all duration-300 ease-premium hover:bg-white/5 hover:text-gold-200",
                    active && "border border-gold-400/30 bg-gold-400/10 font-bold text-gold-200",
                    collapsed && "justify-center"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate text-xs">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            title={LOGOUT_ITEM.label}
            className={cn(
              "mt-2 flex items-center gap-2.5 rounded-md p-2.5 text-text-muted transition-all duration-300 ease-premium hover:text-loss",
              collapsed && "justify-center"
            )}
          >
            <LogoutIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="truncate text-xs">{LOGOUT_ITEM.label}</span>}
          </button>
        </aside>

        {/* الأداة نفسها — كامل العرض والارتفاع المتبقي، بدون أي حشوة Dashboard */}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
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
