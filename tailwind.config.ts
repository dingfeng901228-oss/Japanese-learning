import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Spec §5 colors. Aliased for use like `bg-ink`, `text-ink-500`,
      // `border-line`, `bg-soft`. Use inline Tailwind gray-* for
      // micro-tints (e.g. bg-gray-100 in the progress bar).
      colors: {
        ink: {
          DEFAULT: "#111827",
          700: "#374151",
          500: "#6B7280",
        },
        line: "#E5E7EB",
        soft: "#F9FAFB",
        accent: "#2563EB",
        success: "#16A34A",
        streak: "#DB2777",
      },
      // Spec §6 fonts. --font-* are wired by next/font in app/layout.tsx.
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        jp: [
          "var(--font-noto-jp)",
          "ui-sans-serif",
          "system-ui",
          "Hiragino Sans",
          "sans-serif",
        ],
        sc: [
          "var(--font-noto-sc)",
          "ui-sans-serif",
          "system-ui",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
