/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        primary: {
          plum: "#4A3346",
          mauve: "#9D8189",
          sand: "#F5E6E8",
        },
        accent: {
          rose: "#D4B2BC",
          gold: "#D4A373",
          sage: "#87A878",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
