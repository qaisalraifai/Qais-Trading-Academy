"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Tooltip — بيظهر بالهوفر وبالتركيز بلوحة المفاتيح (مش بس الماوس).
   ============================================================================ */

const SIDES = {
  top: "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2",
  bottom: "top-[calc(100%+6px)] left-1/2 -translate-x-1/2",
  start: "top-1/2 end-[calc(100%+6px)] -translate-y-1/2",
  end: "top-1/2 start-[calc(100%+6px)] -translate-y-1/2",
};

export default function Tooltip({ label, children, side = "top", className }) {
  const [show, setShow] = useState(false);
  const id = useId();

  if (!label) return children;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <span aria-describedby={show ? id : undefined}>{children}</span>

      {show && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-overlay w-max max-w-[16rem] animate-fade-in",
            "border border-edge-lit bg-module-3 px-2 py-1 text-caption text-text-secondary shadow-overlay",
            SIDES[side] || SIDES.top
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
