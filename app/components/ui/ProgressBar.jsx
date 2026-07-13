import { cn } from "@/lib/cn";

export default function ProgressBar({
  value = 0,
  max = 100,
  className,
  barClassName,
  showLabel = false,
  label,
  size = "md",
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const heights = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  };

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-text-muted">{label}</span>}
          {showLabel && <span className="font-mono font-medium text-gold-200">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-full bg-surface-2", heights[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-l from-gold-400 to-gold-200 transition-all duration-500 ease-premium",
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
