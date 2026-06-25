import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

import { readFileSync } from "fs";

// Inject build version from env var (CI) or fall back to package.json version + git hash
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const appVersion = process.env.VITE_APP_VERSION || `${pkg.version}-dev`;

export default defineConfig({
  base: process.env.VITE_CAPACITOR === 'true' ? './' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      // Capacitor native plugins (@capacitor/app, @capacitor/browser) are only
      // available inside the Capacitor WebView at runtime. For web builds
      // (VITE_CAPACITOR is not set), mark them as external so Rollup leaves
      // the dynamic import() calls as-is — isNativePlatform() guards ensure
      // they're never executed in a browser.
      // For Capacitor APK builds (VITE_CAPACITOR=true), DON'T externalize —
      // the WebView needs these modules bundled, otherwise it tries to resolve
      // the bare specifier "@capacitor/browser" as a native ES module and fails
      // with "Failed to resolve module specifier".
      external: process.env.VITE_CAPACITOR === 'true'
        ? []
        : ["@capacitor/app", "@capacitor/browser"],
      output: {
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
