"use client";

import { Globe } from "lucide-react";
import { SUPPORTED_LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Dropdown, DropdownItem } from "@/app/components/ui";
import { cn } from "@/lib/cn";

export default function LanguageSwitcher({ className }) {
  const { locale, meta, t, setLocale } = useLocale();

  return (
    <Dropdown
      align="end"
      className={className}
      trigger={
        <button
          type="button"
          aria-label={t("header.language")}
          title={t("header.language")}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-edge bg-module-1 px-2.5 text-caption text-text-secondary transition-colors duration-base ease-orbit hover:border-edge-lit hover:text-text-primary"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden />
          <span className="font-num font-medium uppercase">{locale}</span>
        </button>
      }
    >
      {SUPPORTED_LOCALES.map((code) => {
        const m = LOCALE_META[code];
        return (
          <DropdownItem key={code} active={code === locale} onClick={() => setLocale(code)}>
            <span className={cn("font-num me-2 text-micro uppercase", code === locale ? "text-ice-100" : "text-text-muted")}>
              {code}
            </span>
            {m.nativeName}
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
