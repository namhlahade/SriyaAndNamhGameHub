import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-crimson)", "Georgia", "serif"],
      },
      colors: {
        board: {
          light: "#f0d9b5",
          dark: "#b58863",
          highlight: "rgba(255,255,0,0.4)",
          last: "rgba(155,199,0,0.5)",
        },
        checkers: {
          red: "#c44",
          black: "#333",
          king: "#ffd700",
        },
      },
    },
  },
  plugins: [],
};
export default config;
