import { cn } from "@/lib/cn";

const variants = {
  default: "glass-card",
  elevated: "glass-card shadow-glow-sm hover:shadow-glow transition-shadow duration-300",
  flat: "rounded-lg border border-gold-400/10 bg-surface-1",
  vip: "rounded-lg border border-gold-400/25 bg-gradient-to-bl from-gold-400/15 to-surface-1 shadow-glow-sm",
};

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

export default function Card({
  children,
  className,
  variant = "default",
  padding = "md",
  hover = false,
  ...props
}) {
  return (
    <div
      className={cn(
        variants[variant],
        paddings[padding],
        hover && "transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-gold-400/25",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h3 className={cn("text-base font-bold text-text-primary md:text-lg", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }) {
  return (
    <p className={cn("text-xs text-text-muted md:text-sm", className)}>
      {children}
    </p>
  );
}
