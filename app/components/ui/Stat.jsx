import { cn } from "@/lib/cn";
import { Delta } from "./Badge";

/* ============================================================================
   Stat — القراءة. عنصر عرض رقم واحد.
   ----------------------------------------------------------------------------
   ثلاثة أحجام = ثلاثة أوزان بصرية. الداشبورد لازم يستخدم أكتر من حجم واحد،
   وإلا بترجع مشكلة "صف بطاقات متطابقة".

     hero → رقم بطل داخل وحدة primary. واحد بالشاشة.
     md   → قراءة ثانوية. أربعة بالصف كحد أقصى.
     sm   → قراءة مضمّنة جوّا وحدة أكبر.

   الذهبي (tone="value") للمال فقط: رصيد، عمولة، اشتراك.
   ============================================================================ */

const SIZES = {
  hero: { value: "text-3xl", label: "text-label", sub: "text-caption", gap: "gap-1.5" },
  md: { value: "text-xl", label: "text-micro", sub: "text-micro", gap: "gap-1" },
  sm: { value: "text-base", label: "text-micro", sub: "text-micro", gap: "gap-0.5" },
};

const TONES = {
  default: "text-text-primary",
  value: "text-au-200",
  profit: "text-profit",
  loss: "text-loss",
  ice: "text-ice-200",
  muted: "text-text-secondary",
};

export default function Stat({
  label,
  value,
  sub,
  delta,
  deltaSuffix = "%",
  tone = "default",
  size = "md",
  icon: Icon,
  className,
}) {
  const s = SIZES[size] || SIZES.md;

  return (
    <div className={cn("flex flex-col", s.gap, className)}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />}
        <span className={cn(s.label, "font-medium uppercase text-text-muted")}>{label}</span>
      </div>

      <span
        dir="ltr"
        className={cn("font-num font-semibold tabular-nums", s.value, TONES[tone] || TONES.default)}
        style={{ unicodeBidi: "isolate" }}
      >
        {value}
      </span>

      {(sub || delta !== undefined) && (
        <div className="flex items-center gap-2">
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} size="sm" />}
          {sub && <span className={cn(s.sub, "text-text-muted")}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   StatGrid — شبكة القراءات الثانوية. مفصولة بخطوط شعرية، مش بطاقات منفصلة.
   بيمنع "صف البطاقات المتطابقة" لأنه كتلة وحدة بصرياً.
   --------------------------------------------------------------------------- */
export function StatGrid({ children, cols = 4, className }) {
  const colCls = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div
      className={cn(
        "grid gap-px border border-edge bg-edge",
        colCls[cols] || colCls[4],
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCell({ children, className }) {
  return <div className={cn("bg-module-1 p-3.5", className)}>{children}</div>;
}

/* ---------------------------------------------------------------------------
   KeyValue — صف تسمية/قيمة. للوحات الجانبية بالتيرمنال.
   --------------------------------------------------------------------------- */
export function KeyValue({ label, value, tone = "default", mono = false, className }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1", className)}>
      <span className="text-caption text-text-muted">{label}</span>
      <span
        dir="ltr"
        className={cn(
          "font-medium tabular-nums",
          mono ? "font-mono text-caption" : "font-num text-sm",
          TONES[tone] || TONES.default
        )}
        style={{ unicodeBidi: "isolate" }}
      >
        {value}
      </span>
    </div>
  );
}
