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
  // ──────────────────────────────────────────────────────────────────
  // Note: Vitest config lives in a separate `vitest.config.ts` file.
  // This Vite config deliberately does NOT carry a `test:` block so
  // that `vite build` (production) does not see Vitest-only options
  // (no css:false, no environment:"node"). The unit-test specs run
  // via `pnpm --filter frontend-web test:unit` against vitest.config.ts.
  // ──────────────────────────────────────────────────────────────────
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      // === Web-build-only external list ===
      //
      // Capacitor-native plugins only resolve at runtime inside the
      // Capacitor WebView, which injects a module map. Three cases:
      //
      // (1) `VITE_CAPACITOR === "true"` → bundling for an APK.
      //     We MUST bundle the plugins because the WebView doesn't
      //     have an import-map for them and the bundled JS would throw
      //     `Failed to resolve module specifier '@capacitor/...'`
      //     at module-evaluation time.
      //
      // (2) `VITE_CAPACITOR !== "true"` (web build for Vercel / Firebase).
      //     No Capacitor runtime in the browser. Calling code is
      //     guarded by `isNativePlatform()` (early-returns `false`),
      //     so the imported symbols are never invoked. Marking the
      //     specifier as `external` keeps Rollup from bundling the
      //     (unused) module — but the bare specifier is still emitted
      //     unless the *call sites* also use dynamic `await import()`.
      //     All three plugins below are therefore imported dynamically
      //     (see adapters/auth/native-google-login.strategy.ts and the
      //     @capacitor/app / @capacitor/browser consumers).
      //
      // (3) If you add a new Capacitor-native plugin, add it to this
      //     web-build external list AND audit its call sites to use
      //     dynamic imports.
      external: process.env.VITE_CAPACITOR === 'true'
        ? []
        : [
            "@capacitor/app",
            "@capacitor/browser",
            // Filesystem + Share — used by
            // apps/webClient/src/infrastructure/downloadService.ts to
            // route report downloads on the Capacitor (Android/iOS)
            // WebView through the native share sheet. Bare specifier
            // is preserved on web builds via dynamic `await import()`
            // and the call site is guarded by `isNativePlatform()`.
            "@capacitor/filesystem",
            "@capacitor/share",
            // @capgo/capacitor-social-login (v1.2.0) replaces
            // @capacitor-firebase/authentication. The WebView's runtime
            // resolves the bare specifier against the bundled APK; on
            // web builds it would fail, so we keep it external — Vite
            // leaves the dynamic import() call as-is and the
            // isNativePlatform() guard in
            // adapters/auth/native-google-login.strategy.ts prevents
            // it from ever running.
            "@capgo/capacitor-social-login",
          ],
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
