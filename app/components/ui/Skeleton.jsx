import { cn } from "@/lib/cn";

/* ============================================================================
   Skeleton — حالة التحميل. مسح ضوئي بيمشي باتجاه القراءة (--orb-dir).
   ما بينبض بالشفافية — المسح أهدأ وأغلى بالإحساس.
   ============================================================================ */

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-sm bg-module-2", className)}
      aria-hidden
      {...props}
    >
      <div
        className="absolute inset-0 animate-sweep"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(168,184,216,0.07), transparent)",
        }}
      />
    </div>
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-2.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn("mod-flat flex flex-col gap-3 p-4", className)}>
      <Skeleton className="h-2.5 w-1/3" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-2 w-1/2" />
    </div>
  );
}

export function SkeletonStatGrid({ cols = 4 }) {
  return (
    <div className="grid gap-px border border-edge bg-edge" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 bg-module-1 p-3.5">
          <Skeleton className="h-2 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-2 w-3/4" />
        </div>
      ))}
    </div>
  );
}
