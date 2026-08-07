"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Modal — طبقة عائمة بمستوى الوحدة الأول (مشطوفة + حافة معدنية).
   بتتعامل مع Escape، النقر برّا، قفل السكرول، وإرجاع التركيز لمصدره.
   ============================================================================ */

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);

    // التركيز على أول عنصر قابل للتركيز جوّا اللوحة
    const focusable = panelRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusable || panelRef.current)?.focus?.();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* الغشاء — تعتيم عميق مع ضباب خفيف */}
      <div
        className="absolute inset-0 animate-fade-in bg-space-0/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "mod mod-lit relative z-10 w-full animate-scale-in shadow-overlay",
          WIDTHS[size],
          className
        )}
      >
        <div className="mod-in flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              )}
              {description && (
                <p className="mt-1 text-caption text-text-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="-me-1 grid h-7 w-7 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-base ease-orbit hover:bg-white/[0.05] hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-edge px-5 py-3.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
