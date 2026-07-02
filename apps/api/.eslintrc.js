const path = require('path');

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  // v1.7.4 — `eslint-plugin-local-rules` (added v1.7.4) is the
  // officially-supported mechanism for loading locally-authored rules
  // from a non-`node_modules` directory under ESLint v8.0+ — the older
  // `rulePaths` / `rulesDir` legacy options were REMOVED in 8.0.0
  // (validated: ESLint v8.42.0 rejects both keys with the schema
  // `Unexpected top-level property` error). The plugin auto-loads any
  // rule file found in `local-rules/rulesDir`, registering its rule id
  // as the basename (e.g. `no-req-user-id.cjs` → `no-req-user-id`).
  plugins: ['@typescript-eslint/eslint-plugin', 'eslint-plugin-local-rules'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  settings: {
    // v1.7.4 — point at the project's shared rule file under tools/.
    // `extensions: ['.cjs']` covers the explicit CJS marker added in
    // v1.7.4 (per reviewer nit #2) so the file is CJS regardless of any
    // future `tools/package.json` declaring `"type": "module"`.
    'local-rules/rulesDir': [
      path.resolve(__dirname, '../../tools/eslint-rules'),
    ],
    // v1.7.4 round-2 polish — keep `.js` ALONGSIDE `.cjs` so future rules
    // added as `.js` are still auto-discovered without a config edit.
    // (Per reviewer nit: defensively include both extensions. The
    // existing `.cjs` marker is preserved as the explicit CJS marker
    // per round-2 nit #2; future `.js` rules are equally valid.)
    'local-rules/extensions': ['.cjs', '.js'],
  },
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // v1.7.4 — guard. JwtStrategy.validate returns `{userId,email,role}`,
    // never `{id,email,role}`. `req.user.id` is always undefined at runtime
    // and any guard/middleware that reads it silently 401s. The lint rule
    // is the regression net for the v1.7.3+v1.7.4 fixes to
    // `user.controller.ts#deleteUser` (v1.7.3 String-vs-Number,
    // v1.7.4 user.userId-vs-user.id) and to
    // `user-settings.middleware.ts#use` (v1.7.4 same bug class, fixed
    // in this commit). Codified at knowledge.md §6.8.7. The companion
    // self-check spec lives at
    // `tools/eslint-rules/no-req-user-id.spec.cjs` — 23 cases across
    // 5 AST shapes (MemberExpression, ChainExpression-wrapped,
    // computed access, computed on both sides, and negative cases
    // skipping `obj.user.id`, `req.user.userId`, and any
    // non-`req`-rooted chain).
    'no-req-user-id': 'error',
  },
};
