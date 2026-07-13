"use client";

import { cn } from "@/lib/cn";

export default function Input({
  className,
  icon: Icon,
  error,
  ...props
}) {
  return (
    <div className="relative w-full">
      {Icon && (
        <Icon
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted transition-colors duration-300"
          aria-hidden
        />
      )}
      <input
        className={cn(
          "w-full rounded-md border border-gold-400/15 bg-surface-1 px-4 py-2.5 text-sm text-text-primary",
          "placeholder:text-text-muted/70",
          "transition-all duration-300 ease-premium",
          "hover:border-gold-400/25",
          "focus:border-gold-400/40 focus:bg-surface-2/80 focus:outline-none focus:ring-2 focus:ring-gold-400/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          Icon && "pr-10",
          error && "border-loss/50 focus:border-loss/50 focus:ring-loss/20",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
