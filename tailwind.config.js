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
  space: { 0: "#060911", 1: "#080B14", 2: "#0C1220" },
  module: { 1: "#111726", 2: "#182033", 3: "#1E2941" },
  edge: { DEFAULT: "#26314A", soft: "#1B2438", lit: "#3E5478", bright: "#55719E" },
  steel: { 100: "#D6DEEE", 200: "#A8B8D8", 300: "#7D8DAE", 400: "#4E5C7A" },
  ice: { 100: "#A8CFF5", 200: "#5FA8E8", 300: "#3C7FC0", 400: "#24507D", 500: "#152E48" },
  au: { 100: "#E4CD95", 200: "#C9A860", 300: "#9C7F42", 400: "#5E4C27", 500: "#33290F" },
  text: { primary: "#EDF1F8", secondary: "#93A0B8", muted: "#5D6880", faint: "#3E4761" },
  profit: "#1FBF87",
  loss: "#E8495F",
  warning: "#E0A44A",
  info: "#5FA8E8",
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
        gold: {
          50: "#F6F0E1",
          100: ORBIT.au[100],
          200: "#D8BC7C",
          300: ORBIT.au[200],
          400: ORBIT.au[200],
          500: ORBIT.au[300],
          600: ORBIT.au[400],
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
        "focus-ice": "0 0 0 1px #24507D, 0 0 0 3px rgba(95, 168, 232, 0.22)",
        /* aliases انتقالية — الوهج صار أخفت بكتير وأبرد */
        card: "0 18px 40px -18px rgba(0, 0, 0, 0.75)",
        glow: "0 0 24px -6px rgba(95, 168, 232, 0.35)",
        "glow-sm": "0 0 14px -6px rgba(95, 168, 232, 0.28)",
        header: "0 1px 0 rgba(38, 49, 74, 0.9)",
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
