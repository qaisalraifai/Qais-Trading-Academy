"use client";

import { cn } from "@/lib/cn";

/* ============================================================================
   Input / Select / Textarea / Field
   ----------------------------------------------------------------------------
   كل الحشوات بخصائص منطقية (ps/pe مش pl/pr) عشان الأيقونة تقعد بالجهة الصح
   بالعربي والإنجليزي بدون أي كود إضافي.
   ============================================================================ */

const BASE =
  "w-full rounded-sm border border-edge bg-space-2 text-sm text-text-primary " +
  "placeholder:text-text-muted " +
  "transition-colors duration-base ease-orbit " +
  "hover:border-edge-lit " +
  "focus:border-ice-400 focus:outline-none focus:ring-1 focus:ring-ice-200/25 " +
  "disabled:cursor-not-allowed disabled:opacity-45";

export default function Input({ className, icon: Icon, error, ...props }) {
  return (
    <div className="w-full">
      <div className="relative w-full">
        {Icon && (
          <Icon
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
        )}
        <input
          aria-invalid={error ? true : undefined}
          className={cn(
            BASE,
            "h-9 px-3",
            Icon && "ps-9",
            error && "border-loss/60 focus:border-loss focus:ring-loss/20",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-caption text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Textarea({ className, error, rows = 4, ...props }) {
  return (
    <div className="w-full">
      <textarea
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          BASE,
          "resize-y px-3 py-2.5 leading-relaxed",
          error && "border-loss/60 focus:border-loss focus:ring-loss/20",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-caption text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({ className, error, children, ...props }) {
  return (
    <div className="w-full">
      <div className="relative w-full">
        <select
          aria-invalid={error ? true : undefined}
          className={cn(
            BASE,
            "h-9 appearance-none px-3 pe-8",
            error && "border-loss/60 focus:border-loss focus:ring-loss/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute end-3 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" />
        </svg>
      </div>
      {error && (
        <p className="mt-1.5 text-caption text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Field — تسمية + حقل + شرح. التسمية بالسلّم الصغير المتباعد.
   --------------------------------------------------------------------------- */
export function Field({ label, hint, htmlFor, required, children, className }) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="eyebrow flex items-center gap-1">
          {label}
          {required && (
            <span className="text-loss" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && <p className="text-caption text-text-muted">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Switch — مفتاح تبديل. المقبض بينزلق للجهة الصح حسب اتجاه اللغة.
   --------------------------------------------------------------------------- */
export function Switch({ checked, onChange, label, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border transition-colors duration-base ease-orbit",
        checked ? "border-ice-300 bg-ice-200/25" : "border-edge bg-module-2",
        disabled && "cursor-not-allowed opacity-45",
        className
      )}
    >
      <span
        className={cn(
          "absolute h-3 w-3 rounded-full transition-all duration-base ease-orbit",
          checked ? "bg-ice-200" : "bg-text-muted"
        )}
        style={{ insetInlineStart: checked ? "calc(100% - 1.05rem)" : "0.2rem" }}
        aria-hidden
      />
    </button>
  );
}
