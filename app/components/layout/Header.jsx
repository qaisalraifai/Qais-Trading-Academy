"use client";

import { useState } from "react";
import { Search, Bell, MessageSquare, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge, Input } from "@/app/components/ui";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "./LanguageSwitcher";

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
        "sticky top-0 z-40 flex h-header shrink-0 items-center justify-between gap-3",
        "border-b border-gold-400/10 bg-gradient-to-b from-surface-3/95 to-surface-0/95",
        "px-4 shadow-header backdrop-blur-glass md:gap-4 md:px-6",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-gold-400/15 bg-surface-1 text-text-secondary transition-all duration-300 ease-premium hover:scale-110 hover:border-gold-400/40 hover:text-gold-200 lg:hidden"
            aria-label={t("header.openMenu")}
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Avatar src="/logo.jpg" alt="QTA" size="sm" className="h-9 w-9 border-gold-400/60" />
          <div className="hidden min-w-0 sm:block">
            <p className="eyebrow mb-0 leading-none">QAIS TRADING</p>
            <p className="text-xs font-bold text-text-primary">ACADEMY</p>
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
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <LanguageSwitcher />

        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:scale-110 hover:border-gold-400/40 hover:text-gold-200 hover:shadow-glow-sm sm:flex"
          aria-label={t("header.notifications")}
        >
          <Bell className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:scale-110 hover:border-gold-400/40 hover:text-gold-200 hover:shadow-glow-sm sm:flex"
          aria-label={t("header.messages")}
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-2 md:flex">
          <span className="max-w-[8rem] truncate text-sm font-bold text-text-primary">
            {username}
          </span>
          <Badge variant="vip" size="sm" dot>
            VIP
          </Badge>
        </div>

        <Avatar initials={initials} size="sm" alt={username} />
      </div>
    </header>
  );
}
