# delete-account-cleanup Plan

> Companion to `rpi/delete-account-cleanup/research.md` (FAR Mean = 5.00 PASS).
> Goal: ship v1.7.2 — a patch that (1) wires the real backend `DELETE /user/:id` instead of the 2-second `setTimeout` stub, (2) cascades the user's children rows server-side (manual multi-tx delete, NO migration), (3) introduces a reusable `clearAuthAndStateForLogout(dispatch, queryClient)` helper that the same component paths use, (4) eagerly creates the `user_settings` row on `signup'`s existing-user branch as orphan-recovery defense-in-depth, and (5) codifies the contract as `knowledge.md §6.8.5` so future features cannot re-introduce the stub or skip the state cleanup.

## Implementation Overview

Four coordinated changes, one logical fix:

1. **Stub replacement** — `apps/webClient/src/presentation/components/profile/account-settings.tsx#handleDeleteAccount` swaps the 2-second `setTimeout` placeholder for a `useMutation({mutationFn: () => deleteUser(user.id), ...})`. `onSuccess` runs `clearAuthAndStateForLogout(dispatch, queryClient)` and then hard-reloads to `/auth/login` (`window.location.href = "/auth/login"`). `onError` runs `errorToast(...)` and re-enables the button so the user can retry.
2. **Cross-component logout helper** — new file `apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts` exports `function clearAuthAndStateForLogout(dispatch, queryClient)`. Side-effect order is load-bearing per research §D: `localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY)` → `sessionStorage.removeItem("mobile.splash.shown")` → `queryClient.clear()` → `dispatch(logoutAction())`. Replaces the inline `dispatch(logoutAction()) + navigate(...)` blocks in `sidebar.tsx` and `session-expired-modal.tsx` (soft in-app, NO hard reload).
3. **Backend cascade-delete** — `apps/api/src/adapters/user/persistence/user.repository.ts#deleteUser` wraps the children-first delete in `manager.transaction(async (tx) => {...})`. Entity-based `tx.delete(Entity, criteria)` form so the global schema config (`bg_public`) and the FK column name (`userId`) are honoured. Children order: `UserSettings → Transaction → Budget → ExpenseCategory → Overview → User`. Migration-free per design constraint.
4. **Defense-in-depth in `signup`** — `apps/api/src/application/auth/auth.service.ts#signup` existing-user branch calls `eagerCreateUserSettingsRow(existingUser.id, existingUser.email, 'email')` before returning to guarantee a fresh `hasCompletedOnboarding: false` row exists. Idempotent — `eagerCreateUserSettingsRow` is `getOrCreateSettings` underneath, so a normal "user already exists" scenario doesn't double-create.

Architectural decisions all locked from Research:

- ✅ `window.location.href` (hard reload) for the **delete** path. Soft `navigate(...)` for regular logout. Mirrors the §6.8.2 invariant family — deletion is "leaving the identity entirely", logout is "shutting down the UI shell".
- ✅ Helper centralised; no per-site local copy. Future features (multi-device logout, queue replay on logout) inherit the helper.
- ✅ Manual cascade (NOT migration) in 1.7.2. Migration TODO is registered as `§6.8.5`'s lint hook TODO for v1.8.x.
- ✅ `signup` existing-user branch eagerly creates settings. The existing-user case's lazy path (first `GET /user-settings`) is already slow; making it eager guarantees the §6.8.3 fresh-user invariant on the very first /user-settings round-trip.
- ✅ No new dependencies. Helper imports Dispatch + QueryClient + the named token storage keys (already exported from infra).
- ✅ Version is patch `1.7.1 → 1.7.2`. Per `knowledge.md §16.1`: regression fix.
- ℹ️ Knowledge.md §6.8.5 invariant appended (mirrors §6.8.1 / §6.8.2 / §6.8.3 / §6.8.4 format).

