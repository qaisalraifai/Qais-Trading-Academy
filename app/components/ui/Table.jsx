import { cn } from "@/lib/cn";

export function Table({ children, className }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-line bg-surface-1">
      <table className={cn("w-full border-collapse text-right text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className }) {
  return (
    <thead className={cn("border-b border-line bg-surface-2/60", className)}>
      <tr>{children}</tr>
    </thead>
  );
}

export function TableTh({ children, className, align = "right" }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary",
        align === "left" && "text-left",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children, className }) {
  return <tbody className={cn("divide-y divide-line", className)}>{children}</tbody>;
}

export function TableRow({ children, className, onClick }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors duration-200",
        onClick && "cursor-pointer hover:bg-surface-2/70",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableTd({ children, className, align = "right", numeric = false }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-text-primary",
        numeric && "table-num",
        align === "left" && "text-left",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </td>
  );
}
