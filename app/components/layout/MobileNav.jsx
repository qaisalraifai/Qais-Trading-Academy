"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import Sidebar from "./Sidebar";

export default function MobileNav({
  isOpen,
  onClose,
  isAdmin,
  daysLeft,
  onLogout,
}) {
  const { t, dir } = useLocale();

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

  // بالعربية (RTL) القائمة بتنزلق من يمين الشاشة، وبالإنجليزية (LTR) من الشمال
  // — نفس سلوك أي تطبيق احترافي بيحترم اتجاه اللغة.
  const sideClass = dir === "rtl" ? "right-0" : "left-0";

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("header.navMenu")}>
      <button
        type="button"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("header.closeMenu")}
      />

      <div className={cn("absolute inset-y-0 flex w-[min(18rem,85vw)] animate-slide-in-right", sideClass)}>
        <div className="relative flex h-full w-full flex-col shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:rotate-90 hover:text-gold-200"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>

          <Sidebar
            isAdmin={isAdmin}
            daysLeft={daysLeft}
            onNavigate={onClose}
            onLogout={onLogout}
            className={cn("h-full w-full border-l-0")}
          />
        </div>
      </div>
    </div>
  );
}
