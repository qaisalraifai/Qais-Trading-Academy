import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/app/components/ui";

/* ============================================================================
   ProfileHeaderCard — شريط ترحيب. صار خفيف بلا بطاقة، لأن مركز القيادة
   لازم يبلّش بالبيانات المهمّة مش ببطاقة ترحيب بتاخد مساحة.
   ============================================================================ */

export default function ProfileHeaderCard({
  username,
  initials,
  balance,
  balanceLabel,
  subtitle,
  welcomeTitle,
  welcomeSubtitle,
  className,
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar initials={initials} size="lg" alt={username} />
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.16em] text-text-muted">
            {welcomeSubtitle || "Command Center"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-text-primary">
              {welcomeTitle || username}
            </h1>
            <Badge variant="value" size="sm">
              VIP
            </Badge>
          </div>
          {subtitle && <p className="mt-0.5 text-caption text-text-muted">{subtitle}</p>}
        </div>
      </div>

      {balanceLabel && (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-micro uppercase text-text-muted">الرصيد</span>
          <span
            dir="ltr"
            className="font-num text-xl font-semibold tabular-nums text-au-200"
            style={{ unicodeBidi: "isolate" }}
          >
            {balanceLabel}
          </span>
        </div>
      )}
    </div>
  );
}
