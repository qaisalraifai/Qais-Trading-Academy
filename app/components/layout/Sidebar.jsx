"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Module, OrbitRing } from "@/app/components/ui";
import Logo from "@/app/components/brand/Logo";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { NAV_ITEMS, FOOTER_LINKS, HOME_NAV, VIP_CARD, LOGOUT_ITEM } from "./navigation";
import { isPathActive } from "./NavRail";

/* ============================================================================
   Sidebar — القائمة الكاملة (تُستخدم بالداشبورد وبقائمة الموبايل).
   ----------------------------------------------------------------------------
   كل الاتجاهات منطقية: border-e، ps/pe، text-start. ما في text-right ثابت ولا
   border-l فيزيائي — النسخة الإنجليزية بتنقلب صح لحالها.
   ============================================================================ */

function NavButton({ item, isActive, onNavigate, t }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-item group w-full text-start",
        isActive ? "nav-item-active" : "nav-item-inactive"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-ice-100" : "text-current")}
        aria-hidden
      />
      <span className="flex-1 truncate">{t(item.labelKey)}</span>
      {item.comingSoon && (
        <span className="shrink-0 rounded-sm border border-edge px-1 py-px text-[9px] text-text-faint">
          {t("common.comingSoon")}
        </span>
      )}
    </Link>
  );
}

function FooterLink({ item, t }) {
  const Icon = item.icon;
  const tone = "text-text-muted hover:text-text-secondary";

  const content = (
    <div className={cn("nav-item nav-item-inactive w-full text-start", tone)}>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="truncate">{t(item.labelKey)}</span>
    </div>
  );

  if (!item.href) return <div className="cursor-pointer">{content}</div>;

  return (
    <Link href={item.href} className="block no-underline">
      {content}
    </Link>
  );
}

export default function Sidebar({ isAdmin, daysLeft, onNavigate, onLogout, className }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const HomeIcon = HOME_NAV.icon;
  const LogoutIcon = LOGOUT_ITEM.icon;

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const isHomeActive =
    isPathActive(pathname, HOME_NAV.href) &&
    !visibleNavItems.some((item) => isPathActive(pathname, item.href));

  const daysPct = daysLeft !== null ? Math.min(100, Math.max(4, (daysLeft / 30) * 100)) : null;

  return (
    <aside
      className={cn(
        "flex h-full w-sidebar shrink-0 flex-col border-e border-edge bg-module-1/60 px-3 py-4",
        className
      )}
    >
      {/* الهوية */}
      <div className="mb-4 px-1">
        <Logo size={32} withWordmark />
      </div>

      {/* مركز القيادة — الوجهة الأساسية */}
      <Link
        href={HOME_NAV.href}
        onClick={onNavigate}
        aria-current={isHomeActive ? "page" : undefined}
        className={cn(
          "mb-3 flex w-full items-center gap-2.5 border px-3 py-2.5 text-caption font-semibold transition-colors duration-base ease-orbit",
          isHomeActive
            ? "border-edge-lit bg-ice-200/10 text-ice-100"
            : "border-edge bg-module-2 text-text-secondary hover:border-edge-lit hover:text-text-primary"
        )}
      >
        <HomeIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <span className="flex-1 truncate text-start">{t(HOME_NAV.labelKey)}</span>
      </Link>

      {/* التنقّل */}
      <nav className="-mx-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label={t(HOME_NAV.labelKey)}>
        {visibleNavItems.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={isPathActive(pathname, item.href)}
            onNavigate={onNavigate}
            t={t}
          />
        ))}
      </nav>

      {/* بطاقة الاشتراك — حافة ذهبية لأنها لحظة قيمة مالية */}
      <Module level="primary" chamfer="sm" className="mt-3 shrink-0" padding="none">
        <div className="flex items-center gap-2.5 p-3">
          {daysPct !== null ? (
            <OrbitRing
              value={daysPct}
              tone="value"
              size={34}
              label={t("subscription.expiresIn", { days: daysLeft })}
            />
          ) : (
            <span className="orbit-ring" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-semibold text-au-100">
              {t(VIP_CARD.subtitleKey)}
            </p>
            {daysLeft !== null && (
              <p className="truncate text-micro text-text-muted">
                {t("subscription.expiresIn", { days: daysLeft })}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-edge p-2">
          <Link href="/settings" onClick={onNavigate} className="block">
            <Button variant="value" size="sm" className="w-full" icon={Settings}>
              {t("nav.subscription")}
            </Button>
          </Link>
        </div>
      </Module>

      {/* التذييل */}
      <div className="-mx-3 mt-3 flex shrink-0 flex-col gap-0.5 border-t border-edge px-3 pt-3">
        {FOOTER_LINKS.map((item) => (
          <FooterLink key={item.key} item={item} t={t} />
        ))}
        <button
          type="button"
          onClick={onLogout}
          className="nav-item nav-item-inactive w-full text-start hover:text-loss"
        >
          <LogoutIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="truncate">{t(LOGOUT_ITEM.labelKey)}</span>
        </button>
      </div>
    </aside>
  );
}
