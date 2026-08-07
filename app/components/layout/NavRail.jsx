"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/* ============================================================================
   NavRail — الرِيل المداري. عنصر التنقّل الأساسي بنظام ORBIT.
   ----------------------------------------------------------------------------
   خط رأسي خافت بيمرّ خلف الأيقونات ("مسار المدار")، وكل عنصر عليه نقطة صغيرة
   قاعدة على المسار. العنصر النشط بتمتلي نقطته وبيجيه تدرّج جانبي وحدّ جليدي.

   كل الاتجاهات منطقية: border-inline-start و inset-inline-end، فالرِيل بيقعد
   على يمين الشاشة بالعربي وعلى يسارها بالإنجليزي بدون أي شرط بالكود.
   ============================================================================ */

export function isPathActive(pathname, href) {
  if (!pathname || !href) return false;
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  // /mlm اندمجت جوّا /affiliate — بتضل تفعّل نفس العنصر
  if (href === "/affiliate" && (pathname === "/mlm" || pathname.startsWith("/mlm/"))) return true;
  return false;
}

export default function NavRail({
  items = [],
  pathname,
  collapsed = true,
  onNavigate,
  t,
  footer,
  className,
}) {
  return (
    <aside
      className={cn(
        "relative z-rail flex shrink-0 flex-col border-e border-edge bg-module-1/50 py-3",
        "transition-[width] duration-base ease-orbit",
        collapsed ? "w-rail px-1.5" : "w-sidebar px-2",
        className
      )}
    >
      {/* مسار المدار — خط بيوصل العناصر ببعضها */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-8 w-px bg-gradient-to-b from-transparent via-edge to-transparent"
        style={{ insetInlineEnd: collapsed ? "1.72rem" : "auto", insetInlineStart: collapsed ? "auto" : "1.05rem" }}
      />

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label={t?.("nav.dashboard")}>
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = isPathActive(pathname, item.href);
          const label = t ? t(item.labelKey) : item.label;
          const newGroup = i > 0 && item.group && item.group !== items[i - 1].group;
          const groupLabel = t && item.group ? t(`navGroup.${item.group}`) : null;

          return (
            <div key={`g-${item.key}`} className="contents">
              {/* فاصل المجموعة — عنوان وقت التوسّع، خط وقت الطيّ */}
              {newGroup &&
                (collapsed ? (
                  <span className="mx-auto my-1.5 h-px w-5 bg-edge" aria-hidden />
                ) : (
                  <span className="mt-3 px-2.5 pb-1 text-[9px] uppercase tracking-[0.2em] text-text-faint">
                    {groupLabel}
                  </span>
                ))}
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 py-2.5 text-caption transition-colors duration-base ease-orbit",
                collapsed ? "justify-center px-0" : "px-2.5",
                active
                  ? "font-semibold text-text-primary"
                  : "font-normal text-text-muted hover:text-text-secondary"
              )}
            >
              {/* التدرّج الجانبي + الحدّ الجليدي للعنصر النشط */}
              {active && (
                <>
                  <span aria-hidden className="fade-from-start absolute inset-0" />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-ice-200"
                    style={{ insetInlineStart: 0 }}
                  />
                </>
              )}

              <Icon
                className={cn(
                  "relative h-[18px] w-[18px] shrink-0 transition-colors",
                  active ? "text-ice-100" : "text-current"
                )}
                aria-hidden
              />

              {!collapsed && <span className="relative flex-1 truncate">{label}</span>}

              {/* تلميح وقت الطيّ — الأيقونة لحالها ما بتكفي لتعريف الوجهة */}
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-1/2 z-overlay w-max -translate-y-1/2 whitespace-nowrap border border-edge-lit bg-module-3 px-2 py-1 text-caption text-text-primary opacity-0 shadow-overlay transition-opacity duration-fast group-hover:opacity-100"
                  style={{ insetInlineStart: "calc(100% + 8px)" }}
                >
                  {label}
                </span>
              )}

              {/* نقطة المدار — قاعدة على المسار */}
              <span
                aria-hidden
                className={cn(
                  "absolute h-[5px] w-[5px] rounded-full border transition-colors duration-base",
                  active
                    ? "border-ice-200 bg-ice-200 shadow-[0_0_6px_rgba(95,168,232,0.75)]"
                    : "border-edge-lit bg-space-1 group-hover:border-steel-300"
                )}
                style={{
                  insetInlineEnd: collapsed ? "0.22rem" : "auto",
                  insetInlineStart: collapsed ? "auto" : "-0.5rem",
                }}
              />

              {!collapsed && item.comingSoon && (
                <span className="relative shrink-0 rounded-sm border border-edge px-1 py-px text-[9px] text-text-faint">
                  {t ? t("common.comingSoon") : "قريباً"}
                </span>
              )}
            </Link>
            </div>
          );
        })}
      </nav>

      {footer && <div className="mt-2 border-t border-edge pt-2">{footer}</div>}
    </aside>
  );
}
