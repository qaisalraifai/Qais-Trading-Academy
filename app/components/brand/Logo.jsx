"use client";

import { useId } from "react";

/* ============================================================================
   شعار QTA — هوية NEBULA.
   ----------------------------------------------------------------------------
   الفكرة: حرف Q مبني كـ"مدار" — حلقة كاملة يقطعها مسار مائل، ونواة مضيئة
   بالمركز. ذيل الـQ هو المسار المداري نفسه، مش زخرفة مضافة.

   ليش هيك:
     · بيقرأ Q بوضوح بأي حجم — النواة والحلقة بيعطوا الشكل حتى بـ16px
     · المدار بيربط الشعار بلغة النظام (نقاط الرِيل، الحلقات، الشطف)
     · التدرّج الإيريدسنت نفسه المستخدم بحواف الوحدات — هوية واحدة

   الاستخدام:
     <Logo />                    أيقونة 32px
     <Logo size={64} />          أحجام أكبر
     <Logo withWordmark />       أيقونة + الاسم
     <Logo mono />               نسخة أحادية اللون (طباعة، فاتح، تباين عالي)
   ============================================================================ */

export default function Logo({
  size = 32,
  withWordmark = false,
  mono = false,
  className,
  title = "Qais Trading Academy",
}) {
  /* useId بدل عدّاد على مستوى الموديول: العدّاد بيعطي رقم مختلف بالسيرفر
     عن العميل فبيصير hydration mismatch. useId مضمون إنه نفسه بالطرفين. */
  const id = useId().replace(/:/g, "");
  const stroke = mono ? "currentColor" : `url(#${id}-ring)`;
  const core = mono ? "currentColor" : `url(#${id}-core)`;

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      {!mono && (
        <defs>
          <linearGradient id={`${id}-ring`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C4DFF" />
            <stop offset="0.45" stopColor="#9F6CFF" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
          <linearGradient id={`${id}-core`} x1="18" y1="18" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C4B0FF" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
      )}

      {/* الحلقة — جسم الـQ */}
      <circle cx="24" cy="24" r="17.5" stroke={stroke} strokeWidth="3" opacity={mono ? 0.55 : 1} />

      {/* المسار المداري — ذيل الـQ، بيقطع الحلقة بالركن السفلي */}
      <path
        d="M29 29 L41.5 41.5"
        stroke={stroke}
        strokeWidth="3.4"
        strokeLinecap="round"
      />

      {/* قوس مداري خفيف — بيعطي العمق وبيربط الشكل بلغة النظام */}
      <ellipse
        cx="24"
        cy="24"
        rx="17.5"
        ry="6.5"
        stroke={stroke}
        strokeWidth="1.4"
        opacity={mono ? 0.28 : 0.5}
        transform="rotate(-28 24 24)"
      />

      {/* النواة */}
      <circle cx="24" cy="24" r="5" fill={core} />
    </svg>
  );

  if (!withWordmark) return mark;

  return (
    <span className="inline-flex items-center gap-2.5">
      {mark}
      <span className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted">Qais Trading</span>
        <span className="font-num text-[13px] font-semibold tracking-wide text-text-primary">
          ACADEMY
        </span>
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   LogoGlyph — النواة والحلقة بس، بلا ذيل. للأماكن الضيّقة جداً (فافيكون،
   شارة الإشعار، الأفاتار الافتراضي).
   --------------------------------------------------------------------------- */
export function LogoGlyph({ size = 20, className }) {
  const id = `g${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={id} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C4DFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill={`url(#${id})`} />
    </svg>
  );
}
