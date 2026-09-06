// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages: https://<user>.github.io/<repo>/  → cambia `base` si el repo cambia de nombre.
export default defineConfig({
  site: "https://estebanperez99.github.io",
  base: "/social-graphs-and-interactions",
  integrations: [react(), mdx()],
  vite: { plugins: [tailwindcss()] },
});
