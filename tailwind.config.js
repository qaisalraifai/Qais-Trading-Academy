/** @type {import('tailwindcss').Config} */

/* ============================================================================
   ORBIT — نظام التصميم البصري لأكاديمية قيس
   ----------------------------------------------------------------------------
   مبادئ البالِت (لا تُكسر):
     · الفولاذ  steel  → المعدن: الحواف، الحلقات، الأيقونات الثانوية
     · الجليد   ice    → التفاعل فقط: الحالة النشطة، الروابط، التركيز
     · الذهب    au     → القيمة المالية فقط: الرصيد، العمولة، الاشتراك، الإنجاز
     · profit/loss     → نتيجة الصفقة فقط، ما بتستخدم كلون ديكور
   الأسماء القديمة (gold-* / surface-* / line) مضلّها شغّالة كـ aliases على
   القيم الجديدة، عشان الصفحات يلي لسا ما اترحّلت تاخد البالِت الجديدة فوراً
   بدون ما تنكسر. بتنشال بعد ما يخلص الترحيل.
   ============================================================================ */

const ORBIT = {
  space: { 0: "#050308", 1: "#0A0614", 2: "#0E0A1A" },
  module: { 1: "#141024", 2: "#1C1630", 3: "#241C3E" },
  edge: { DEFAULT: "#2A2145", soft: "#1E1836", lit: "#3D2F63", bright: "#54418A" },
  steel: { 100: "#E9E4FA", 200: "#B9AEDC", 300: "#8A7CB8", 400: "#5C5188" },
  /* البنفسجي = الهوية والحالة النشطة */
  violet: { 100: "#C4B0FF", 200: "#7C4DFF", 300: "#5B32D6", 400: "#3C2090", 500: "#231354" },
  /* السماوي = التفاعل الثانوي، الروابط، البيانات الحيّة */
  cyan: { 100: "#8FEEFF", 200: "#22D3EE", 300: "#12A5BE", 400: "#0C6D7E" },
  /* ice = alias انتقالي على البنفسجي (كان لون التفاعل بـORBIT) */
  ice: { 100: "#C4B0FF", 200: "#7C4DFF", 300: "#5B32D6", 400: "#3C2090", 500: "#231354" },
  /* au = القيمة المالية. ما بقى لون — صار سطوع. الرقم بيبرز بالوزن مش باللون. */
  au: { 100: "#F5F3FF", 200: "#DCD4F7", 300: "#8A7CB8", 400: "#3D2F63", 500: "#231354" },
  text: { primary: "#F5F3FF", secondary: "#A79FC4", muted: "#6E6690", faint: "#4A4368" },
  profit: "#10E5A0",
  loss: "#FF453A",
  warning: "#F0A13C",
  info: "#22D3EE",
};

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ---------- ORBIT ---------- */
        space: ORBIT.space,
        module: ORBIT.module,
        edge: ORBIT.edge,
        steel: ORBIT.steel,
        violet: ORBIT.violet,
        cyan: ORBIT.cyan,
        ice: ORBIT.ice,
        au: ORBIT.au,

        /* ---------- دلالي ---------- */
        profit: ORBIT.profit,
        loss: ORBIT.loss,
        warning: ORBIT.warning,
        info: ORBIT.info,
        discord: "#5865F2",

        text: {
          primary: ORBIT.text.primary,
          secondary: ORBIT.text.secondary,
          muted: ORBIT.text.muted,
          faint: ORBIT.text.faint,
        },

        /* ---------- aliases انتقالية ---------- */
        /* الذهبي انحذف من الهوية — الأسماء القديمة بتشير على سلّم القيمة
           (سطوع، مش لون) لحتى تخلص إزالتها من كل الصفحات. */
        gold: {
          50: "#FFFFFF",
          100: ORBIT.au[100],
          200: ORBIT.au[200],
          300: ORBIT.steel[200],
          400: ORBIT.violet[200],
          500: ORBIT.violet[300],
          600: ORBIT.violet[400],
        },
        ink: ORBIT.space[1],
        surface: {
          0: ORBIT.space[1],
          1: ORBIT.module[1],
          2: ORBIT.module[2],
          3: ORBIT.module[3],
        },
        line: ORBIT.edge.DEFAULT,
      },

      /* لون الحدّ الافتراضي — Tailwind بيحطّ gray-200 لو ما حدّدت لون.
         هيك حتى الحدود يلي انكتبت بدون لون بتقع على النظام. */
      borderColor: { DEFAULT: ORBIT.edge.DEFAULT },

      fontFamily: {
        /* واجهة — عربي ولاتيني من نفس العائلة (IBM Plex Sans Arabic) */
        sans: ["var(--font-ui)", "IBM Plex Sans Arabic", "Segoe UI", "system-ui", "sans-serif"],
        /* عناوين وأرقام كبيرة — جروتيسك صناعي بأرقام جدولية ممتازة */
        display: ["var(--font-display)", "Archivo", "var(--font-ui)", "system-ui", "sans-serif"],
        num: ["var(--font-display)", "Archivo", "var(--font-ui)", "system-ui", "sans-serif"],
        /* رموز الأزواج، التوقيتات، المعرّفات */
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },

      fontSize: {
        /* السلّم الطباعي — كل حجم إله وظيفة واحدة */
        micro: ["0.625rem", { lineHeight: "1.4", letterSpacing: "0.14em" }], // 10px تسميات
        label: ["0.6875rem", { lineHeight: "1.45", letterSpacing: "0.12em" }], // 11px تسمية وحدة
        caption: ["0.75rem", { lineHeight: "1.6" }], // 12px شرح
        sm: ["0.8125rem", { lineHeight: "1.7" }], // 13px نص ثانوي
        base: ["0.9063rem", { lineHeight: "1.8" }], // 14.5px نص أساسي
        lg: ["1.0625rem", { lineHeight: "1.55", letterSpacing: "-0.005em" }], // 17px عنوان وحدة
        xl: ["1.375rem", { lineHeight: "1.35", letterSpacing: "-0.015em" }], // 22px عنوان صفحة
        "2xl": ["1.75rem", { lineHeight: "1.25", letterSpacing: "-0.02em" }], // 28px
        "3xl": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.028em" }], // 36px رقم بطل
        "4xl": ["3rem", { lineHeight: "1", letterSpacing: "-0.035em" }], // 48px
      },

      borderRadius: {
        /* ORBIT = حواف قائمة. الانحناء بس للعناصر الصغيرة اللمسية. */
        DEFAULT: "3px",
        none: "0",
        xs: "2px",
        sm: "3px",
        md: "4px",
        lg: "6px",
        xl: "8px",
        pill: "999px",
      },

      boxShadow: {
        module: "0 18px 40px -18px rgba(0, 0, 0, 0.75)",
        raised: "0 24px 56px -20px rgba(0, 0, 0, 0.85)",
        overlay: "0 32px 80px -24px rgba(0, 0, 0, 0.9)",
        /* الحافة المعدنية — ضوء بيلمس حرف المعدن */
        edge: "inset 0 1px 0 rgba(255, 255, 255, 0.055)",
        "focus-ice": "0 0 0 1px #3C2090, 0 0 0 3px rgba(124, 77, 255, 0.28)",
        /* توهّج بنفسجي — للهبوط والباقات فقط، مش للتيرمنال */
        "glow-violet": "0 0 34px -8px rgba(124, 77, 255, 0.45)",
        /* aliases انتقالية */
        card: "0 18px 40px -18px rgba(0, 0, 0, 0.75)",
        glow: "0 0 24px -6px rgba(124, 77, 255, 0.35)",
        "glow-sm": "0 0 14px -6px rgba(124, 77, 255, 0.26)",
        header: "0 1px 0 rgba(42, 33, 69, 0.9)",
      },

      backdropBlur: { glass: "16px" },

      transitionTimingFunction: {
        /* حركة مدارية — دخول سريع، استقرار طويل */
        orbit: "cubic-bezier(0.16, 1, 0.3, 1)",
        premium: "cubic-bezier(0.16, 1, 0.3, 1)",
        enter: "cubic-bezier(0.05, 0.7, 0.1, 1)",
        exit: "cubic-bezier(0.3, 0, 0.8, 0.15)",
      },

      transitionDuration: {
        fast: "140ms",
        base: "220ms",
        slow: "380ms",
        orbit: "600ms",
      },

      animation: {
        "fade-in": "orbFadeIn 220ms cubic-bezier(0.05, 0.7, 0.1, 1) forwards",
        "rise-in": "orbRiseIn 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-start": "orbSlideInStart 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-right": "orbSlideInStart 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "orbScaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "orbit-spin": "orbSpin 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "orbPulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "sweep": "orbSweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        /* انتقال الصفحات جوّا المنصّة — بديل `fade-in` المجرّد.
           ⚠️ الفرق مقصود: `fade-in` تلاشٍ ٢٢٠ms بلا حركة، فالصفحة «بتظهر»
           مكانها. هون في اقتراب طفيف (٠.٩٩٤→١ و١٠px) بيقرأ كـ«وصلنا» —
           وهاد بالضبط طلبه: «من صفحة لصفحة… مستوحى من الفضاء».
           ٤٢٠ms: أطول من التلاشي بما يكفي ليُحسّ، وأقصر من أن ينتظره أحد.

           🔴 **بلا `forwards` — وهاد شرط صحة مش أسلوب.**
           باقي الحركات هون بتنتهي على حالة **مختلفة** عن الطبيعية فبتلزمها.
           هاي بتنتهي على الحالة الطبيعية بالضبط (ظاهر · بلا إزاحة)، و`forwards`
           بتثبّت آخر إطار للأبد — يعني `transform` بيضل مطبَّقاً. وأي تحويل،
           **حتى مصفوفة الهوية**، بيخلّي العنصر حاوية لكل `position: fixed`
           جوّاه: كل نافذة منبثقة بالمنصّة بتتموضع بالنسبة لهالصندوق بدل
           الشاشة.
           ⚠️ جرّبت أول `transform: none` بآخر إطار وما كفت — القيمة المحسوبة
           طلعت `matrix(1, 0, 0, 1, 0, 0)` مش `none`. بلا `forwards` العنصر
           بيرجع لحالته الطبيعية فالتحويل بينتهي فعلاً. */
        "warp-in": "orbWarpIn 420ms cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        orbFadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        orbRiseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        orbSlideInStart: {
          "0%": { opacity: "0", transform: "translateX(calc(16px * var(--orb-dir, 1)))" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        orbScaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        orbWarpIn: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.994)" },
          "100%": { opacity: "1", transform: "none" },
        },
        orbSpin: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        orbPulse: { "0%, 100%": { opacity: "0.45" }, "50%": { opacity: "1" } },
        orbSweep: {
          "0%": { transform: "translateX(calc(-100% * var(--orb-dir, 1)))" },
          "100%": { transform: "translateX(calc(100% * var(--orb-dir, 1)))" },
        },
      },

      spacing: {
        header: "3.25rem",
        rail: "3.625rem",
        sidebar: "15rem",
      },

      zIndex: { rail: "30", header: "40", overlay: "50", modal: "60", toast: "70" },
    },
  },
  plugins: [],
};
