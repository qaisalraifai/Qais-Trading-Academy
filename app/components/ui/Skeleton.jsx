import { cn } from "@/lib/cn";

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-md bg-gradient-to-l from-surface-2 to-surface-1",
        className
      )}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn("glass-card space-y-3 p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
