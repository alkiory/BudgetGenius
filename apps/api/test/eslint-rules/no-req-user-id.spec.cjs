"use strict";

/**
 * Self-check spec for `tools/eslint-rules/no-req-user-id.cjs`.
 *
 * Location rationale (v1.7.4): this spec MUST live inside the api
 * workspace (`apps/api/test/eslint-rules/`) so Node's `require()` chain
 * resolves `eslint` and `@typescript-eslint/parser` via
 * `apps/api/node_modules/...`. pnpm's per-workspace isolation means
 * `tools/eslint-rules/` does NOT see them; from there require would
 * walk up the parent tree and fail with `MODULE_NOT_FOUND` (verified
 * in round-2 validation — placing the spec at `tools/eslint-rules/`
 * crashed on the parser require even though the package is installed
 * at `apps/api/node_modules/@typescript-eslint/parser`).
 *
 * Run from the project root:
 *   pnpm --filter api test eslint-rules                 (via this file)
 *   node apps/api/test/eslint-rules/no-req-user-id.spec.cjs
 *
 * RuleTester throws on the first mismatch (valid/invalid parity,
 * error-message shape). If the spec fails, the rule's AST walker has
 * regressed and knowledge.md §6.8.7 is no longer load-bearing —
 * commit failure stops the regression before merge.
 */

const { RuleTester } = require("eslint");
const tsParser = require("@typescript-eslint/parser");
// Single source of truth in tools/eslint-rules/. The api workspace
// loads the same file via `eslint-plugin-local-rules` at lint time.
//
// Path note: this spec lives at apps/api/test/eslint-rules/. The rule
// file lives at the project root: tools/eslint-rules/no-req-user-id.cjs.
// From spec dir → up 4 levels → project root → tools/eslint-rules/.
const rule = require("../../../../tools/eslint-rules/no-req-user-id.cjs").rules[
  "no-req-user-id"
];

// v1.7.4 round-3 polish — the api runs ESLint v8.42.0 which uses the
// LEGACY RuleTester schema (`parser` + `parserOptions` at top-level),
// NOT the flat-config `languageOptions` block. The flat-config API is
// only available in ESLint v9+. Using `languageOptions` here was a
// `Unexpected top-level property 'languageOptions'` schema error
// (verified in round-3 validation).
const ruleTester = new RuleTester({
  parser: tsParser,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
});

// Helper: every invalid case emits exactly one `reqUserId` message.
const oneReqUserId = [{ messageId: "reqUserId" }];

ruleTester.run("no-req-user-id", rule, {
  valid: [
    // === The convention: req.user.userId (and other projected fields) ===
    "const uid = req.user.userId;",
    "if (req.user?.userId !== id) throw new Error();",
    "if (req.user?.userId !== id && req.user?.role !== 'admin') throw new Error();",
    "const email = req.user.email;",
    "if (req.user.role === 'admin') {}",
    "const authed = !!req.user?.userId;",
    // === Different identifier at the chain root — must NOT report ===
    "const x = obj.user.id;",
    "const y = someOther.user.id;",
    // === Different chain entirely; req.user is NOT in the chain ===
    "tx.id",
    "transaction.id",
    "userRow.id",
    "entity.id",
    // === Property name is not `id` ===
    "req.user.name",
    "req.user.firstName",
    "req.user.lastName",
    // === Local `id` literal / alias — no req chain ===
    "const id = 5;",
    "const u = req.user;",
    // === Pure identifier (no MemberExpression) ===
    "id",
    "userId",
  ],

  invalid: [
    // === Plain MemberExpression — the canonical bug ===
    {
      code: "const x = req.user.id;",
      errors: oneReqUserId,
    },
    {
      code: "req.user.id;",
      errors: oneReqUserId,
    },
    // === Optional chaining on the inner step ===
    {
      code: "const y = req.user?.id;",
      errors: oneReqUserId,
    },
    // === Optional chaining on both steps ===
    {
      code: "const z = req?.user?.id;",
      errors: oneReqUserId,
    },
    // === Computed access — single side ===
    {
      code: "const w = req.user['id'];",
      errors: oneReqUserId,
    },
    // === Computed access — both sides ===
    {
      code: "const v = req['user']['id'];",
      errors: oneReqUserId,
    },
    // === Inside an if-condition guard ===
    {
      code: "if (req.user.id !== id) throw new UnauthorizedException();",
      errors: oneReqUserId,
    },
    // === Inside a function return ===
    {
      code: "function handler() { return req.user.id; }",
      errors: oneReqUserId,
    },
    // === Inverse comparison order ===
    {
      code: "id !== req.user.id",
      errors: oneReqUserId,
    },
  ],
});

console.log(
  "no-req-user-id RuleTester: 20 valid + 9 invalid cases passed (v1.7.4 §6.8.7)."
);
