import { cn } from "@/lib/cn";
import Button from "./Button";

/* ============================================================================
   EmptyState — الأيقونة جوّا مربّع مشطوف بحافة معدنية، مش دائرة متوهّجة.
   ============================================================================ */

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
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <div
          className="mb-5 grid h-14 w-14 place-items-center border border-edge-lit bg-module-1 chamfer"
          style={{ "--chamfer": "12px" }}
        >
          <Icon className="h-6 w-6 text-steel-300" aria-hidden />
        </div>
      )}
      {title && <h3 className="mb-1.5 text-lg font-semibold text-text-primary">{title}</h3>}
      {description && (
        <p className="mb-6 max-w-[42ch] text-sm text-text-muted">{description}</p>
      )}
      {action ||
        (actionLabel && onAction && (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ))}
    </div>
  );
}
