import { cn } from "@/lib/cn";

/* ============================================================================
   Module — الوحدة. البطاقة بنظام ORBIT.
   ----------------------------------------------------------------------------
   ثلاث مستويات بصرية، وكل مستوى إله وظيفة. ما تستخدم "primary" لكل شي —
   لو كل الوحدات بطل، ما بضل في بطل.

     primary   → وحدة بطل: زاوية مشطوفة + حافة معدنية بتلتقط الضوء.
                 وحدة أو اثنتين بالشاشة كحد أقصى.
     secondary → إطار عادي بلا شطف. القراءات الثانوية والقوائم.
     bare      → بلا إطار إطلاقاً. صفوف مفصولة بخط شعري جوّا وحدة أكبر.

   الزاوية المشطوفة معرّفة بـclip-path وبتنعكس تلقائياً بالإنجليزي عبر
   قاعدة [dir="ltr"] بملف globals.css — دايماً بالركن الأمامي حسب اتجاه القراءة.
   ============================================================================ */

const LEVELS = {
  primary: "mod mod-lit shadow-module",
  secondary: "mod-flat shadow-module",
  bare: "mod-bare",
};

const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5 md:p-6",
};

const CHAMFERS = {
  sm: "mod-ch-sm",
  md: "",
  lg: "mod-ch-lg",
};

export default function Module({
  children,
  level = "secondary",
  padding = "none",
  chamfer = "md",
  hover = false,
  className,
  innerClassName,
  ...props
}) {
  const isChamfered = level === "primary";

  if (!isChamfered) {
    return (
      <div
        className={cn(LEVELS[level], PADDINGS[padding], hover && "mod-hover", className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  // المستوى الأول بيحتاج طبقتين: الخارجية = الحافة، الداخلية = السطح.
  // ما بينفع نستخدم border عادي لأن clip-path بياكله.
  return (
    <div
      className={cn(LEVELS[level], CHAMFERS[chamfer], hover && "mod-hover", className)}
      {...props}
    >
      <div className={cn("mod-in", PADDINGS[padding], innerClassName)}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   رأس الوحدة — تسمية (مع حلقة مدارية اختيارية) + قراءة على الطرف المقابل
   --------------------------------------------------------------------------- */
export function ModuleHeader({ children, className, meta }) {
  return (
    <div className={cn("mod-head", className)}>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
      {meta && <span className="mod-meta shrink-0">{meta}</span>}
    </div>
  );
}

export function ModuleTitle({ children, ring = true, tick, className }) {
  return (
    <h3 className={cn("mod-title min-w-0", className)}>
      {ring && <span className="orbit-ring" aria-hidden />}
      {tick && <span className={cn("tick", `tick-${tick}`)} aria-hidden />}
      <span className="truncate">{children}</span>
    </h3>
  );
}

export function ModuleBody({ children, className }) {
  return <div className={cn("mod-body", className)}>{children}</div>;
}

export function ModuleFooter({ children, className }) {
  return (
    <div className={cn("mt-auto border-t border-edge px-4 py-3", className)}>{children}</div>
  );
}

/* ---------------------------------------------------------------------------
   صف داخل وحدة — المستوى الثالث. مفصول بخط شعري، بلا إطار.
   --------------------------------------------------------------------------- */
export function ModuleRow({ children, className, onClick, ...props }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-edge py-2.5 text-start last:border-b-0",
        onClick && "transition-colors duration-base ease-orbit hover:bg-white/[0.025]",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
