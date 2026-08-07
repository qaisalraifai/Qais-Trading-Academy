"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Dropdown — قائمة منسدلة. بتفتح بمحاذاة الجهة الأمامية حسب اتجاه اللغة.
   ============================================================================ */

export default function Dropdown({
  trigger,
  children,
  align = "start",
  className,
  panelClassName,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative inline-block", className)}>
      <div
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
      >
        {trigger}
      </div>

      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "absolute top-[calc(100%+4px)] z-overlay min-w-[11rem] animate-scale-in",
            "border border-edge-lit bg-module-2 py-1 shadow-overlay",
            align === "end" ? "end-0" : "start-0",
            panelClassName
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  icon: Icon,
  onClick,
  danger = false,
  active = false,
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors duration-fast ease-orbit",
        "disabled:cursor-not-allowed disabled:opacity-45",
        danger
          ? "text-loss hover:bg-loss/10"
          : active
            ? "bg-ice-200/10 text-ice-100"
            : "text-text-secondary hover:bg-white/[0.045] hover:text-text-primary",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-edge" role="separator" />;
}

export function DropdownLabel({ children }) {
  return <div className="px-3 py-1.5 text-micro uppercase text-text-muted">{children}</div>;
}
