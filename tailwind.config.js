/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: "#FDF8EC",
          100: "#F5E6B8",
          200: "#E8C468",
          300: "#D4AF37",
          400: "#C9A24B",
          500: "#A07A2E",
          600: "#8B6914",
        },
        ink: "#050505",
        surface: {
          0: "#0A0A0A",
          1: "#0D0D0A",
          2: "#14120A",
          3: "#1A1508",
        },
        text: {
          primary: "#F0EBE0",
          secondary: "#9A9590",
          muted: "#6B6560",
        },
        profit: "#10B981",
        loss: "#EF4444",
        warning: "#F59E0B",
        info: "#4FA8E0",
        discord: "#5865F2",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        card: "0 6px 24px rgba(0, 0, 0, 0.35)",
        glow: "0 0 30px rgba(201, 162, 75, 0.33)",
        "glow-sm": "0 0 16px rgba(201, 162, 75, 0.22)",
        header: "0 1px 0 rgba(201, 162, 75, 0.12)",
      },
      backdropBlur: {
        glass: "14px",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "pulse-soft": "pulseSoft 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      spacing: {
        header: "4.25rem",
        sidebar: "15rem",
      },
    },
  },
  plugins: [],
};
