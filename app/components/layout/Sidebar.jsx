"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ProgressBar } from "@/app/components/ui";
import {
  NAV_ITEMS,
  FOOTER_LINKS,
  HOME_NAV,
  VIP_CARD,
  LOGOUT_ITEM,
} from "./navigation";

// عنصر نشط = المسار الحالي يبدأ بنفس href العنصر (يغطي الصفحات الفرعية
// زي /mlm/tree). صفحة /mlm صارت مدمجة داخل /affiliate، فمنعتبر أي مسار
// يبدأ بـ /mlm فعّال لعنصر "العمولة والشبكة" (href: /affiliate) كمان.
function isPathActive(pathname, href) {
  if (!pathname || !href) return false;
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (href === "/affiliate" && (pathname === "/mlm" || pathname.startsWith("/mlm/"))) return true;
  return false;
}

function NavButton({ item, isActive, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn("nav-item group w-full text-right", isActive ? "nav-item-active" : "nav-item-inactive")}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-all duration-300 ease-premium group-hover:scale-110",
          isActive && "drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]"
        )}
        aria-hidden
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon && (
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
          قريباً
        </span>
      )}
    </Link>
  );
}

function FooterLink({ item }) {
  const Icon = item.icon;
  const colorClass =
    item.color === "discord"
      ? "text-discord hover:text-discord/80"
      : item.color === "gold"
        ? "text-gold-200 hover:text-gold-100"
        : "text-text-muted hover:text-text-secondary";

  const content = (
    <div className={cn("nav-item group nav-item-inactive", colorClass)}>
      <Icon className="h-5 w-5 shrink-0 transition-transform duration-300 ease-premium group-hover:scale-110" aria-hidden />
      <span>{item.label}</span>
    </div>
  );

  if (!item.href) {
    return <div className="cursor-pointer">{content}</div>;
  }

  return (
    <Link href={item.href} className="block no-underline">
      {content}
    </Link>
  );
}

export default function Sidebar({
  isAdmin,
  daysLeft,
  onNavigate,
  onLogout,
  className,
}) {
  const pathname = usePathname();
  const VipIcon = VIP_CARD.icon;
  const HomeIcon = HOME_NAV.icon;
  const LogoutIcon = LOGOUT_ITEM.icon;

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const isHomeActive = isPathActive(pathname, HOME_NAV.href) && !visibleNavItems.some((item) => isPathActive(pathname, item.href));

  return (
    <aside
      className={cn(
        "flex h-full w-sidebar shrink-0 flex-col",
        "border-l border-gold-400/10 bg-gradient-to-b from-surface-3/80 to-surface-0/90",
        "px-3 py-5 backdrop-blur-glass",
        className
      )}
    >
      <div className="mb-5 rounded-lg border border-gold-400/20 bg-gradient-to-bl from-gold-400/10 to-surface-1 p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-gold-200">
          <VipIcon className="h-[1.1rem] w-[1.1rem] animate-pulse-soft text-gold-300" aria-hidden />
          <span>{VIP_CARD.title}</span>
        </div>
        <p className="text-sm font-extrabold text-text-primary">{VIP_CARD.subtitle}</p>
        <p className="mb-3 mt-0.5 text-[11px] text-text-muted">{VIP_CARD.description}</p>

        {daysLeft !== null && (
          <>
            <ProgressBar
              value={Math.min(100, Math.max(4, (daysLeft / 30) * 100))}
              size="sm"
              className="mb-2"
            />
            <p className="mb-3 text-[11px] text-text-muted">ينتهي في {daysLeft} يوم</p>
          </>
        )}

        <Link href="/settings" onClick={onNavigate}>
          <Button variant="secondary" size="sm" className="w-full" icon={Settings}>
            إدارة الاشتراك
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2.5 px-1">
        <img
          src="/logo.jpg"
          alt="QTA"
          className="h-10 w-10 shrink-0 rounded-full border-2 border-gold-400/60 object-cover"
        />
        <div>
          <p className="eyebrow mb-0 text-[9px]">QAIS TRADING</p>
          <p className="text-xs font-bold text-text-primary">ACADEMY</p>
        </div>
      </div>

      <Link
        href={HOME_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group mb-4 flex w-full items-center justify-center gap-2 rounded-md px-3.5 py-3",
          "gold-gradient-bg text-sm font-extrabold text-ink shadow-glow-sm",
          "transition-all duration-300 hover:shadow-glow hover:brightness-110 hover:-translate-y-0.5",
          isHomeActive && "ring-2 ring-gold-200/30"
        )}
      >
        <HomeIcon className="h-5 w-5 transition-transform duration-300 ease-premium group-hover:scale-110" aria-hidden />
        <span>{HOME_NAV.label}</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="التنقل الرئيسي">
        {visibleNavItems.map((item) => (
          <NavButton key={item.key} item={item} isActive={isPathActive(pathname, item.href)} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-1 border-t border-gold-400/10 pt-4">
        {FOOTER_LINKS.map((item) => (
          <FooterLink key={item.key} item={item} />
        ))}
        <button
          type="button"
          onClick={onLogout}
          className="nav-item group nav-item-inactive w-full text-right text-text-muted hover:text-loss"
        >
          <LogoutIcon className="h-5 w-5 shrink-0 transition-transform duration-300 ease-premium group-hover:scale-110" aria-hidden />
          <span>{LOGOUT_ITEM.label}</span>
        </button>
      </div>
    </aside>
  );
}
