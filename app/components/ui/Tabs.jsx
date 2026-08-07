"use client";

import { cn } from "@/lib/cn";

/* ============================================================================
   Tabs — نوعين:
     line    → خط تحت التبويب النشط. للتنقّل بين أقسام صفحة.
     segment → مجموعة مقسّمة بإطار واحد. للفلاتر والفريمات الزمنية بالتيرمنال.
   ============================================================================ */

export function Tabs({ items = [], value, onChange, variant = "line", className, size = "md" }) {
  if (variant === "segment") {
    return (
      <div
        role="tablist"
        className={cn("inline-flex border border-edge", className)}
      >
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={it.disabled}
              onClick={() => onChange?.(it.value)}
              className={cn(
                "border-s border-edge transition-colors duration-fast ease-orbit first:border-s-0",
                size === "sm" ? "px-2.5 py-1 text-micro" : "px-3 py-1.5 text-caption",
                "disabled:cursor-not-allowed disabled:opacity-40",
                active
                  ? "bg-ice-200/12 font-medium text-ice-100"
                  : "text-text-muted hover:bg-white/[0.035] hover:text-text-secondary"
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={cn("flex gap-1 border-b border-edge", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange?.(it.value)}
            className={cn(
              "relative -mb-px flex items-center gap-2 px-3 py-2.5 text-sm transition-colors duration-base ease-orbit",
              "disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "font-semibold text-text-primary"
                : "font-normal text-text-muted hover:text-text-secondary"
            )}
          >
            {it.icon && <it.icon className="h-4 w-4 shrink-0" aria-hidden />}
            {it.label}
            {it.count !== undefined && (
              <span
                dir="ltr"
                className="font-num text-micro tabular-nums text-text-muted"
                style={{ unicodeBidi: "isolate" }}
              >
                {it.count}
              </span>
            )}
            {active && (
              <span
                className="absolute inset-x-0 bottom-0 h-px bg-ice-200"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
