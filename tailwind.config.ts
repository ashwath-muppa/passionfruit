import type { Config } from "tailwindcss";

// Passionfruit — Direction A · Warm Paper. Tokens mirror docs/DESIGN.md §3.
// Keep this file and the design doc in sync.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        passionfruit: {
          // Surface
          paper: "#FBF6EE",
          card: "#FFFFFF",
          sunk: "#F4EDE2",
          line: "#EFE5D6",
          lineSoft: "#EBDFCF",
          // Ink
          ink: "#2C2420",
          body: "#3A2D27",
          muted: "#6F6258",
          faint: "#A0917F",
          // Accent (coral)
          accent: "#E8694A",
          accentDeep: "#D4533A",
          accentInk: "#C2492C",
          wash: "#FCE9E0",
          accentLine: "#F4D9CC",
          // Categorical (share chroma; stable categories)
          gold: "#F2B23E",
          berry: "#D87BA0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        sheet: "22px",
        phone: "36px",
      },
      boxShadow: {
        sheet: "0 8px 22px -16px rgba(90,60,40,.4)",
        frame: "0 30px 60px -28px rgba(60,40,30,.45)",
        elev: "0 16px 34px -24px rgba(90,60,40,.5)",
      },
      keyframes: {
        "pf-float": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pf-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pf-pop": {
          "0%": { transform: "scale(.6)", opacity: "0" },
          "60%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "pf-float": "pf-float 3s ease-in-out infinite",
        "pf-in": "pf-in .35s ease both",
        "pf-pop": "pf-pop .35s ease",
      },
    },
  },
  plugins: [],
};

export default config;
