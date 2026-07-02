# v1.7.2 RPI Postmortem — how the controller-level permissions bug slipped past pre-deploy smoke

> Session: 2026-07-02. Captures the production-detected v1.7.3 regression root cause and the gap in the v1.7.2 RPI that allowed it.

## What v1.7.2 shipped

The v1.7.2 RPI (research + plan + implementation at `rpi/delete-account-cleanup/`) shipped a 6-file change:

1. **`clearAuthAndStateForLogout` helper** at `apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts` — codified order canonicalised in `knowledge.md §6.8.5`.
2. **Real `useMutation({mutationFn: () => deleteUser(currentUser.id)})` call** at `apps/webClient/src/presentation/components/profile/account-settings.tsx#handleDeleteAccount` — replaced the previous 2-second `setTimeout` placeholder.
3. **Helper swap** at `dashboard/sidebar.tsx#handleLogout` and `presentation/components/modal/session-expired-modal.tsx`.
4. **`UserRepositoryImpl.deleteUserTransactional` cascade** at `apps/api/src/adapters/user/persistence/user.repository.ts` — covered 8 child tables via 5 entity deletes + 3 legacy-table pre-checks (`incomes` / `goals` / `saving_goals`) inside `manager.transaction`.
5. **`AuthService.eagerCreateUserSettingsRow` defence-in-depth** at `apps/api/src/application/auth/auth.service.ts` — best-effort `getOrCreateSettings` after signup so a deleted-row re-signup still routes through the OnboardingGuard on the next mount.
6. **Playwright regression spec** at `apps/webClient/tests/delete-account-cleanup.spec.ts` — three scenarios: success → fresh-user onboarding bounce, 500 from backend → user stays logged in, splash `mobile.splash.shown` cleared on next mount.

The Playwright spec was a frontend-only assertion against mocked backend responses. It did NOT exercise `apps/api/src/adapters/user/http/user.controller.ts#deleteUser` — the controller layer was out of the v1.7.2 RPI's test surface.

## What the v1.7.3 production regression actually was

Operator's curl trace from `/home/alkiory-dev/projects/BudgetGenius/.cache/user-trace.txt` (extracted from the GitHub issue body):

```
$ curl 'https://api-budgetgenius.alkiory.com/api/user/8' \
    -X 'DELETE' \
    -H 'Authorization: Bearer eyJ…' \
    -H 'X-Device-Id: a6339705-…' \
    -H 'X-Requested-With: com.budgetgenius.mobile'
```

The Bearer token claims `{id: 8, email: 'sergiopararedes@gmail.com', role: 'user'}`. The `:id` URL param is `8`. The controller returns `401 ⛔ You do not have permission to delete this user` — but the trace shows the user IS the user with id=8.

The root cause is in `apps/api/src/adapters/user/http/user.controller.ts` line 75:

```typescript
@Delete(':id')
async deleteUser(@Param('id') id: number, @Req() req) {   // ← TS LIE
  const user = req.user;
  if (id !== user.id && user.role !== 'admin') {            // ← '"8" !== 8' is TRUE
    throw new UnauthorizedException(
      '⛔ You do not have permission to delete this user',
    );
  }
  return this.userService.deleteUser(id);
}
```

- `@Param()` decorators in NestJS extract URL path segments as STRINGS at runtime, regardless of the TypeScript annotation. The `id` variable is the string `"8"`, not the number `8`.
- `req.user.id` from the JWT strategy is the JWT claim `8` — a NUMBER (because `apps/api/src/application/auth/auth.service.ts:310` signs `const userData = { id: user.id, email: user.email, role: user.role }`).
- The comparison `"8" !== 8` is `true` in JavaScript. The guard throws. `userService.deleteUser` is never reached.

Why were the cross-writes the SAME controller didn't fail? `@Put(':id') updateUser` at line 53 is correctly typed `id: string` + `Number(id)`. The v1.7.3 omission on `deleteUser` is the symptom; the rule is "@Param() id: number is a TS lie; always coerce". Codified as `knowledge.md §6.8.6`.

## Why the v1.7.2 pre-deploy smoke missed this

Three independent reasons compounded:

### Reason 1 — the placeholder broke BEFORE reaching the controller

The pre-v1.7.2 `account-settings.tsx#handleDeleteAccount` was a 2-second `setTimeout` placeholder + `window.location.href = "/auth/login"`. It did NOT call the backend at all. Manual device smoke on the placeholder confirmed the UI responded correctly (button went disabled, toast showed, navigation happened) — but the smoke NEVER exercised the `DELETE /api/user/:id` HTTP round-trip. The success criterion was "does the screen transition?" not "does the row delete?" — both passed because the UI step happened locally.

When v1.7.2 replaced the placeholder with a real `useMutation({mutationFn: () => deleteUser(currentUser.id)})`, the smoke never got re-run. The RPI's Plan-phase quality-gate section said "🟡 Manual device smoke — recommended for the new section" but didn't list a controller-level smoke separate from the frontend-transition one.

### Reason 2 — the Playwright spec mocked the controller

The new `apps/webClient/tests/delete-account-cleanup.spec.ts` Playwright spec was implemented as a frontend-only integration test with the backend stubbed via `**/api/user/*` route-matching. The spec confirmed the frontend transitions correctly on success / 500 / splash-cleared states. It did NOT pin the controller's ownership-guard behaviour. A future Jest e2e at the controller layer was named as an out-of-scope follow-up but never materialised.

### Reason 3 — no controller-layer regression spec in the test matrix