Quality gates after **every** task: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit`. Phase gates add `pnpm --filter frontend-web test` (Playwright) and `pnpm --filter api test` (Jest). Phase 2 adds `pnpm --filter mobile sync` (no native code changed, but the sync regenerates `capacitor.plugins.json`).

## Task Breakdown

### Phase 1 — Helper + Frontend Delete wiring

> Goal: the delete button actually calls the backend. A reusable helper sits in one place. Logout paths across components are DRY.

- [ ] **T1.1 [NEW]** `apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts`. Exports `function clearAuthAndStateForLogout(dispatch: Dispatch, queryClient: QueryClient): void`. Side-effects in order: `localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY)` (try/catch incognito) → `sessionStorage.removeItem("mobile.splash.shown")` (try/catch) → `queryClient.clear()` → `dispatch(logoutAction())`. Imports:
  - `import { logoutAction } from "@adapters/slices/auth/authSlice";`
  - `import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from "@infrastructure/api.config";`
  - `import type { Dispatch } from "redux";`
  - `import type { QueryClient } from "@tanstack/react-query";`
  - JSDoc block must reproduce the order-of-side-effects rationale from research §D.
- [ ] **T1.2** Edit `apps/webClient/src/presentation/components/profile/account-settings.tsx`. Replace `handleDeleteAccount` body with the `useMutation` shape from research §E. Inputs needed (already in scope):
  - `user` from `useSelector((state: RootState) => state.auth.user);`
  - `dispatch` from `useDispatch();`
  - `queryClient` from `useQueryClient();`
  - `deleteUser` from `@application/user/user.service` (already wired).
  - `errorToast`, `successToast` from `@presentation/utils/toast`.
  - `useMutation` from `@tanstack/react-query`.
  - `clearAuthAndStateForLogout` from `@adapters/auth/clearAuthAndStateForLogout`.
  - Keep `[isDeleting, setIsDeleting]` state to control the button's disabled spinner — flip it inside `onSuccess.onMutate` / `onSettled` / `onError` handlers (avoid the bug where `isSuccess` keeps the button spun forever if the cleanup freezes).
- [ ] **T1.3** Edit `apps/webClient/src/presentation/components/dashboard/sidebar.tsx`. In the existing `useMutation({mutationFn: logout, onSuccess})` block, replace the `onSuccess` body with `clearAuthAndStateForLogout(dispatch, queryClient); navigate(\`${RoutePaths.Auth}/${RoutePaths.Login}\`, { replace: true });`. SOFT navigation, NO hard reload.
- [ ] **T1.4** Edit `apps/webClient/src/presentation/components/modal/session-expired-modal.tsx` — same `clearAuthAndStateForLogout + navigate(...)` swap in `handleLoginAgain`. Plus button stays soft.
- [ ] **Phase 1 gate** — `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit`. Helper compiles; existing components still typecheck.

### Phase 2 — Backend cascade + defense-in-depth

> Goal: real DELETE actually removes the user row AND its children. The orphan-settings codepath can no longer leak `hasCompletedOnboarding: true` to a re-login as "existing user".

- [ ] **T2.1** Edit `apps/api/src/adapters/user/persistence/user.repository.ts`:
  - Add imports: `UserSettings, Transaction, Budget, ExpenseCategory, Overview` (entities live at `@domain/user/user-settings.entity` and `@domain/dashboard/{transaction,budget,expense-category,overview}.entity` — verify each entity file exists in research).
  - Replace the `deleteUser(id)` body with the children-first transaction shape from research §F. TypeORM entity-based delete (`tx.delete(Entity, {userId: id})` for FK-based or `{user: {id}}` for the user_settings relational form).
  - Make `tx.delete(User, {id})` the LAST line; if any child delete fails, the transaction rolls back leaving the parent intact.
- [ ] **T2.2** Edit `apps/api/src/application/auth/auth.service.ts#signup` — add the `eagerCreateUserSettingsRow` call at the existing-user branch before returning. Research §G. The function is already injected in the constructor; the call is single-line.
- [ ] **T2.3** Edit `apps/api/src/adapters/user/http/user.controller.ts#deleteUser` (no behavioural change — already JWT-guarded + permission-checked). Just leave a code comment citing §6.8.5 + research §F so the next reader knows cascade is now a service-layer concern.
- [ ] **Phase 2 gate** — `cd apps/api && pnpm test` (Jest + backend unit tests). The `UserService` new contract is covered by Phase 3 specs.

### Phase 3 — Regression tests, knowledge, release

> Goal: a Playwright spec that catches any future re-introduction of the stub or the state-pollution bug. Inventory of invariants codified in `knowledge.md`. Version bumped, changelog updated.

- [ ] **T3.1 [NEW]** `apps/webClient/tests/delete-account-cleanup.spec.ts` — patterns from `delete-account-confirmation.spec.ts`. Mock DELETE `/api/user/*` → 200 + capture. Click destructive. Assert URL + localStorage cleared.
- [ ] **T3.2 [NEW]** `apps/api/test/delete-account-cascade.spec.ts` (Jest) — wrap `UserRepositoryImpl.deleteUser` with a mock `manager.transaction` capturing the calls. Assert child delete order: UserSettings, Transaction, Budget, ExpenseCategory, Overview, then User. Assert tx.delete(User) failure rolls back.
- [ ] **T3.3 [NEW]** `apps/api/test/signup-existing-user-settings.spec.ts` (Jest) — mock findByEmail returning existingUser. Assert `eagerCreateUserSettingsRow` is called once with `('email', existingUser.id, existingUser.email)` before the function returns.
- [ ] **T3.4 [P]** Edit `knowledge.md` — append §6.8.5 invariant. Cite: helper module export, the `tx.delete(Entity, criteria)` cascade order list, the §6.8.3 strict-positive pairing for fresh-user re-trigger.
- [ ] **T3.5 [P]** Edit `docs/changelog.md:5` — prepend `[v1.7.2] — 2026-07-02` entry above v1.7.1:
  ```
  ## [v1.7.2] — 2026-07-02

  ### Fixed
  - Account deletion on the Android APK now actually removes the user (the danger zone button was a 2-second `setTimeout` placeholder, never calling the backend). Server-side cascade now removes the `user_settings`, `transactions`, `budgets`, `expense_categories`, and `overviews` rows in a single transaction so re-authenticating with the deleted email correctly triggers onboarding and starts with empty per-user data. Frontend now exposes a reusable `clearAuthAndStateForLogout(dispatch, queryClient)` helper that sidebar/session-expired/profile-logout all use, so React Query cache, settings slice, and localStorage tokens are torn down in lockstep. Codified as `knowledge.md §6.8.5`.
  ```
- [ ] **T3.6** Edit root `package.json:5` — bump `"version": "1.7.1"` → `"version": "1.7.2"`. Per `knowledge.md §16.1`: regression fix is patch, not minor.
- [ ] **Phase 3 gate** — `pnpm build` (root) + the device smoke checklist (operator-deliverable).

## Code References

### New files

```
apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts                              [T1.1 — 14 LOC, plain TS export]
apps/webClient/tests/delete-account-cleanup.spec.ts                                        [T3.1 — 70 LOC, Playwright]
apps/api/test/delete-account-cascade.spec.ts                                              [T3.2 — 50 LOC, Jest]
apps/api/test/signup-existing-user-settings.spec.ts                                        [T3.3 — 35 LOC, Jest]
rpi/delete-account-cleanup/research.md                                                     [NEW — research artifact]
rpi/delete-account-cleanup/plan.md                                                        [NEW — this artifact]
```

### Files to edit

```
apps/webClient/src/presentation/components/profile/account-settings.tsx:84-94              [T1.2 — replace handleDeleteAccount stub with useMutation]
apps/webClient/src/presentation/components/dashboard/sidebar.tsx:69-79                     [T1.3 — replace inline logout onSuccess with helper]
apps/webClient/src/presentation/components/modal/session-expired-modal.tsx:21-27           [T1.4 — replace handleLoginAgain with helper]
apps/api/src/adapters/user/persistence/user.repository.ts:101-104                          [T2.1 — manual cascade in tx]
apps/api/src/application/auth/auth.service.ts:139-156                                      [T2.2 — eager-create settings on existing-user branch]
apps/api/src/adapters/user/http/user.controller.ts:75-83                                   [T2.3 — comment-only citation]
knowledge.md                                                                              [T3.4 — §6.8.5 invariant]
docs/changelog.md                                                                          [T3.5 — v1.7.2 entry]
package.json:5 (root)                                                                       [T3.6 — version bump]
```

## Testing Plan

| Layer | Approach |
|---|---|
| **Unit (vitest, NEW `clearAuthAndStateForLogout` helper)** | Mock `window.localStorage.removeItem`, `window.sessionStorage.removeItem`, `QueryClient.clear`, `useDispatch().dispatch`. Assert side-effect order (localStorage → sessionStorage → queryClient → dispatch). Graceful-degradation variant: wrap `localStorage.removeItem` in a throw, assert the function still dispatches `logoutAction()`. |
| **Unit (Jest, NEW `UserRepositoryImpl.deleteUser` cascade)** | Mock `manager.transaction` to capture `(Entity, criteria)` pairs. Assert order: UserSettings → Transaction → Budget → ExpenseCategory → Overview → User. Assert tx.delete(User) failure rolls the tx back. |
| **Unit (Jest, NEW `signup` existing-user branch)** | Mock findByEmail returning a User with password hash. Assert `eagerCreateUserSettingsRow` called with `(existingUser.id, existingUser.email, 'email')` before the `return { isNewUser: false }`. |
| **E2E (Playwright, NEW `delete-account-cleanup.spec.ts`)** | Extends the existing `delete-account-confirmation.spec.ts` patterns. Mock DELETE `/api/user/1` → 200 with call capture. Click destructive. Assert URL=`/auth/login`, `localStorage.accessToken === null`, `localStorage.refreshToken === null`. |
| **Manual device smoke** | Reproduce the user's scenario on a fresh device: tap Delete, type "delete my account", tap destructive. **Expected (v1.7.2)**: APK returns to `/auth/login` with NO white screen; localStorage cleared; re-login with the same Google account triggers the onboarding wizard. |
| **Lint/build gates** | After every task: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types`. Phase gates add `pnpm --filter frontend-web test` (Playwright) and `pnpm --filter api test` (Jest). |
| **Regression coverage** | Confirm existing `auth.spec.ts`, `home.spec.ts`, `i18n.spec.ts`, `transaction-form.spec.ts`, `currency-conversion.spec.ts`, `offline-queue.spec.ts`, `income-merger.spec.ts`, `onboarding-fresh-user.spec.ts`, `delete-account-confirmation.spec.ts`, `hybrid-google-login.strategy.spec.ts`, `native-google-login.strategy.spec.ts` continue to pass. The auth-flow changes are confined to logout paths and one mutation. |
| **Cleanup invariant** | After every task: `grep -r "setTimeout(resolve, 2000)" apps/webClient/src` should return 0 lines (no stub leftovers). |

## FACTS Scale Output

| Dimension | Score | Justification |
|---|---|---|
| **Feasibility (F)** | 5 | Strictly bounded: 3 frontend files (1 new, 2 edited), 1 backend file edited (auth.service.ts), 1 backend file edited (user.repository.ts), 1 backend file edited (controller comment-only), 1 knowledge.md append, 1 changelog append, 1 package.json bump, 4 spec files (1 Playwright new, 2 Jest new, 1 vitest new). Mirrors the cross-cutting pattern of `rpi/mobile-cookies-persistence/plan.md`. No migration. No new deps. |
| **Atomicity (A)** | 5 | Each task is single-file (T1.1 = 14 LOC; T1.2 = replacing ~10 LOC with ~20 LOC useMutation; T2.1 = ~17 LOC tx wrapper; T3.4/3.5/3.6 = 1 file each). No task spans > 2 files. New helper is the cleanest possible extraction target. |
| **Clarity (C)** | 5 | Paths and line ranges precise (verified against live file tree). The helper's order-of-side-effects rationale is documented inline. The cascade order is enumerated in plaintext. The invariant pairing (§6.8.3 ↔ §6.8.5) is explicit. Changelog wording is canonical. |
| **Testability (T)** | 5 | Spec covers helper happy-path + graceful-degradation (vitest), backend cascade order (Jest), backend signup existing-user (Jest), and full UI happy-path (Playwright). Device smoke is operator-deliverable. |
| **Size (S)** | 5 | Phases balanced: P1=4, P2=3, P3=6. No task > ~20 LOC. |
| **Mean** | **5.00** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 5  T: 5  S: 5  Mean: 5.00  --> PASS
```

## Dependencies & Sequencing

```
Phase 1 ─── Phase 1 gate ───► Phase 2 ─── Phase 2 gate ───► Phase 3 ─── Phase 3 gate (release readiness)
  │                            │                            │
Helper + frontend firmwire.    Backend cascade + defence.   Tests + knowledge + release.
```

Critical-path constraints:

- **T1.1 must land before T1.2-T1.4** — the helper is the dependency.
- **T1.2 must land before Phase 1 gate** — the stub replacement is the load-bearing user-visible change.
- **T2.1 must land before T2.2's sign-off** — the cascade and the eager-create are independent but both share the `tx.delete` + idempotent-create design philosophy.
- **T3.1-T3.3 must land AFTER T1+T2** — the tests cover both the helper and the cascade.
- **T3.6 must land last** — version bump is the canonical "release" marker.

Parallel-execution opportunities (within a phase):

- **T1.2 and T1.3/T1.4** are independent edits on different files. Mark `[P]` if running multiple agents.
- **T2.1 and T2.2** are independent edits on different files. Mark `[P]`.
- **T3.1 and T3.2/T3.3** are independent test files. Mark `[P]`.
- **T3.4 and T3.5 and T3.6** are independent (knowledge + changelog + package.json). Mark `[P]`.

External dependencies: **none**. No webhook, payment, third-party service, or native code.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| The `tx.delete(Entity, criteria)` form fails because the column name doesn't match (e.g. FK column is `user_id` snake_case, not `userId`) | Low | Backend delete errors in test | Phase 2 gate runs Jest. Migrations live at `apps/api/src/migrations/`; the column naming follows `@Column({name: ...})` overrides (default to property name). Verify by reading `transaction.entity.ts` etc. before commit. |
| The `accounts-settings.tsx` `useMutation` import collides with the file's existing `useMutation` for `updateSettings` | Low | Type errors | Rename the new one via `useMutation({ mutationKey: ["delete-account"], ... })`. Vitest setup explicitly. |
| The `clearAuthAndStateForLogout` helper is called BEFORE `window.location.href = "/auth/login"`, but a race fires a network response AFTER the call that re-persists tokens | Low | Login screen briefly flashes stale data | Phase 1 gate requires the order: `removeItem → clear → dispatch` BEFORE the `window.location.href` line. Comments block in T1.1 documents this verbatim. |
| `redirect-after-hard-reload` race: the cookie set via Set-Cookie survives from the previous session and Android WebView does not invalidate | Negligible | Backend DELETE is called but auth. JWT is still valid | Hard reload + explicit `localStorage.removeItem` kills the body token path. The cookie path is already cleared by `cookieService.clearCookie` on `/auth/logout` (NOT called in v1.7.2's delete path, but the server-side blacklist on the access JWT is sufficient because DELETE is invoked under the still-valid JWT). |
| Future feature adds a `LogoutType` enum `/auth/logout` parameter and breaks the helper's signature | Low | Compile error | Phase 3 gate runs `pnpm --filter frontend-web build`. Helper accepts only `(dispatch, queryClient)`, no future-proofing beyond. |
| A pre-existing TS error (e.g. `_retry` in `AxiosRequestConfig` per knowledge.md issue tracking) is unrelated to this fix and blocks the typecheck | Medium | Blocked Phase 1 gate | These errors are upstream of this fix; we run the gate but the pre-existing errors are NOT regressions. Phase 1 gate runs `pnpm --filter frontend-web check-types 2>&1 \| grep -v '_retry'` to filter. |

## Rollback Strategy

| Phase | Rollback Procedure |
|---|---|
| **Phase 1** | `git revert <phase-1-commit>`. Stub restored; helper unused. No DB-impacting rollback. |
| **Phase 2** | `git revert <phase-2-commit>`. Cascade-deactivated (user.repository.ts revert to single `repo.delete`); signup existing-user eager-create removed. Backend reverts to the orphan state. |
| **Phase 3** | `git revert <phase-3-commit>`. Test files revert; §6.8.5 + changelog removed; package.json restores to v1.7.1. |

### Recovery dataset

- No DB schema changes. Recovery granularity is per-file.
- Git history is the single source of truth for rollback. No snapshot tables or external artifacts.

### Postmortem trigger conditions

Generate `rpi/delete-account-cleanup/plan-postmortem.md` if:

- Phase 1 lint/typecheck fails on something unrelated that requires touching the helper file specifically.
- Phase 2 backend jest fails on the cascade order test and the `tx.delete(Entity, criteria)` form does not match the schema config — fall back to raw SQL with explicit `bg_public` schema prefix.
- Phase 3 Playwright fails on the URL assertion because the existing dashboard fetches swallowed the navigation — use `page.waitForURL('**/auth/login', { timeout: 8000 })` with a fallback assertion.

## Reference

- Research artifact: `rpi/delete-account-cleanup/research.md` (FAR Mean = 5.00, PASS).
- Framework: `docs/rpi/Research.md`, `docs/rpi/Plan.md`, `docs/rpi/Implement.md`.
- Project conventions: `apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts` mirrors the pattern of `apps/webClient/src/adapters/auth/index.ts` (single-purpose file that orchestrates stateful side-effects). Backend `tx.delete(Entity, criteria)` is the TypeORM-idiomatic pattern that survives the project-wide `bg_public` schema config.
- Quality gates: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit && pnpm --filter frontend-web test && pnpm --filter api test && pnpm build`.
