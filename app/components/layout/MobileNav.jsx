"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import Sidebar from "./Sidebar";

export default function MobileNav({
  isOpen,
  onClose,
  isAdmin,
  daysLeft,
  activeKey,
  onNavigate,
  onLogout,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة التنقل">
      <button
        type="button"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="إغلاق القائمة"
      />

      <div className="absolute inset-y-0 right-0 flex w-[min(18rem,85vw)] animate-slide-in-right">
        <div className="relative flex h-full w-full flex-col shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:rotate-90 hover:text-gold-200"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>

          <Sidebar
            isAdmin={isAdmin}
            daysLeft={daysLeft}
            activeKey={activeKey}
            onNavigate={(view, key) => {
              onNavigate(view, key);
              onClose();
            }}
            onLogout={onLogout}
            className={cn("h-full w-full border-l-0")}
          />
        </div>
      </div>
    </div>
  );
}
