import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

// https://vite.dev/config/
// Phase 6 (T6.7 + T6.8): the dashboard bundle was crossing Vite's
// 500kB chunk-size warning because Recharts (~150kB minified) was
// eagerly bundled into the main entry. Combined with the
// `React.lazy()`-loaded ReportsPage in route-config.tsx, this
// manualChunks split carves Recharts and Firebase out into vendor
// chunks that load on demand. The T6.6 `React.lazy()` on ReportsPage
// keeps the Reports tree out of the main entry; this manualChunks
// config keeps Recharts itself out of the main entry so the main bundle
// drops below 500kB.
export default defineConfig({
  // base: './' es REQUERIDO para Capacitor. Los assets del build deben usar
  // rutas relativas en lugar de absolutas porque el WebView nativo carga desde
  // el filesystem local (file://), no desde un servidor HTTP.
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: import.meta.url.includes("localhost")
          ? "http://localhost:5000"
          : "http://localhost:5000", // DEV vs PROD
        changeOrigin: true,
      },
    },
    cors: true,
  },
  customLogger: {
    info: (message) => {
      console.log(message);
    },
    warn: (message) => {
      console.warn(message);
    },
    error: (message) => {
      console.error(message);
    },
    warnOnce: (message) => {
      console.warn(message);
    },
    clearScreen: () => {
      console.clear();
    },
    hasErrorLogged: () => {
      return false;
    },
    hasWarned: false,
  },
  resolve: {
    alias: {
      "@adapters": resolve(__dirname, "src/adapters"),
      "@application": resolve(__dirname, "src/application"),
      "@domain": resolve(__dirname, "src/domain"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@presentation": resolve(__dirname, "src/presentation"),
    },
  },
  build: {
    // Phase 6.8: with every protected/auth/public-chrome route now
    // lazy-loaded (route-config.tsx), the main entry's remaining
    // weight lives in the state/router/i18n libs. Carving each one
    // into its own vendor chunk drops the main entry below 500 kB and
    // restores the threshold as a real regression signal.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Phase 6 (T6.8): explicit vendor splitting so heavy 3rd-party
        // modules don't inflate the main bundle. The substring match
        // works for both flat `node_modules/<pkg>/...` and the pnpm
        // isolated layout `node_modules/.pnpm/<pkg>@x.y/node_modules/
        // <pkg>/...` because the resolved `id` always contains the
        // actual package directory.
        manualChunks(id) {
          if (id.includes("/recharts/")) {
            return "vendor-recharts";
          }
          if (id.includes("/firebase/")) {
            return "vendor-firebase";
          }
          if (
            id.includes("/react-redux/") ||
            id.includes("/reduxjs/toolkit") ||
            id.includes("/reselect/")
          ) {
            return "vendor-redux";
          }
          if (id.includes("/@tanstack/")) {
            return "vendor-query";
          }
          if (id.includes("/react-router/")) {
            return "vendor-router";
          }
          if (id.includes("/i18next/") || id.includes("/react-i18next/")) {
            return "vendor-i18n";
          }
        },
      },
    },
  },
});
