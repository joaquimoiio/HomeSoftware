/** @type {import('tailwindcss').Config} */
// O design system mora em context/design.md e usa CSS variables (src/styles/index.css).
// Aqui só mapeamos os tokens para classes Tailwind. NÃO usar Inter/Roboto/Space Grotesk.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          900: "var(--bg-900)",
          800: "var(--bg-800)",
          700: "var(--bg-700)",
        },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        text: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
          faint: "var(--text-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
        },
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
