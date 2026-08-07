"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { IconButton } from "@/app/components/ui";
import Sidebar from "./Sidebar";

/* ============================================================================
   MobileNav — القائمة الجانبية على الموبايل.
   بتنزلق من الحافة الأمامية (يمين بالعربي، يسار بالإنجليزي) — كلها خصائص
   منطقية، فما في شرط على dir بالكود.
   ============================================================================ */

export default function MobileNav({ isOpen, onClose, isAdmin, daysLeft, onLogout }) {
  const { t } = useLocale();

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-overlay lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("header.navMenu")}
    >
      <button
        type="button"
        className="absolute inset-0 animate-fade-in bg-space-0/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("header.closeMenu")}
      />

      <div
        className="absolute inset-y-0 flex w-[min(18rem,85vw)] animate-slide-in-start shadow-overlay"
        style={{ insetInlineStart: 0 }}
      >
        <div className="relative flex h-full w-full">
          <div className="absolute top-2.5 z-10" style={{ insetInlineEnd: "0.625rem" }}>
            <IconButton icon={X} label={t("common.close")} onClick={onClose} size="sm" />
          </div>

          <Sidebar
            isAdmin={isAdmin}
            daysLeft={daysLeft}
            onNavigate={onClose}
            onLogout={onLogout}
            className="h-full w-full border-e-0"
          />
        </div>
      </div>
    </div>
  );
}
