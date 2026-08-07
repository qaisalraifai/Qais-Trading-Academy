import { cn } from "@/lib/cn";

/* ============================================================================
   ProgressBar — شريط تقدّم خطّي، حواف قائمة.
   ============================================================================ */

const HEIGHTS = { sm: "h-0.5", md: "h-1", lg: "h-1.5" };

const TONES = {
  ice: "bg-ice-200",
  value: "bg-au-200",
  profit: "bg-profit",
  steel: "bg-steel-300",
};

export default function ProgressBar({
  value = 0,
  max = 100,
  className,
  barClassName,
  showLabel = false,
  label,
  size = "md",
  tone = "ice",
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-caption text-text-muted">{label}</span>}
          {showLabel && (
            <span
              dir="ltr"
              className="font-num text-caption font-medium tabular-nums text-text-secondary"
              style={{ unicodeBidi: "isolate" }}
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden bg-module-2", HEIGHTS[size])}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === "string" ? label : undefined}
      >
        <div
          className={cn(
            "h-full transition-[width] duration-slow ease-orbit",
            TONES[tone] || TONES.ice,
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   OrbitRing — تقدّم دائري. الهندسة المدارية للنظام.
   بتبلّش من الأعلى وبتلف مع عقارب الساعة بالحالتين (التقدّم مش اتجاه قراءة).
   --------------------------------------------------------------------------- */
const RING_TONES = {
  ice: "#7C4DFF",
  value: "#DCD4F7",
  profit: "#10E5A0",
  steel: "#B9AEDC",
  loss: "#FF453A",
};

export function OrbitRing({
  value = 0,
  max = 100,
  size = 34,
  stroke = 2.5,
  tone = "ice",
  showValue = false,
  className,
  label,
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2A2145"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_TONES[tone] || RING_TONES.ice}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 380ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {showValue && (
        <span
          dir="ltr"
          className="absolute font-num font-semibold tabular-nums text-text-primary"
          style={{ fontSize: size * 0.28, unicodeBidi: "isolate" }}
        >
          {Math.round(pct)}
        </span>
      )}
    </div>
  );
}
