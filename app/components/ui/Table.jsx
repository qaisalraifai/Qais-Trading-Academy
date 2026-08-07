import { cn } from "@/lib/cn";

/* ============================================================================
   Table
   ----------------------------------------------------------------------------
   المحاذاة منطقية: text-start افتراضياً، فبتنقلب صح بالإنجليزي بدون أي شرط.
   الأرقام دايماً tabular-nums و dir="ltr" معزولة عشان الأعمدة تتحاذى
   والإشارة السالبة ما تقفز لآخر الرقم بالعربي.
   ============================================================================ */

export function Table({ children, className, containerClassName }) {
  return (
    <div className={cn("w-full overflow-x-auto", containerClassName)}>
      <table className={cn("w-full border-collapse text-start text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className }) {
  return (
    <thead className={cn(className)}>
      <tr>{children}</tr>
    </thead>
  );
}

const ALIGN = { start: "text-start", end: "text-end", center: "text-center" };

export function TableTh({ children, className, align = "start" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-edge px-3 pb-2 pt-0 text-micro font-medium uppercase text-text-muted",
        ALIGN[align] || ALIGN.start,
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children, className }) {
  return <tbody className={cn(className)}>{children}</tbody>;
}

export function TableRow({ children, className, onClick, selected }) {
  return (
    <tr
      onClick={onClick}
      aria-selected={selected || undefined}
      className={cn(
        "border-b border-edge last:border-b-0 transition-colors duration-fast ease-orbit",
        selected && "bg-ice-200/[0.07]",
        onClick && "cursor-pointer hover:bg-white/[0.028]",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableTd({ children, className, align = "start", numeric = false, strong = false }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-text-secondary",
        strong && "font-medium text-text-primary",
        numeric && "font-num tabular-nums",
        ALIGN[align] || ALIGN.start,
        className
      )}
    >
      {numeric ? (
        <span dir="ltr" className="inline-block" style={{ unicodeBidi: "isolate" }}>
          {children}
        </span>
      ) : (
        children
      )}
    </td>
  );
}

/* ---------------------------------------------------------------------------
   TableEmpty — صف فاضي بيمتد على كل الأعمدة
   --------------------------------------------------------------------------- */
export function TableEmpty({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-caption text-text-muted">
        {children}
      </td>
    </tr>
  );
}
