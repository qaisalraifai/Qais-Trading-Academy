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
        <Sparkles className="hidden h-6 w-6 animate-pulse-soft text-gold-300/70 sm:block" aria-hidden />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/15 bg-surface-1 text-text-muted transition-all duration-300 ease-premium hover:scale-110 hover:border-gold-400/40 hover:text-gold-200 hover:shadow-glow-sm"
          aria-label="الإشعارات"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </Card>
  );
}
