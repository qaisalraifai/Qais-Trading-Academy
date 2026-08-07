import { cn } from "@/lib/cn";

/* ============================================================================
   Badge
   ----------------------------------------------------------------------------
   حواف قائمة (rounded-sm) مش حبوب مدوّرة — الشكل جزء من الهوية.
   الاستثناء الوحيد: variant="live" بيستخدم نقطة نابضة وبيضل مستطيل كمان.
   ============================================================================ */

const VARIANTS = {
  default: "border-edge bg-module-2 text-text-secondary",
  value: "border-au-300/50 bg-au-200/10 text-au-100",
  profit: "border-profit/35 bg-profit/10 text-profit",
  loss: "border-loss/35 bg-loss/10 text-loss",
  info: "border-ice-300/40 bg-ice-200/10 text-ice-100",
  warning: "border-warning/35 bg-warning/10 text-warning",
  muted: "border-edge-soft bg-white/[0.03] text-text-muted",
  live: "border-ice-300/60 bg-ice-200/10 text-ice-100",
  /* alias انتقالي */
  vip: "border-au-300/50 bg-au-200/10 text-au-100",
};

const SIZES = {
  sm: "px-1.5 py-0.5 text-micro",
  md: "px-2 py-0.5 text-caption",
  lg: "px-2.5 py-1 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  className,
  dot = false,
}) {
  const isLive = variant === "live";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium tracking-wide",
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size],
        className
      )}
    >
      {(dot || isLive) && (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
            isLive && "animate-pulse-soft"
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Delta — تغيّر رقمي بإشارة ولون. أكثر عنصر بيتكرر بمنتج مالي.
   بيتعامل مع الاتجاه صح: الرقم LTR معزول جوّا نص عربي.
   --------------------------------------------------------------------------- */
export function Delta({ value, suffix = "%", showSign = true, className, size = "md" }) {
  const n = Number(value) || 0;
  const up = n > 0;
  const flat = n === 0;

  const sizes = { sm: "text-caption", md: "text-sm", lg: "text-base" };

  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-1 font-num tabular-nums font-medium",
        flat ? "text-text-muted" : up ? "text-profit" : "text-loss",
        sizes[size],
        className
      )}
      style={{ unicodeBidi: "isolate" }}
    >
      {!flat && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
          {up ? <path d="M5 1l4 7H1z" /> : <path d="M5 9L1 2h8z" />}
        </svg>
      )}
      {showSign && up ? "+" : ""}
      {n.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      {suffix}
    </span>
  );
}
