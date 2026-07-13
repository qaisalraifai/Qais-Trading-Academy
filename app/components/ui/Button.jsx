"use client";

import { cn } from "@/lib/cn";

const variants = {
  primary:
    "gold-gradient-bg text-ink font-bold shadow-glow-sm hover:shadow-glow hover:brightness-110 active:scale-[0.98]",
  secondary:
    "border border-gold-400/25 bg-surface-1/80 text-gold-200 hover:border-gold-400/40 hover:bg-surface-2/80",
  ghost:
    "border border-transparent bg-transparent text-text-muted hover:border-gold-400/10 hover:bg-white/[0.03] hover:text-text-secondary",
  danger:
    "border border-loss/30 bg-loss/10 text-loss hover:border-loss/50 hover:bg-loss/15",
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-sm gap-1.5",
  md: "h-10 px-4 text-sm rounded-md gap-2",
  lg: "h-12 px-6 text-sm rounded-md gap-2",
};

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

  return (
    <button
      type="button"
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center font-sans transition-all duration-300 ease-premium",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {Icon && iconPosition === "start" && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
          {children}
          {Icon && iconPosition === "end" && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        </>
      )}
    </button>
  );
}
