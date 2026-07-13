import { Bell, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge, Card } from "@/app/components/ui";

export default function ProfileHeaderCard({
  username,
  initials,
  balance,
  balanceLabel,
  subtitle = "متداول محترف",
  welcomeTitle,
  welcomeSubtitle = "نظرة عامة على أدائك في التداول",
  className,
}) {
  return (
    <Card
      variant="elevated"
      padding="md"
      className={cn(
        "mb-5 flex flex-wrap items-center justify-between gap-4 animate-fade-in",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar initials={initials} size="lg" alt={username} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold text-text-primary">{username}</span>
            <Badge variant="vip" size="sm" dot>
              VIP
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
          {balanceLabel && (
            <div className="mt-2 inline-flex items-center rounded-full border border-profit/25 bg-profit/10 px-3 py-1 text-xs font-bold text-profit">
              {balanceLabel}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-lg font-extrabold text-text-primary md:text-xl">
            {welcomeTitle || `مرحباً بك ${username}،`}
          </p>
          <p className="mt-1 text-xs text-text-muted md:text-sm">{welcomeSubtitle}</p>
        </div>
        <Sparkles className="hidden h-5 w-5 text-gold-300/60 sm:block" aria-hidden />
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 hover:border-gold-400/30 hover:text-gold-200"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