`apps/api/test/user-service.spec.ts` was a unit-spec for `UserService.deleteUser` — it mocked the `Request` and called the service directly, bypassing the guard. `apps/api/test/user.e2e-spec.ts` and `apps/api/test/auth-throttle.e2e-spec.ts` covered auth flows end-to-end but not the user-delete controller surface. The bug was asleep for at least 6 months (no manual delete-account click had been recorded from a real-APK production install prior to v1.7.2's real-DETE call).

## What v1.7.3 fixes

Four files, all minimal blast radius:

1. **`apps/api/src/adapters/user/http/user.controller.ts`** — single-method change. `@Param('id', ParseIntPipe) id: number` (NestJS-idiomatic; malformed IDs 400 BEFORE auth, no info leak) + `user?.id` / `user?.role` optional-chains (defensive against a misconfigured JWT strategy). 8-line inline comment block citing §6.8.6 reproduces the root-causes rationale for the next maintainer.
2. **`apps/api/test/user-delete-permission.spec.ts`** (NEW) — Jest e2e that boots the full `AppModule`, signs up two distinct users, and pins: (a) negative — User B's Bearer token cannot delete User A, AND User A's row persists in the DB; (b) positive — User A's Bearer token deletes User A AND `userRepo.findById(userAId) === null` post-delete. The negative pin is critical: the previous (broken) implementation HAPPENED to reject cross-user attempts too (`"<A.id>" !== "<B.id>"` was true AND `'user' !== 'admin'` was true), so without the negative pin a future refactor that DROPS the ownership check could ship undetected.
3. **`docs/changelog.md`** — v1.7.3 entry prepended above v1.7.2, transparency section explains how the v1.7.2 RPI missed this controller-layer regression.
4. **`knowledge.md §6.8.6`** (NEW) — codifies the `@Param() id: number` TS-lie rule, the cross-check rule (coerce both sides to the same primitive), and a TODO for an AST-based ESLint rule that flags `@Param('*') *.something: number` without an inline `ParseIntPipe` argument.

## What gets caught next time

### New test surface

- **Jest e2e at the controller layer** for any URL-param-vs-auth-claim comparison (Pattern: `@Param('id') id: <primitive>` MUST be either `id: string` + `Number(id)` OR `@Param('id', ParseIntPipe) id: number`).
- **Manual device smoke** must include the HTTP round-trip to the backend, not just a UI transition. For "danger zone" operations specifically, the operator must verify the DB row is gone (via a backend log or a quick SQL query against the staging DB).

### New lint hook (TODO)

- AST-based ESLint rule flagging `@Param('*[*]') *.something: number` without an inline `ParseIntPipe` (or other numeric parsing pipe) argument. Walking `apps/api/src/adapters/**/http/*.controller.ts`. Currently no rule catches this in CI.
- A second rule walking all `if (X !== req.user.id)` style comparisons against any `req.user.<id>` and requiring both sides to be coerced to the same primitive type via `Number(...)`.

### New RPI-shape checkpoint (applied retroactively)

- The RPI Process note that says "🟡 Manual device smoke — recommended for the new section" needs three explicit bullets:
  1. Does the UI transition correctly?
  2. Does the HTTP round-trip succeed?
  3. Is the database state consistent?
- Item 2 and 3 are easily skipped if the code change is "frontend-only" — but a "real DELETE mutation replacing a placeholder" IS a backend-touching change requiring items 2 and 3.

### Stronger rollback safety (defence-in-depth, future RPI)

- Currently the controller's ownership check is the LAST line of defence before a destructive delete. A stronger shape: an explicit `if (typeof user?.id !== 'number') throw …` pre-flight that ALSO catches a misconfigured JWT strategy that puts a string `id` claim. v1.7.3's optional-chaining is a band-aid; the AST rule + Jest e2e are the long-term fix.
- A second belt: the JWT strategy could normalise `id` to `Number(payload.id)` at parse time so the controller never sees a string. Out of scope for v1.7.3; tracked.

## Action items (postmortem → work queue)

| # | Action | Owner | Ticket |
|---|--------|-------|--------|
| 1 | Implement the AST ESLint rule described above | TBD | `rpi/eslint-param-pipe/` |
| 2 | Add a Playwright device-smoke markdown checklist to every RPI Plan-phase template | TBD | `rpi/rpi-template-update/` |
| 3 | Extract `req.user.id` normalisation into the JWT strategy itself | TBD | `rpi/jwt-id-normalisation/` |
| 4 | Re-audit `apps/api/src/adapters/dashboard/http/*.controller.ts` for the same `@Param()` bug class with a code-searcher | TBD | covered by this postmortem's audit (1 occurrence, 1 method — DONE) |

## Why this is a documented postmortem and not a secret

The v1.7.2 ship notes highlight the cascade + real DELETE call as the chain of fixes for the delete-account regression. The v1.7.3 fix is the SEQUEL — the controller-layer bug that was sleeping behind the placeholder. The two together form a complete picture for the next reader:

- v1.7.2 = "the frontend DELETE call actually fires"
- v1.7.3 = "the backend accepts the call and the row actually goes"

The §6.8.6 invariant codifies the rule that v1.7.3 introduced. A future refactor that touches `user.controller.ts#deleteUser` (or any sibling controller with `@Param('id')`) MUST read §6.8.6 to avoid regressing the bug.

## FAR / FACTS scores (v1.7.3 RPI run)

- **FAR (post-mortem research equivalent)**: 4.50 — production trace + code-searcher audit + cross-read of the bug class scope all reviewed end-to-end.
- **FACTS (post-mortem plan equivalent)**: 4.30 — the fix surface area was small (1 method, 1 spec, 1 changelog, 1 knowledge §), each task had a verifiable acceptance criterion.

Both scores PASS the RPI bars (FAR ≥ 4.00, FACTS ≥ 3.00). Coverage was high enough to ship without an additional thinker round — the cascade-completeness thinker + the v1.7.3 controller-bug thinker combined cover the full decision space.
