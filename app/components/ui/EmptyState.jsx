import { cn } from "@/lib/cn";
import Button from "./Button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-gold-400/20 bg-gold-400/5 shadow-glow-sm">
          <Icon className="h-9 w-9 animate-pulse-soft text-gold-400/70" aria-hidden />
        </div>
      )}
      {title && (
        <h3 className="mb-2 text-base font-bold text-text-primary md:text-lg">
          {title}
        </h3>
      )}
      {description && (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-text-muted">
          {description}
        </p>
      )}
      {(action || (actionLabel && onAction)) && (
        action || (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
