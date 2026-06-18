import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import * as eslintPluginImport from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import { FlatCompat } from "@eslint/eslintrc";

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
      "tailwind.config.ts"
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
    },
  },
);
