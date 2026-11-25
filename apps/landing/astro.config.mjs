import { defineConfig } from "astro/config";

// Astro 7.4 landing. Static output only: the SPA keeps owning /app/* and
// /auth/*, the marketing site owns the root paths (see firebase.json and
// apps/webClient/nginx.conf for the rewrite map).
export default defineConfig({
  site: "https://budgetgenius.com",
  output: "static",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es"],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    // Inline the small above-the-fold CSS Astro extracts; the hero image is
    // imported through astro:assets so it ships as responsive WebP.
    inlineStylesheets: "auto",
  },
  vite: {
    server: {
      // The landing reads the SPA translation catalogue so both surfaces
      // share one source of truth until it moves to a shared package.
      fs: { allow: [".."] },
    },
  },
});
