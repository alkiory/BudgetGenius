import { defineConfig } from "vitest/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ESM-safe path resolution. The webClient package.json has
// "type": "module", so we cannot rely on the implicit __dirname.
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Standalone Vitest config for `apps/webClient`.
 *
 * Why this exists separately from `vite.config.ts`:
 *   Vite's full plugin chain — including `@vitejs/plugin-react-swc` —
 *   eagerly loads PostCSS to handle CSS imports. The webClient project
 *   ships a `postcss.config.ts` whose source uses ESM `export default`,
 *   but PostCSS's config-loader falls back to `require()` and fails
 *   on projects with `"type": "module"`. We've already shipped a
 *   `css: false` workaround in the `vite.config.ts` test block, but
 *   the React SWC plugin still initializes some CSS-aware code paths.
 *
 *   The cleanest fix is a STANDALONE vitest config that:
 *     - inherits the project's path aliases (so `import
 *       "@infrastructure/platform"` resolves), and
 *     - does NOT carry the `plugins: [react()]` array, so the
 *       PostCSS chain never initializes for unit tests.
 *
 *   Production build (`vite build`) uses `vite.config.ts` — the vitest
 *   config is consumed only by `pnpm exec vitest run`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@adapters": resolve(__dirname, "src/adapters"),
      "@application": resolve(__dirname, "src/application"),
      "@domain": resolve(__dirname, "src/domain"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@presentation": resolve(__dirname, "src/presentation"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/__tests__/**/*.spec.ts",
      "src/**/__tests__/**/*.test.ts",
    ],
    // Explicit imports of describe/it/expect/vi at the call sites —
    // no implicit globals — so the test surface is grep-able.
    globals: false,
    // Final defensive guard: even if a future plugin tries to wire
    // up a CSS pipeline, vitest will refuse to load CSS in node env.
    css: false,
  },
});
