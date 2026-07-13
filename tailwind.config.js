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
          50: "#FDFAF0",
          100: "#F7EAB8",
          200: "#F2D57E",
          300: "#D4AF37",
          400: "#C9A227",
          500: "#9C7A22",
          600: "#7A5F14",
        },
        ink: "#0B0B0B",
        surface: {
          0: "#0B0B0B",
          1: "#141414",
          2: "#1E1E1E",
          3: "#242424",
        },
        line: "#2A2A2A",
        text: {
          primary: "#F5F5F5",
          secondary: "#9A9A9A",
          muted: "#6E6E6E",
        },
        profit: "#00C853",
        loss: "#FF4D4F",
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
        card: "0 6px 24px rgba(0, 0, 0, 0.5)",
        glow: "0 0 30px rgba(212, 175, 55, 0.35)",
        "glow-sm": "0 0 16px rgba(212, 175, 55, 0.24)",
        header: "0 1px 0 rgba(212, 175, 55, 0.15)",
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
