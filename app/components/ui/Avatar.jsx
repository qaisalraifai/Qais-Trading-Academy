import { cn } from "@/lib/cn";

/* ============================================================================
   Avatar — حواف قائمة بحلقة معدنية رفيعة. مش دائرة مذهّبة متوهّجة.
   ============================================================================ */

const SIZES = {
  sm: "h-7 w-7 text-micro",
  md: "h-9 w-9 text-caption",
  lg: "h-12 w-12 text-base",
  xl: "h-14 w-14 text-lg",
};

export default function Avatar({ initials, src, alt = "", size = "md", className }) {
  const base = cn(
    "shrink-0 overflow-hidden rounded-sm border border-edge-lit bg-module-2",
    SIZES[size],
    className
  );

  if (src) {
    return (
      <div className={base}>
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(base, "grid place-items-center font-num font-semibold text-steel-200")}
      aria-label={alt || initials}
    >
      {initials}
    </div>
  );
}
