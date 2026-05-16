import type { Config } from "tailwindcss"

/**
 * Design system "Concreto Verde" — handoff do Claude Design.
 * As cores apontam para CSS variables (--rai-*) definidas em globals.css,
 * o que mantém o white-label: sobrescrever a variable re-tematiza tudo.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: {
          50: "var(--rai-green-50)",
          100: "var(--rai-green-100)",
          200: "var(--rai-green-200)",
          300: "var(--rai-green-300)",
          400: "var(--rai-green-400)",
          500: "var(--rai-green-500)",
          600: "var(--rai-green-600)",
          700: "var(--rai-green-700)",
          800: "var(--rai-green-800)",
          900: "var(--rai-green-900)",
          950: "var(--rai-green-950)",
        },
        bone: {
          50: "var(--rai-bone-50)",
          100: "var(--rai-bone-100)",
          200: "var(--rai-bone-200)",
          300: "var(--rai-bone-300)",
          400: "var(--rai-bone-400)",
          500: "var(--rai-bone-500)",
        },
        ink: {
          100: "var(--rai-ink-100)",
          200: "var(--rai-ink-200)",
          300: "var(--rai-ink-300)",
          400: "var(--rai-ink-400)",
          500: "var(--rai-ink-500)",
          600: "var(--rai-ink-600)",
          700: "var(--rai-ink-700)",
          800: "var(--rai-ink-800)",
          900: "var(--rai-ink-900)",
        },
        clay: {
          100: "var(--rai-clay-100)",
          300: "var(--rai-clay-300)",
          400: "var(--rai-clay-400)",
          500: "var(--rai-clay-500)",
          600: "var(--rai-clay-600)",
        },
        ochre: {
          100: "var(--rai-ochre-100)",
          300: "var(--rai-ochre-300)",
          400: "var(--rai-ochre-400)",
          500: "var(--rai-ochre-500)",
          600: "var(--rai-ochre-600)",
          700: "var(--rai-ochre-700)",
        },
        iron: {
          100: "var(--rai-iron-100)",
          300: "var(--rai-iron-300)",
          500: "var(--rai-iron-500)",
          600: "var(--rai-iron-600)",
          700: "var(--rai-iron-700)",
        },
        azulejo: {
          100: "var(--rai-azulejo-100)",
          300: "var(--rai-azulejo-300)",
          500: "var(--rai-azulejo-500)",
          600: "var(--rai-azulejo-600)",
          700: "var(--rai-azulejo-700)",
        },
        violet: {
          100: "var(--rai-violet-100)",
          300: "var(--rai-violet-300)",
          500: "var(--rai-violet-500)",
          600: "var(--rai-violet-600)",
        },
        paper: "var(--rai-bg)",
        surface: "var(--rai-surface)",
        "surface-2": "var(--rai-surface-2)",
        "surface-3": "var(--rai-surface-3)",
        line: "var(--rai-border)",
        "line-strong": "var(--rai-border-strong)",
        divider: "var(--rai-divider)",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "1.4" }],
        sm: ["13px", { lineHeight: "1.45" }],
        base: ["15px", { lineHeight: "1.45" }],
        md: ["17px", { lineHeight: "1.45" }],
        lg: ["20px", { lineHeight: "1.3" }],
        xl: ["24px", { lineHeight: "1.25" }],
        "2xl": ["30px", { lineHeight: "1.2" }],
        "3xl": ["38px", { lineHeight: "1.15" }],
        "4xl": ["48px", { lineHeight: "1.1" }],
        "5xl": ["64px", { lineHeight: "1.05" }],
        "6xl": ["84px", { lineHeight: "1" }],
      },
      letterSpacing: {
        tight: "-0.025em",
        snug: "-0.015em",
        normal: "0",
        wide: "0.06em",
        caps: "0.14em",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        1: "0 1px 0 rgba(20,19,13,.04), 0 1px 2px rgba(20,19,13,.04)",
        2: "0 1px 0 rgba(20,19,13,.04), 0 4px 12px rgba(20,19,13,.06)",
        3: "0 2px 0 rgba(20,19,13,.04), 0 12px 28px rgba(20,19,13,.10)",
        4: "0 2px 0 rgba(20,19,13,.04), 0 24px 56px rgba(20,19,13,.16)",
        hair: "0 0 0 1px var(--rai-border)",
      },
      transitionTimingFunction: {
        rai: "cubic-bezier(.2,.7,.3,1)",
        "rai-out": "cubic-bezier(.16,1,.3,1)",
      },
    },
  },
  plugins: [],
}

export default config
