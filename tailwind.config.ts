import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eaf8fd",
          100: "#cceef8",
          200: "#aae4f4",
          300: "#94D8EE",
          400: "#5ac4e6",
          500: "#2ab0d9",
          600: "#1591b3",
          700: "#107394",
          800: "#0b5572",
          900: "#07405a",
        },
      },
    },
  },
  plugins: [],
};
export default config;