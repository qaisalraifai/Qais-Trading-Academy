"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Home, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, IconButton } from "@/app/components/ui";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { NAV_ITEMS, HOME_NAV, LOGOUT_ITEM } from "./navigation";
import NavRail, { isPathActive } from "./NavRail";
import MobileNav from "./MobileNav";
import LanguageSwitcher from "./LanguageSwitcher";

/* ============================================================================
   WorkspaceShell — غلاف كل أداة مستقلة (كل صفحة ماعدا /dashboard).
   شريط علوي رفيع + رِيل مداري قابل للتوسيع. الأداة بتاخد كل المساحة المتبقية.
   ============================================================================ */

export default function WorkspaceShell({
  username,
  initials,
  isAdmin = false,
  daysLeft = null,
  children,
}) {
  const pathname = usePathname();
  const { t, dir } = useLocale();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeItem = visibleNavItems.find((item) => isPathActive(pathname, item.href));
  const title = activeItem ? t(activeItem.labelKey) : "Workspace";

  /* السهم لازم يأشّر على الجهة يلي رح تتحرّك عليها القائمة فعلياً — وهاي
     بتنقلب مع اتجاه اللغة. كانت مثبّتة على ChevronsLeft فبتأشّر بالعكس
     بالنسخة الإنجليزية. */
  const isRtl = dir === "rtl";
  const Chevron = collapsed === isRtl ? ChevronsLeft : ChevronsRight;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen flex-col bg-space-1" dir={dir}>
      <header className="glass flex h-header shrink-0 items-center justify-between gap-3 border-b border-edge px-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton
            icon={Menu}
            label={t("header.openMenu")}
            onClick={() => setMobileNavOpen(true)}
            size="sm"
            className="lg:hidden"
          />

          <Link href={HOME_NAV.href} aria-label={t(HOME_NAV.labelKey)} title={t(HOME_NAV.labelKey)}>
            <IconButton icon={Home} label={t(HOME_NAV.labelKey)} size="sm" />
          </Link>

          <IconButton
            icon={Chevron}
            label={collapsed ? t("header.expandMenu") : t("header.collapseMenu")}
            onClick={() => setCollapsed((c) => !c)}
            size="sm"
            className="hidden lg:inline-grid"
          />

          <span className="mx-1 h-3.5 w-px shrink-0 bg-edge" aria-hidden />

          <div className="min-w-0">
            <p className="text-[9px] uppercase leading-tight tracking-[0.16em] text-text-muted">
              Workspace
            </p>
            <h1 className="truncate text-caption font-semibold leading-tight text-text-primary">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <span className="hidden max-w-[8rem] truncate text-caption text-text-secondary sm:block">
            {username}
          </span>
          <Avatar initials={initials} size="sm" alt={username} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <NavRail
          items={visibleNavItems}
          pathname={pathname}
          collapsed={collapsed}
          t={t}
          className="hidden lg:flex"
          footer={
            <button
              type="button"
              onClick={handleLogout}
              title={t(LOGOUT_ITEM.labelKey)}
              className={cn(
                "flex w-full items-center gap-2.5 py-2.5 text-caption text-text-muted transition-colors duration-base ease-orbit hover:text-loss",
                collapsed ? "justify-center px-0" : "px-2.5"
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{t(LOGOUT_ITEM.labelKey)}</span>}
            </button>
          }
        />

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
