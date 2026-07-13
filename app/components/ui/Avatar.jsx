import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-[3.25rem] w-[3.25rem] text-xl",
  xl: "h-14 w-14 text-2xl",
};

export default function Avatar({
  initials,
  src,
  alt = "",
  size = "md",
  className,
}) {
  if (src) {
    return (
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-full border-2 border-gold-400/50 shadow-glow-sm",
          sizes[size],
          className
        )}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-gold-400",
        "gold-gradient-bg font-bold text-ink shadow-glow-sm",
        sizes[size],
        className
      )}
      aria-label={alt || initials}
    >
      {initials}
    </div>
  );
}
