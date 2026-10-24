/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0b0f19",
          850: "#0f1523",
          800: "#131b2e",
          700: "#1e293b",
          600: "#334155",
        },
        brand: {
          50: "#eef2ff",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        accent: {
          cyan: "#06b6d4",
          violet: "#8b5cf6",
          rose: "#f43f5e",
          amber: "#f59e0b",
          emerald: "#10b981",
        }
      },
    },
  },
  plugins: [],
}
