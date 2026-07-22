"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { SUPPORTED_LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function LanguageSwitcher({ className = "" }) {
  const { locale, meta, t, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("header.language")}
        title={t("header.language")}
        className="flex h-10 items-center gap-1.5 rounded-full border border-gold-400/15 bg-surface-1 px-3 text-xs font-bold text-text-muted transition-all duration-300 ease-premium hover:border-gold-400/40 hover:text-gold-200"
      >
        <Globe className="h-4 w-4" />
        <span>{meta.flag}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-40 overflow-hidden rounded-lg border border-gold-400/20 bg-surface-2 shadow-header"
          style={{ insetInlineEnd: 0 }}
        >
          {SUPPORTED_LOCALES.map((code) => {
            const m = LOCALE_META[code];
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-gold-400/10 font-bold text-gold-200" : "text-text-secondary hover:bg-white/5"
                }`}
              >
                <span>{m.flag}</span>
                <span>{m.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
