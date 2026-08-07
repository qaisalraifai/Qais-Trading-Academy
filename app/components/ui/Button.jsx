"use client";

import { cn } from "@/lib/cn";

/* ============================================================================
   Button
   ----------------------------------------------------------------------------
   الجليد (ice) = التفاعل. الذهب (au) = القيمة المالية فقط — ما تستخدم variant
   "value" إلا للأزرار يلي بتتعامل مع فلوس (اشتراك، سحب عمولة، ترقية).
   الزر الأساسي مملوء بالجليد، وما بيلمع — الوهج انحذف من النظام.
   ============================================================================ */

const VARIANTS = {
  primary:
    "bg-ice-200 text-space-1 font-semibold hover:bg-ice-100 active:bg-ice-300 shadow-edge",
  secondary:
    "border border-edge bg-module-1 text-text-primary hover:border-edge-lit hover:bg-module-2",
  ghost:
    "border border-transparent bg-transparent text-text-muted hover:bg-white/[0.035] hover:text-text-secondary",
  value:
    "border border-au-300/60 bg-au-200/10 text-au-100 font-semibold hover:border-au-200 hover:bg-au-200/15",
  danger:
    "border border-loss/40 bg-loss/10 text-loss hover:border-loss/70 hover:bg-loss/15",
};

const SIZES = {
  sm: "h-7 px-2.5 text-caption gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
};

const ICON_SIZES = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-[1.125rem] w-[1.125rem]" };

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  iconPosition = "start",
  loading = false,
  disabled,
  ...props
}) {
  const isDisabled = disabled || loading;
  const iconCls = cn("shrink-0", ICON_SIZES[size]);

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-sans transition-colors duration-base ease-orbit",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <span
            className={cn(
              "animate-[orbSpin_700ms_linear_infinite] rounded-full border-[1.5px] border-current border-t-transparent",
              ICON_SIZES[size]
            )}
            aria-hidden
          />
          <span className="sr-only">…</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === "start" && <Icon className={iconCls} aria-hidden />}
          {children}
          {Icon && iconPosition === "end" && <Icon className={iconCls} aria-hidden />}
        </>
      )}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   IconButton — زر أيقونة مربّع. للأشرطة وأدوات التيرمنال.
   --------------------------------------------------------------------------- */
const ICON_BTN_SIZES = { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-9 w-9" };

export function IconButton({
  icon: Icon,
  label,
  size = "md",
  active = false,
  className,
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-sm border transition-colors duration-base ease-orbit",
        active
          ? "border-edge-lit bg-ice-200/10 text-ice-200"
          : "border-transparent text-text-muted hover:border-edge hover:bg-white/[0.035] hover:text-text-secondary",
        ICON_BTN_SIZES[size],
        className
      )}
      {...props}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </button>
  );
}
