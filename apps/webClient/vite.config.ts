import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  base: process.env.VITE_CAPACITOR === 'true' ? './' : '/',
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
