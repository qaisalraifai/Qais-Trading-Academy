import { cn } from "@/lib/cn";
import Module from "./Module";

/* ============================================================================
   Card — غلاف توافق خلفي فوق Module.
   ----------------------------------------------------------------------------
   الصفحات القديمة لسا بتستورد Card بنفس الـprops، فمنخليها شغّالة بس منمرّرها
   على مستويات ORBIT الجديدة. الكود الجديد لازم يستخدم <Module> مباشرة —
   إلها تحكّم أوضح بالمستوى والشطف.
   ============================================================================ */

const VARIANT_TO_LEVEL = {
  default: "secondary",
  flat: "secondary",
  elevated: "primary",
  vip: "primary",
};

const PADDINGS = { none: "", sm: "p-3", md: "p-4", lg: "p-5 md:p-6" };

export default function Card({
  children,
  className,
  variant = "default",
  padding = "md",
  hover = false,
  ...props
}) {
  const level = VARIANT_TO_LEVEL[variant] || "secondary";

  return (
    <Module
      level={level}
      padding={level === "primary" ? "none" : padding}
      innerClassName={level === "primary" ? PADDINGS[padding] : undefined}
      hover={hover}
      className={cn(variant === "vip" && "mod-au", className)}
      {...props}
    >
      {children}
    </Module>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return <h3 className={cn("text-lg font-semibold text-text-primary", className)}>{children}</h3>;
}

export function CardDescription({ children, className }) {
  return <p className={cn("text-caption text-text-muted", className)}>{children}</p>;
}
