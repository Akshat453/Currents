export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        sunken: "var(--surface-sunken)",
        ink: {
          900: "var(--ink-900)",
          700: "var(--ink-700)",
          500: "var(--ink-500)",
          300: "var(--ink-300)"
        },
        copper: { 600: "var(--copper-600)", 500: "var(--copper-500)", 100: "var(--copper-100)" },
        volt: { 500: "var(--volt-500)", 900: "var(--volt-900)" },
        line: "var(--border)"
      },
      fontFamily: { display: ["Space Grotesk", "sans-serif"], body: ["Public Sans", "sans-serif"] },
      borderRadius: { card: "10px", control: "8px" }
    }
  },
  plugins: []
};
