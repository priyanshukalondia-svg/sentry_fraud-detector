/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0D12",
        panel: "#12161F",
        "panel-raised": "#191E2A",
        "panel-hover": "#1E2430",
        hairline: "#232A38",
        "hairline-bright": "#323B4E",
        "text-primary": "#E8EBF2",
        "text-muted": "#8891A3",
        "text-dim": "#545D70",
        signal: {
          low: "#34D399",
          medium: "#FBBF24",
          high: "#FB923C",
          critical: "#F43F5E",
        },
        cyan: {
          glow: "#22D3EE",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(34,211,238,0.08)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.4, transform: "scale(1.4)" },
        },
        sweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "slide-in": {
          "0%": { opacity: 0, transform: "translateY(-6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        sweep: "sweep 4s linear infinite",
        "slide-in": "slide-in 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
