"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Toast — إشعار مؤقّت. بينزلق من الجهة الأمامية حسب اتجاه اللغة.
   الاستخدام:
     const toast = useToast();
     toast.success("تم حفظ التغييرات");
     toast.error("فشل الحفظ", "تحقّق من اتصالك وحاول مرة تانية");
   ============================================================================ */

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, tick: "tick-profit", color: "text-profit" },
  error: { icon: XCircle, tick: "tick-loss", color: "text-loss" },
  warning: { icon: AlertTriangle, tick: "", color: "text-warning" },
  info: { icon: Info, tick: "tick-ice", color: "text-ice-200" },
};

let seq = 0;

export function ToastProvider({ children, duration = 4200 }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone, title, description) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, tone, title, description }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      warning: (t, d) => push("warning", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 end-4 z-toast flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} duration={duration} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, duration, onDismiss }) {
  const { icon: Icon, tick, color } = TONES[toast.tone] || TONES.info;

  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(id);
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      className="pointer-events-auto flex animate-slide-in-start items-start gap-3 border border-edge-lit bg-module-2 p-3 shadow-overlay"
      role="status"
    >
      <span className={cn("mt-0.5 tick shrink-0", tick)} aria-hidden />
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-caption text-text-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="إغلاق الإشعار"
        className="-me-0.5 -mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm text-text-muted transition-colors duration-fast hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast لازم ينستدعى جوّا <ToastProvider>");
  }
  return ctx;
}

/* ---------------------------------------------------------------------------
   Callout — تنبيه ثابت داخل الصفحة (مش عائم).
   --------------------------------------------------------------------------- */
export function Callout({ tone = "info", title, children, className }) {
  const { icon: Icon, color } = TONES[tone] || TONES.info;

  const borders = {
    success: "border-profit/30 bg-profit/[0.06]",
    error: "border-loss/30 bg-loss/[0.06]",
    warning: "border-warning/30 bg-warning/[0.06]",
    info: "border-ice-300/30 bg-ice-200/[0.06]",
  };

  return (
    <div className={cn("flex items-start gap-3 border p-3.5", borders[tone], className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="mb-0.5 text-sm font-medium text-text-primary">{title}</p>}
        <div className="text-caption text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
