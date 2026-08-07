"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Module, OrbitRing } from "@/app/components/ui";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import Header from "./Header";
import MobileNav from "./MobileNav";
import ProfileHeaderCard from "./ProfileHeaderCard";
import NavRail, { isPathActive } from "./NavRail";
import { NAV_ITEMS, FOOTER_LINKS, HOME_NAV, VIP_CARD, LOGOUT_ITEM } from "./navigation";

/* ============================================================================
   AppShell — الغلاف الموحّد لكل صفحات المنصّة.
   ----------------------------------------------------------------------------
   قبل هيك كان في غلافين: AppShell (سايدبار كاملة) للداشبورد بس، و
   WorkspaceShell (رِيل أيقونات) للـ ٢٣ صفحة الباقية — فكان المستخدم يحس إنه
   بينطّ بين تطبيقين كل ما يفتح أداة.

   هلأ غلاف واحد: هيدر ثابت (بحث + إشعارات + لغة + أفاتار) وسايدبار كاملة
   بتسميات ومجموعات. الأدوات الثقيلة (الشارتات، Replay، الرادار) بتاخد
   مساحتها عن طريق «وضع التركيز» — زر بالهيدر بيطوي السايدبار لأيقونات
   فقط، والتفضيل بينحفظ محلياً.
   ============================================================================ */

const FOCUS_KEY = "qta_focus_mode";

/* المسارات يلي بتستفيد من كل بكسل — بتبلّش بوضع التركيز أول زيارة فقط،
   وبعدها اختيار المستخدم هو المرجع. */
const FOCUS_DEFAULT_ROUTES = ["/replay", "/trading-radar", "/market-intelligence", "/backtest"];

function SidebarFooter({ t, daysLeft, onNavigate, onLogout, collapsed }) {
  const LogoutIcon = LOGOUT_ITEM.icon;
  const daysPct = daysLeft !== null && daysLeft !== undefined ? Math.min(100, Math.max(4, (daysLeft / 30) * 100)) : null;

  if (collapsed) {
    /* مطوي — أيقونات فقط، بدون كرت الاشتراك حتى ما يتكسّر العرض */
    return (
      <div className="flex flex-col items-center gap-1">
        {FOOTER_LINKS.filter((l) => l.href).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              title={t(item.labelKey)}
              className={cn(
                "grid h-9 w-9 place-items-center transition-colors duration-base",
                item.color === "discord" ? "text-discord hover:text-discord/80" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onLogout}
          title={t(LOGOUT_ITEM.labelKey)}
          className="grid h-9 w-9 place-items-center text-text-muted transition-colors duration-base hover:text-loss"
        >
          <LogoutIcon className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* بطاقة الاشتراك — حافة ذهبية لأنها لحظة قيمة مالية */}
      <Module level="primary" chamfer="sm" className="shrink-0" padding="none">
        <div className="flex items-center gap-2.5 p-3">
          {daysPct !== null ? (
            <OrbitRing value={daysPct} tone="value" size={34} label={t("subscription.expiresIn", { days: daysLeft })} />
          ) : (
            <span className="orbit-ring" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-semibold text-au-100">{t(VIP_CARD.subtitleKey)}</p>
            {daysLeft !== null && daysLeft !== undefined && (
              <p className="truncate text-micro text-text-muted">{t("subscription.expiresIn", { days: daysLeft })}</p>
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

      <div className="flex flex-col gap-0.5">
        {FOOTER_LINKS.map((item) => {
          const Icon = item.icon;
          const tone = item.color === "discord" ? "text-discord hover:text-discord/80" : "text-text-muted hover:text-text-secondary";
          const body = (
            <div className={cn("flex items-center gap-2.5 px-2.5 py-2 text-caption transition-colors duration-base", tone)}>
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className="truncate">{t(item.labelKey)}</span>
            </div>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} onClick={onNavigate} className="block no-underline">
              {body}
            </Link>
          ) : (
            <div key={item.key} className="cursor-pointer">
              {body}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 px-2.5 py-2 text-start text-caption text-text-muted transition-colors duration-base hover:text-loss"
        >
          <LogoutIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="truncate">{t(LOGOUT_ITEM.labelKey)}</span>
        </button>
      </div>
    </div>
  );
}

export default function AppShell({
  username,
  initials,
  isAdmin = false,
  daysLeft = null,
  balance,
  formatBalance,
  showProfileHeader = false,
  padded = false,
  children,
}) {
  const pathname = usePathname();
  const { t, dir } = useLocale();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /* بيبلّش مطوي على السيرفر لتفادي اختلاف الترطيب (hydration)، وبعد أول
     رندر بيتظبّط حسب التفضيل المحفوظ أو حسب نوع الصفحة وعرض الشاشة. */
  const [focus, setFocus] = useState(true);

  useEffect(() => {
    let saved = null;
    try {
      saved = window.localStorage.getItem(FOCUS_KEY);
    } catch {
      /* التخزين معطّل — بنكمل بالافتراضي */
    }
    if (saved !== null) {
      setFocus(saved === "1");
      return;
    }
    const isFocusRoute = FOCUS_DEFAULT_ROUTES.some((r) => pathname === r || pathname?.startsWith(`${r}/`));
    const isWide = window.matchMedia("(min-width: 1280px)").matches;
    setFocus(isFocusRoute || !isWide);
    // أول زيارة فقط — بعدها اختيار المستخدم بيحكم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFocus = useCallback(() => {
    setFocus((f) => {
      const next = !f;
      try {
        window.localStorage.setItem(FOCUS_KEY, next ? "1" : "0");
      } catch {
        /* التخزين معطّل — بنكمل بدون حفظ التفضيل */
      }
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  const balanceLabel = formatBalance
    ? formatBalance(balance)
    : balance != null
      ? `$${Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;

  /* «لوحة التحكم» أول عنصر بالقائمة — نفس مستوى باقي الوجهات، مش كرت منفصل */
  const visibleNavItems = [HOME_NAV, ...NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)];

  const activeItem = visibleNavItems.find((item) => isPathActive(pathname, item.href));

  return (
    <div className="flex h-screen flex-col font-sans" dir={dir}>
      <Header
        username={username}
        initials={initials}
        showMenuButton
        onMenuToggle={() => setMobileNavOpen(true)}
        focus={focus}
        onToggleFocus={toggleFocus}
        focusLabel={focus ? t("header.expandMenu") : t("header.collapseMenu")}
        FocusIcon={focus ? PanelLeftOpen : PanelLeftClose}
        sectionLabel={activeItem ? t(activeItem.labelKey) : null}
      />

      <div className="flex min-h-0 flex-1">
        <NavRail
          items={visibleNavItems}
          pathname={pathname}
          collapsed={focus}
          t={t}
          className="hidden lg:flex"
          footer={
            <SidebarFooter
              t={t}
              daysLeft={daysLeft}
              onLogout={handleLogout}
              collapsed={focus}
            />
          }
        />

        <main className={cn("min-w-0 flex-1 overflow-y-auto", padded && "p-4 md:p-6")}>
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
