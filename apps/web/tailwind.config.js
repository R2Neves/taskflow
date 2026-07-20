/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d5ebe0",
          500: "#2f6f55",
          700: "#1f4d3b",
          900: "#123028",
        },
        priority: {
          low: "#22c55e",
          medium: "#eab308",
          high: "#ef4444",
        },
      },
      fontFamily: {
        display: ["\"Source Serif 4\"", "Georgia", "serif"],
        sans: ["\"DM Sans\"", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
