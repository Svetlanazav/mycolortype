// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@huggingface/transformers", "onnxruntime-web"],
    },
  },
  site: "https://svetlanazav.github.io",
  base: "mycolortype",
});
