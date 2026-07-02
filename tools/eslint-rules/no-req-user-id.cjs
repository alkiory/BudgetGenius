"use strict";

/**
 * ESLint plugin: `no-req-user-id`
 *
 * Single rule: `no-req-user-id`
 *
 * Flags ANY access to `req.user.id` (and equivalents) in source code.
 *
 * The `JwtStrategy.validate()` at
 * `apps/api/src/infrastructure/config/strategy/jwt.strategy.ts` returns
 * `{ userId, email, role }` — it never returns an `id` field. So at runtime:
 *
 *   - `req.user.id`            -> undefined
 *   - `req.user?.id`           -> undefined
 *   - `req.user!.id`           -> undefined (TS non-null is a TS lie)
 *   - `(req.user as X).id`     -> undefined
 *   - `req.user['id']`         -> undefined (computed access)
 *   - `req['user'].id`         -> undefined
 *   - `req?.user?.id`          -> undefined
 *
 * Any guard or middleware that reads `req.user.id` SILENTLY treats the user
 * as another user (or fails the comparison downstream) — see
 * `knowledge.md §6.8.7` for the v1.7.4 production regression history.
 *
 * The codebase convention is `req.user.userId`. Read that field instead.
 *
 * Scope limitations (intentional, follow-up work):
 *   - Object destructuring like `const { id } = req.user` is NOT yet caught.
 *     Its AST is a VariableDeclarator with an ObjectPattern, not a
 *     MemberExpression. A follow-up rule should walk ObjectPattern.parents
 *     and check the VariableDeclarator's `.init` chain hits req.user.
 *     Today's audit finds zero live examples of this shape in the codebase.
 *   - We assume the canonical parameter name is `req`. If a future
 *     Express-style decorator renames it (e.g. `@Req() request: Request`),
 *     extend the findReqIdentifier() block to also accept `request`.
 *
 * Wired in:
 *   - apps/api/.eslintrc.js — rulePaths: ['../../tools/eslint-rules']
 *   - apps/webClient/eslint.config.js — flat-config plugin import.
 *
 * Allow-list: zero exceptions. If you genuinely need an `id` field on the
 * request user shape (NOT userId), update JwtStrategy.validate() first AND
 * extend this rule's allow-list with a §6.8.X codification entry.
 */
module.exports = {
  rules: {
    "no-req-user-id": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow reads of `req.user.id` (always undefined after JwtStrategy.validate).",
          category: "Possible Errors",
          recommended: true,
          url: "knowledge.md#6-8-7",
        },
        schema: [],
        messages: {
          reqUserId:
            "Reading `req.user.id` is a v1.7.4-known bug. JwtStrategy.validate " +
            "returns `{ userId, email, role }` — `req.user.id` is always `undefined`, " +
            "and any guard or middleware that reads it silently fails (false-positive " +
            "auth denial, role escalation via `?.role !== 'admin'`, etc.). Read " +
            "`req.user.userId` instead. See knowledge.md §6.8.7.",
        },
      },

      create(context) {
        /**
         * True if `node` is a MemberExpression with property `id` —
         * either non-computed `obj.id` or computed `obj['id']`.
         */
        function isIdProperty(memberNode) {
          if (memberNode.type !== "MemberExpression") return false;
          if (!memberNode.property) return false;
          if (
            memberNode.computed === false &&
            memberNode.property.type === "Identifier" &&
            memberNode.property.name === "id"
          ) {
            return true;
          }
          if (
            memberNode.computed === true &&
            memberNode.property.type === "Literal" &&
            typeof memberNode.property.value === "string" &&
            memberNode.property.value === "id"
          ) {
            return true;
          }
          return false;
        }

        /** True if the given MemberExpression step has property `user`. */
        function isUserProperty(memberNode) {
          if (memberNode.type !== "MemberExpression") return false;
          if (!memberNode.property) return false;
          if (
            memberNode.computed === false &&
            memberNode.property.type === "Identifier" &&
            memberNode.property.name === "user"
          ) {
            return true;
          }
          if (
            memberNode.computed === true &&
            memberNode.property.type === "Literal" &&
            typeof memberNode.property.value === "string" &&
            memberNode.property.value === "user"
          ) {
            return true;
          }
          return false;
        }

        /**
         * Walk `memberNode.object` chain, looking for:
         *   1) at SOME step, a `.user` (or `['user']`) property, AND
         *   2) at the BOTTOM of the chain, the identifier `req`.
         *
         * Step through:
         *   - ChainExpression (optional-chaining wrapper)
         *   - TSNonNullExpression  (`!`)
         *   - TSAsExpression      (`as X`)
         *   - TSTypeAssertion     (`<X>`)
         *   - TSSatisfiesExpression (`satisfies X`)
         *
         * Bound the walk to 12 levels so a malformed AST cannot loop.
         */
        function chainHitsReqUser(memberNode) {
          let cur = memberNode.object;
          let sawUser = false;
          for (let depth = 0; depth < 12 && cur; depth += 1) {
            switch (cur.type) {
              case "ChainExpression":
                cur = cur.expression;
                continue;
              case "TSNonNullExpression":
              case "TSAsExpression":
              case "TSTypeAssertion":
              case "TSSatisfiesExpression":
                cur = cur.expression;
                continue;
              case "Identifier":
                return cur.name === "req" && sawUser;
              case "MemberExpression":
                if (isUserProperty(cur)) sawUser = true;
                cur = cur.object;
                continue;
              default:
                return false;
            }
          }
          return false;
        }

        return {
          // ESLint traverses INTO all nested nodes, so even `req.user?.id`
          // (ChainExpression wrapping a MemberExpression) is visited at
          // the inner MemberExpression. Same for `req.user!.id`,
          // `(req.user as User).id`, etc.
          MemberExpression(node) {
            if (!isIdProperty(node)) return;
            if (!chainHitsReqUser(node)) return;
            context.report({ node, messageId: "reqUserId" });
          },
        };
      },
    },
  },
};
