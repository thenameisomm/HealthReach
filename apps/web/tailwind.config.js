/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#6366F1", hover: "#4F46E5" },
        canvas: "#FAFAFA",
        surface: "#FFFFFF",
        ink: "#0A0A0A",
        secondary: "#6B6B6B",
        line: "#E8E8EC",
        muted: "#9C9C9C",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        brandmark: "#20970B",
      },
      borderRadius: { card: "12px", input: "6px" },
      fontFamily: {
        display: ['"General Sans"', '"DM Sans"', "system-ui", "sans-serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      maxWidth: { container: "1280px" },
    },
  },
  plugins: [],
};
