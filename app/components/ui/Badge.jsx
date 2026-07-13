import { cn } from "@/lib/cn";

const variants = {
  default: "border-gold-400/20 bg-gold-400/10 text-gold-200",
  vip: "gold-gradient-bg border-transparent text-ink",
  profit: "border-profit/30 bg-profit/10 text-profit",
  loss: "border-loss/30 bg-loss/10 text-loss",
  info: "border-info/30 bg-info/10 text-info",
  muted: "border-white/10 bg-white/5 text-text-muted",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  className,
  dot = false,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "vip" ? "bg-ink" : "bg-current"
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
