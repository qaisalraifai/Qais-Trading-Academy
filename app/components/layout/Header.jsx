"use client";

import { useState } from "react";
import { Search, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, IconButton, Input } from "@/app/components/ui";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "./LanguageSwitcher";

/* ============================================================================
   Header — الشريط العلوي. زجاجي، رفيع، بلا وهج.
   ============================================================================ */

export default function Header({
  username,
  initials,
  onMenuToggle,
  showMenuButton = false,
  className,
}) {
  const [searchValue, setSearchValue] = useState("");
  const { t } = useLocale();

  return (
    <header
      className={cn(
        "sticky top-0 z-header flex h-header shrink-0 items-center justify-between gap-3",
        "glass border-b border-edge px-3 md:gap-4 md:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {showMenuButton && (
          <IconButton
            icon={Menu}
            label={t("header.openMenu")}
            onClick={onMenuToggle}
            className="lg:hidden"
          />
        )}

        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="QTA"
            className="h-7 w-7 shrink-0 rounded-sm border border-edge-lit object-cover"
          />
          <div className="hidden min-w-0 sm:block">
            <p className="text-[9px] uppercase leading-tight tracking-[0.16em] text-text-muted">
              Qais Trading
            </p>
            <p className="font-num text-[11px] font-semibold leading-tight tracking-wide text-text-primary">
              ACADEMY
            </p>
          </div>
        </div>
      </div>

      <div className="mx-2 hidden max-w-md flex-1 md:block lg:max-w-lg">
        <Input
          type="text"
          placeholder={t("header.searchPlaceholder")}
          icon={Search}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          aria-label={t("common.search")}
          className="h-8 bg-space-2/70"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitcher />
        <IconButton icon={Bell} label={t("header.notifications")} className="hidden sm:inline-grid" />
        <span className="hidden max-w-[8rem] truncate text-caption text-text-secondary md:block">
          {username}
        </span>
        <Avatar initials={initials} size="sm" alt={username} />
      </div>
    </header>
  );
}
