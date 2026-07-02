import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import * as eslintPluginImport from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import { FlatCompat } from "@eslint/eslintrc";
// v1.7.4 — load the shared custom rule plugin from the project's
// `tools/eslint-rules/` dir. Same file the api app loads via
// `eslint-plugin-local-rules` (the official ESLint v8+ loader).
// Node's CJS-ESM interop yields the `module.exports` object as the
// default ESM export, so `noReqUserIdPlugin.rules['no-req-user-id']`
// is the rule definition. Codified at knowledge.md §6.8.7. The `.cjs`
// extension is the explicit CJS marker added per reviewer nit #2 so
// the file is CJS regardless of any future `tools/package.json`
// declaring `"type": "module"`.
import noReqUserIdPlugin from "../../tools/eslint-rules/no-req-user-id.cjs";

const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended,
  baseDirectory: process.cwd(),
});

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.spec.ts",
      "**/*.test.ts",
      "**/*.stories.tsx",
      // Root-level build configs. These are not in any tsconfig project's
      // include and trigger "file not found in any project" errors when
      // linting, since they live outside src/. They also produce spurious
      // react-refresh/only-export-components warnings because the plugin is
      // not installed.
      "vite.config.ts",
      "playwright.config.ts",
      "postcss.config.ts",
      "tailwind.config.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}", ".eslintrc.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        // Root tsconfig.json uses project references (files: []) which the
        // typescript-eslint parser cannot follow. Point at the actual source
        // tsconfig that declares src/** files.
        project: "./tsconfig.app.json",
        warnOnUnsupportedTypeScriptVersion: false,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      import: eslintPluginImport,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      // v1.7.4 — see `noReqUserIdPlugin` import above. Rule id is
      // `no-req-user-id/no-req-user-id` (plugin-name/rule-name).
      "no-req-user-id": noReqUserIdPlugin,
    },
    rules: {
      ...reactPlugin.configs["recommended"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // React 17+ uses the automatic JSX runtime (tsconfig.app.json: "jsx": "react-jsx")
      // which does not require React to be in scope. Override the legacy rules brought
      // in by FlatCompat's plugin:react/recommended.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "import/no-cycle": "error",
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc" },
          groups: ["builtin", "external", "parent", "sibling", "index"],
        },
      ],
      "react/jsx-uses-vars": "error",
      // v1.7.4 — see knowledge.md §6.8.7. The web client is currently
      // unaffected (it talks to the api via axios; the bug is server-side),
      // but routing the same rule in flat config catches accidental
      // `useUser().id`-shaped reads if a future refactor pushes server-side
      // request shapes back into the client.
      "no-req-user-id/no-req-user-id": "error",
    },
  },
  ...compat.config({
    extends: [
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:prettier/recommended",
    ],
  }),
  // Final overrides — must come AFTER compat.config so they win the rule merge.
  // FlatCompat's plugin:react/recommended would otherwise re-enable the legacy
  // rules brought in by ESLint v8- era configs.
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // React 17+ automatic JSX runtime (tsconfig.app.json: "jsx": "react-jsx")
      // — no React import needed in scope or in JSX usage.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // PropTypes are redundant with TypeScript types.
      "react/prop-types": "off",
      // v1.7.4 — re-assert so the final-override block doesn't lose the rule
      // to an earlier merge.
      "no-req-user-id/no-req-user-id": "error",
    },
  },
);
