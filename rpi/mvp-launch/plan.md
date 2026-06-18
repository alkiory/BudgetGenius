# MVP Launch — Plan

## Implementation Overview

Three-phase refactor to ship BudgetGenius as a single free product. The strategy isolates risk: **Phase 1 removes only logic** (no deletions) so the build stays green and the backend unlock is reversible; **Phase 2 deletes dead surface** (SavingGoal full-stack, Investments stub, premium UI) in a single sweep; **Phase 3 reinflates visual parity** (Goals mini-card widget), cleans i18n/tests, and converts `isPremium` to a dormant column with default `true`.

Architectural decisions already locked from Research:
- ✅ Dashboard mini-card widget: build `goals-targets-card.tsx` parallel to savings version.
- ✅ `isPremium` column: keep dormant, set default `true` via migration, drop all runtime reads/writes.
- ✅ Reports + AI + unlimited budgets/goals: always-on for free MVP.

Quality gates run after **every** task: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. Phase-completion gate additionally runs `pnpm build`.

## Task Breakdown

### Phase 1 — Gating Drop (logic removal only, no deletions)

> **Goal:** Free backend access to Reports, AI/Finny, unlimited budgets and goals. Frontend guards untouched in this phase — Reports/AI routes still wrapped by `<PremiumRoute>` until Phase 2 deletes it. The mid-state is acceptable for builds and tests (existing test mocks continue to pass because the frontend guard still hides the pages from non-premium users in test fixtures).

- [ ] T1.1 Sweep `@UseGuards(..., PremiumGuard)` decorators across `apps/api/src/adapters/`. Expected locations: `ai/http/ai.controller.ts:13,19`, `dashboard/http/reports.controller.ts:5,9`, `dashboard/http/goal.controller.ts:21,24`. Replace each occurrence with just `@UseGuards(JwtAuthGuard)` (or controller's primary guard only). Re-read each file first to confirm no replacement guard needed.
- [ ] T1.2 Once T1.1 is complete, delete `apps/api/src/infrastructure/config/guards/premium.guard.ts`.
- [ ] T1.3 Rewrite `apps/api/src/infrastructure/ai/guard/jwt-ai.guard.ts`: remove the premium branch (`get<boolean>('premiumAccess', ...)` lookup + `if (!user.isPremium) throw new UnauthorizedException` block). Final shape: pure JWT auth (verify token, return true). Verify the `premiumAccess` `@SetMetadata` decorator isn't used anywhere else first; if it is, delete it too (`@adapters/ai/decorators/premium-access.decorator.ts` or similar — search first).
- [ ] T1.4 Edit `apps/api/src/application/dashboard/services/reports.service.ts`: strip the `const user = await this.userRepo.findById(userId); if (!user.isPremium) return [];` blocks from all 5 methods (`getOverview` L19–26, `getByCategory` L33–40, `getWeekly` L43–50, `getSavings` L53–60, `getInsights` L68). Keep OpenAI imports and the `getInsights` retry loop intact.
- [ ] T1.5 Edit `apps/api/src/application/dashboard/services/budget.service.ts`: at L33–40 (in `createBudget`), remove the block `const user = await this.userRepo.findById(userId); if (!user.isPremium && existingCount >= 3) throw new ForbiddenException(...)`. Keep logger warn call structure but drop the trace message or keep generic.
- [ ] T1.6 Edit `apps/api/src/application/dashboard/services/goal.service.ts`: at L55–66 (in `createGoal`), same removal as T1.5. The `userRepo.findById` call may still be needed elsewhere — only delete the quota check, not the lookup.
- [ ] T1.7 Rewrite `apps/api/test/budget-service.spec.ts` quota assertions. Expected: a test asserting that `createBudget` throws when called a 4th time (likely L18, L43 area). Replace with: a test asserting unlimited creation succeeds (loop `createBudget` 5+ times, assert no throw). Keep spec file structure parallels other tests.
- [ ] T1.8 Find/replace assertions in `apps/api/test/goal-service.spec.ts` for the 4th-goal quota. Mirror T1.7 — if no spec exists for goal-quota, add a positive `unlimited goals` test.
- [ ] **Phase 1 gate** — `pnpm --filter api lint && pnpm --filter api test`. Backend now permits free-user access but frontend still gates via `<PremiumRoute>`. No user-facing changes yet.

### Phase 2 — Dead-Surface Purge (mass deletions)

> **Goal:** Remove saving_goals full stack, Investments stub, /upgrade page, and all premium UI components. After Phase 2 closes, free users navigate freely to Reports/AI (which were unlocked in Phase 1) and never see upgrade upsells.

**Backend deletions:**
- [x] T2.1 Delete `apps/api/src/domain/dashboard/saving-goal.entity.ts`.
- [x] T2.2 Delete `apps/api/src/adapters/dashboard/persistence/saving-goal.repository.ts`.
- [x] T2.3 Delete `apps/api/src/application/dashboard/services/saving-goal.service.ts`.
- [x] T2.4 Delete `apps/api/src/adapters/dashboard/http/saving-goal.controller.ts`.
- [x] T2.5 Delete `apps/api/src/application/dashboard/dto/create-saving-goal.dto.ts`.
- [x] T2.6 Delete `apps/api/src/application/dashboard/dto/update-saving-goal.dto.ts`.
- [x] T2.7 Edit `apps/api/src/infrastructure/dashboard/dashboard.module.ts`: drop SavingGoal imports (L6, L9, L15, L20, L45, L54, L64), drop `SavingGoal` from `TypeOrmModule.forFeature([...])`, drop `SavingGoalController` from `controllers`, drop `SavingGoalService` (×2) and `SavingGoalRepository` (×2) from `providers`, drop `SavingGoalService` from `exports`.
- [x] T2.8 Edit `apps/api/src/application/dashboard/services/expense-category.service.ts`: drop the `SavingGoalRepository` import (L5) and the `getSavingGoalsByUser` method (L64–67). Verify it's not used elsewhere first via search.
- [x] T2.9 Edit `apps/api/src/domain/user/user.entity.ts`: drop the `savingGoals: SavingGoal[]` `@OneToMany` relation (L78–79) and the `import { SavingGoal } from '@domain/dashboard/saving-goal.entity';` (L15). Do NOT remove the `isPremium` column yet — that's Phase 3.
- [x] T2.10 Delete the migration reference in `apps/api/src/migrations/` indirectly — it's an existing `up/down` that creates `saving_goals` table. **Don't delete the file**. Plan: leave migration file intact (history is immutable), but add a **new** migration in Phase 3 that drops the table.

**Frontend deletions:**
- [x] T2.11 Delete `apps/webClient/src/presentation/pages/dashboard/investmentPage.tsx`.
- [x] T2.12 Delete `apps/webClient/src/presentation/pages/dashboard/saving-goalPage.tsx`.
- [x] T2.13 Delete `apps/webClient/src/presentation/components/dashboard/saving-goals.tsx`.
- [x] T2.14 Delete all 8 files in `apps/webClient/src/presentation/components/dashboard/saving-goal/` (`add-saving-goal.tsx`, `delete-all-saving-goal.tsx`, `delete-saving-goal.tsx`, `edit-saving-goal.tsx`, `saving-goal-card-mini.tsx`, `saving-goal-card.tsx`, `saving-goal-form.tsx`, `savings-loading.tsx`).
- [x] T2.15 Delete `apps/webClient/src/domain/dashboard/saving-goal/` (3 files: `saving.entity.ts`, `savingRepository.ts`).
- [x] T2.16 Delete `apps/webClient/src/http/saving-goal.repository.ts` if it exists at the legacy non-aliased path.
- [x] T2.17 Delete `apps/webClient/src/adapters/http/saving-goal.repository.ts`.
- [x] T2.18 Edit `apps/webClient/src/adapters/query/dashboard.tsx`: drop the `useFetchSavings` hook import (L3) and implementation (L42). Verify no other module imports `useFetchSavings` first.
- [x] T2.19 Delete `apps/webClient/src/presentation/routes/premium-pages.tsx`.
- [x] T2.20 Delete `apps/webClient/src/presentation/pages/upgrade/upgradePage.tsx`.
- [x] T2.21 Delete `apps/webClient/src/presentation/components/modal/premium-upgrade-modal.tsx`.
- [x] T2.22 Delete `apps/webClient/src/presentation/components/modal/premium-card.tsx`.
- [x] T2.23 Delete `apps/webClient/src/presentation/components/upgrade/upgrade-alert.tsx`. If parent directory becomes empty, delete it too.
- [x] T2.24 Edit `apps/webClient/src/presentation/routes/route-config.tsx`: drop imports (L22 `PremiumRoute`, L18 `UpgradePage`, L23 `SavingGoalPage`, L28 `InvestmentPage`); drop the `RoutePaths.Upgrade` route definition outside `ProtectedRoute` wrapper (L52); inside `ProtectedRoute`, drop the `<Route element={<PremiumRoute />}>` wrapper (L62) and inline the inner routes (Savings/Reports/Investments) directly. Verify the imports don't leave orphan names.
- [x] T2.25 Edit `apps/webClient/src/presentation/components/dashboard/sidebar.tsx`: drop `isPremium: true` entries for `reports`, `investments`, `savings` (L18, L21, L22); drop `ChartCandlestick`, `PiggyBank`, `Crown` from lucide-react imports (L12); drop the `isPremium` styles branch (L59–60, L70–71); drop the Premium pill block (L138–143); drop the "Upgrade" link section (L151–177); drop the `user?.isPremium` conditional wrapper around that block.
- [x] T2.26 Edit `apps/webClient/src/presentation/components/dashboard/budgets/budget-modal.tsx`: drop the `PremiumCard` import (L8); drop the `showPremiumCard` state + handlers (L24–27); drop the `setShowPremiumCard(true)` calls after success/error paths (L47, L74); drop the 403 → premium-card branch in error handler (likely L38–40 & L63–65 — search for `error.response.status === 403`); drop the `<PremiumCard>` renderJSX (L99–110).
- [x] T2.27 Edit `apps/webClient/src/presentation/components/dashboard/goals/goal-modal.tsx`: search for any 403 → premium upsell pattern mirroring T2.26 and remove. If none, just drop any unneeded premium-related references.
- [x] T2.28 Edit `apps/webClient/src/presentation/components/dashboard/main-content.tsx` if there is any premium-specific layout. Verifiy by searching for `premium` in that file.
- [x] T2.29 Search and delete any leftover orphan `dashboard/lib/savingGoalRoutes.ts` or similar (use `code_search` for `saving-goal|investment` to catch unindexed files).
- [ ] **Phase 2 gate** — `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`. This is the strictest gate — both apps must compile and all tests pass.

### Phase 3 — Reinflation, i18n, Tests, Column Default

> **Goal:** Replace the deleted dashboard widget with a Goals-targets mini-card, finalize i18n copy, sweep tests, and convert `isPremium` to dormant state. This is the largest UX-facing phase.

**Widget reinflation:**
- [ ] T3.1 Create `apps/webClient/src/presentation/components/dashboard/goals/goals-targets-card.tsx`. Mirror the structure of the deleted `saving-goals.tsx`: title, max 3 cards with progress, link to `/app/dashboard/goals`. Pull data from the existing `useFetchGoals` hook in `adapters/query/dashboard.tsx`. Each card shows name, percentComplete, target/current formatted via `currencyService.formatCurrency(amount, 'USD', targetCurrency, false)`. Use the same Tailwind classes as the deleted component for visual parity.
- [ ] T3.2 Edit `apps/webClient/src/presentation/pages/dashboard/dashboardPage.tsx`: replace the `import { SavingsGoals } from '...saving-goals'` import (L10) with `import { GoalsTargetsCard } from '...goals/goals-targets-card'`; replace the `<SavingsGoals />` JSX tag with `<GoalsTargetsCard />`.
- [ ] T3.3 Edit `apps/webClient/src/presentation/pages/dashboard/dashboardPage.tsx`: rebalance the responsive grid since the widget is now Goals-only (3 grid cells). Adjust the `<div className="grid ...">` wrappers at L62–80 — keep `md:grid-cols-2` but simplify since both halves now show different content.

**Route enum + auth hook cleanup:**
- [ ] T3.4 Edit `apps/webClient/src/presentation/utils/routes.ts`: drop enum entries `Investments`, `Savings`, `Upgrade` from both `RouteNames` (L13–15) and `RoutePaths` (L21–25). Cross-check no file imports these before editing (search first).
- [ ] T3.5 Edit `apps/webClient/src/adapters/hooks/useLoadUser.tsx`: drop `RoutePaths.Upgrade` from the public-paths allowlist (L19).

**i18n sweep:**
- [ ] T3.6 Edit `apps/webClient/src/infrastructure/i18n/locales/en.json`: delete the `savings` block (L428–458), the `investments` block (L586), the `sidebar.investments`, `sidebar.savings`, `sidebar.upgrade`, `sidebar.premium` keys (L587–592), the `upgrade` block (L451–528), the `dashboard.upgradeForSavings` (L110), and the `landing.noCreditCard` (L588). Use `jsonc` parse tools or jq to find clean line blocks.
- [ ] T3.7 Same operation for `apps/webClient/src/infrastructure/i18n/locales/es.json` (mirror of T3.6 line numbers).
- [ ] T3.8 Edit `apps/webClient/src/presentation/pages/cta.tsx`: at L446, drop the `<Link to={RoutePaths.Upgrade}>` block in the footer that says "Free plan available with premium upgrades"; replace with a simple "All features, free forever" link (or none). Also search for "premium" / "Premium" string in this file and remove marketing claims.
- [ ] T3.9 Edit `apps/webClient/src/presentation/pages/auth/signup.tsx`: drop `isPremium` state (L28), drop `isPremium` from ensureUserIsValid payload (L75), drop from `useEffect` dep array (L87).

**Entity / DTO / Migration (dormant column):**
- [ ] T3.10 Edit `apps/api/src/domain/user/user.entity.ts`: change the `@Column() isPremium: boolean;` decorator (L47–48) to `@Column({ default: true }) isPremium: boolean;`. Keep the field, keep the relation — only the default flips.
- [ ] T3.11 Generate migration: `pnpm --filter api migration:create --name=ispremium-default-true`. Edit generated file: `up = ALTER TABLE "bg_public"."users" ALTER COLUMN "isPremium" SET DEFAULT true; UPDATE "bg_public"."users" SET "isPremium" = true WHERE "isPremium" = false;`. `down = ALTER TABLE "bg_public"."users" ALTER COLUMN "isPremium" DROP DEFAULT;` (does not re-set to false on rollback intentionally).
- [ ] T3.12 Edit `apps/api/src/domain/user/user.entity.ts` L78–79 — also drop the `savingGoals` relation removed in T2.9 if not already. (Verify T2.9 was completed.)
- [ ] T3.13 Edit `apps/api/src/application/user/dto/user.dto.ts`: keep the `isPremium: boolean;` field (L41) for backward compatibility of API responses, but document it as `// @deprecated — always true for MVP`.
- [ ] T3.14 Edit `apps/api/src/application/user/dto/create.dto.ts`: drop the `isPremium` field entirely (L34). New users get column default `true`.
- [ ] T3.15 Edit `apps/api/src/application/user/user.service.ts`: drop `isPremium` from the `createUser` payload (L41, L60, L79). Keep the field on returned User objects (still returned via DTO).
- [ ] T3.16 Edit `apps/api/src/adapters/user/persistence/user.repository.ts`: in `createUser` (L23, L33), drop the destructuring/assignment of `isPremium`. Verify no other code-path depends on writing a non-true value. Use search before editing.
- [ ] T3.17 Edit `apps/api/src/application/user/user-seeder.service.ts`: drop the seeded `isPremium: true/false` values (L29, L40, L60, L71) — new seeds default to `true`.
- [ ] T3.18 Edit `apps/api/src/application/auth/auth.service.ts`: at L173 (Google OAuth upsert payload), drop `isPremium: false` — use column default.
- [ ] T3.19 Edit `apps/api/src/adapters/auth/http/auth.controller.ts`: drop `isPremium: false` lines (L104, L141).
- [ ] T3.20 Edit `apps/api/src/domain/user/user.repository.port.ts`: drop `isPremium` from the createUser signature (L12). Keep on update signature for niche admin flows.
- [ ] T3.21 Search for remaining `isPremium` runtime reads across `apps/api/src` (excludes entity definition + DTO fields). Should be 0 hits after T3.10–T3.20. If any persist, remove them.
- [ ] T3.22 Edit `apps/webClient/src/domain/user/user.entity.ts`: drop `isPremium: boolean;` from the `User` type (L18) and from the `ensureUserIsValid` parameters and return (L24, L50). Apply generic cleanup.

**Test sweep (Jest backend):**
- [ ] T3.23 Edit `apps/api/test/auth-service.spec.ts`: drop literal `isPremium: false` (L24).
- [ ] T3.24 Edit `apps/api/test/user-service.spec.ts`: drop `isPremium` literals (L19, L106, L139).
- [ ] T3.25 Edit `apps/api/test/budget-service.spec.ts`: drop `savingGoals: []` mock fields (L26, L51).
- [ ] T3.26 Add new spec `apps/api/test/reports-unlocked.spec.ts`: assert `ReportService.getOverview`, `getByCategory`, `getWeekly`, `getSavings`, `getInsights` no longer check `isPremium`. (Direct unit test on the service after T1.4.)
- [ ] T3.27 Add new spec `apps/api/test/ai-unguarded.spec.ts`: verify `ai.controller.ts` no longer applies `PremiumGuard`. (E2E-style or directly on the guard module exports.)
- [ ] **Mid-Phase gate** — `pnpm --filter api lint && pnpm --filter api test`. Confirm Jest specs green.

**Test sweep (Playwright frontend):**
- [ ] T3.28 Edit `apps/webClient/tests/auth.spec.ts`: drop `isPremium: true` from user mock (L51); drop `**/api/saving-goals**` route mock (L101).
- [ ] T3.29 Edit `apps/webClient/tests/currency-conversion.spec.ts`: drop `isPremium: true` from user mock (L17); drop saving-goals route mock (L51).
- [ ] T3.30 Edit `apps/webClient/tests/offline-queue.spec.ts`: drop `isPremium: true` from user mocks (L19, L28); drop saving-goals route mock (L57).
- [ ] T3.31 Edit `apps/webClient/tests/transaction-form.spec.ts`: drop `isPremium: true` from user mock (L22).
- [ ] T3.32 Add new spec `apps/webClient/tests/mvp-free-flow.spec.ts`: E2E happy-path covering user signs up → creates 4 budgets (passes, no premium upsell) → creates 4 goals (passes) → navigates to `/app/dashboard/reports` (loads with data, not upgrade placeholder) → opens AI chat (loads, not blocked by 401).
- [ ] **Phase 3 gate** — `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`. All greenery here is the launch readiness signal.

## Code References

### New files (greenfield)

```
apps/api/src/migrations/1776510954067-ispremium-default-true.ts [NEW]
apps/webClient/src/presentation/components/dashboard/goals/goals-targets-card.tsx [NEW]
apps/api/test/reports-unlocked.spec.ts [NEW]
apps/api/test/ai-unguarded.spec.ts [NEW]
apps/webClient/tests/mvp-free-flow.spec.ts [NEW]
```

### Files to delete

```
apps/api/src/infrastructure/config/guards/premium.guard.ts
apps/api/src/domain/dashboard/saving-goal.entity.ts
apps/api/src/adapters/dashboard/persistence/saving-goal.repository.ts
apps/api/src/application/dashboard/services/saving-goal.service.ts
apps/api/src/adapters/dashboard/http/saving-goal.controller.ts
apps/api/src/application/dashboard/dto/create-saving-goal.dto.ts
apps/api/src/application/dashboard/dto/update-saving-goal.dto.ts
apps/webClient/src/presentation/pages/dashboard/investmentPage.tsx
apps/webClient/src/presentation/pages/dashboard/saving-goalPage.tsx
apps/webClient/src/presentation/pages/upgrade/upgradePage.tsx
apps/webClient/src/presentation/components/dashboard/saving-goals.tsx
apps/webClient/src/presentation/components/dashboard/saving-goal/* (8 files)
apps/webClient/src/presentation/components/modal/premium-upgrade-modal.tsx
apps/webClient/src/presentation/components/modal/premium-card.tsx
apps/webClient/src/presentation/components/upgrade/upgrade-alert.tsx
apps/webClient/src/presentation/routes/premium-pages.tsx
apps/webClient/src/presentation/components/upgrade/ (empty parent dir)
apps/webClient/src/domain/dashboard/saving-goal/ (3 files)
apps/webClient/src/adapters/http/saving-goal.repository.ts
```

### Files to edit (~28)

```
apps/api/src/infrastructure/ai/guard/jwt-ai.guard.ts
apps/api/src/adapters/ai/http/ai.controller.ts
apps/api/src/adapters/dashboard/http/reports.controller.ts
apps/api/src/adapters/dashboard/http/goal.controller.ts
apps/api/src/application/dashboard/services/reports.service.ts
apps/api/src/application/dashboard/services/budget.service.ts
apps/api/src/application/dashboard/services/goal.service.ts
apps/api/src/application/dashboard/services/expense-category.service.ts
apps/api/src/infrastructure/dashboard/dashboard.module.ts
apps/api/src/domain/user/user.entity.ts
apps/api/src/domain/user/user.repository.port.ts
apps/api/src/application/user/dto/user.dto.ts
apps/api/src/application/user/dto/create.dto.ts
apps/api/src/application/user/user.service.ts
apps/api/src/application/user/user-seeder.service.ts
apps/api/src/application/auth/auth.service.ts
apps/api/src/adapters/user/persistence/user.repository.ts
apps/api/src/adapters/auth/http/auth.controller.ts
apps/api/test/auth-service.spec.ts
apps/api/test/user-service.spec.ts
apps/api/test/budget-service.spec.ts
apps/webClient/src/presentation/routes/route-config.tsx
apps/webClient/src/presentation/components/dashboard/sidebar.tsx
apps/webClient/src/presentation/components/dashboard/budgets/budget-modal.tsx
apps/webClient/src/presentation/components/dashboard/goals/goal-modal.tsx
apps/webClient/src/presentation/components/dashboard/main-content.tsx (review only)
apps/webClient/src/presentation/pages/dashboard/dashboardPage.tsx
apps/webClient/src/presentation/pages/auth/signup.tsx
apps/webClient/src/presentation/pages/cta.tsx
apps/webClient/src/presentation/utils/routes.ts
apps/webClient/src/adapters/hooks/useLoadUser.tsx
apps/webClient/src/adapters/query/dashboard.tsx
apps/webClient/src/domain/user/user.entity.ts
apps/webClient/src/infrastructure/i18n/locales/en.json
apps/webClient/src/infrastructure/i18n/locales/es.json
apps/webClient/tests/auth.spec.ts
apps/webClient/tests/currency-conversion.spec.ts
apps/webClient/tests/offline-queue.spec.ts
apps/webClient/tests/transaction-form.spec.ts
```

## Testing Plan

| Layer | Strategy |
|-------|----------|
| Backend unit (Jest) | T1.7–T1.8 + T3.23–T3.27 rewrite assertion logic. After Phase 1, write 1 spec per unlocked service (`reports-unlocked`, `ai-unguarded`) to assert absence of premium checks. |
| Backend build | `pnpm --filter api build` after Phase 1 (no migrations yet); `pnpm --filter api migration:run` after T3.11; full build after Phase 3. |
| Frontend build | `pnpm --filter frontend-web lint && pnpm --filter frontend-web test` after each phase. Run `pnpm build` from root before final sign-off. |
| E2E free-flow (Playwright) | New `mvp-free-flow.spec.ts` (T3.32) must validate: 4-budget create succeeds, 4-goal create succeeds, `/app/dashboard/reports` renders the ReportsPage (not upgrade placeholder), AI chat opens for free user. |
| Regression | All previously passing tests should remain green. Tests-mock `isPremium: true` becomes dead but harmless; tests-mock route `**/api/saving-goals**` becomes orphaned and is removed. |
| Manual/Visual | After Phase 3.1–3.3, take screenshot of dashboard home — verify Goals mini-card renders identically to deleted Savings mini-card. |

## FACTS Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Feasibility (F)** | 5 | All tasks match established codebase patterns (NestJS controllers, React components, i18n JSON). No exotic new dependencies. Migration built via `pnpm migration:create` already wired. |
| **Atomicity (A)** | 5 | Every task is either (a) edit single file at specific lines, (b) delete single file, or (c) create one new file. i18n sweep is split into en.json and es.json as separate tasks to maintain atomicity. Migration in T3.11 is its own task. |
| **Clarity (C)** | 4 | Each task description names the exact file path, sometimes line numbers; intent is clearly stated. Some i18n tasks (T3.6/T3.7) reference line ranges that may shift after earlier edits — leverage `jq` or ripgrep at execution time to find current line numbers. |
| **Testability (T)** | 5 | Every task ends at a compile boundary (single file edit / delete / create). Build/lint/test gates after each task surface failures immediately. New specs pin the contract (reports-unlocked, ai-unguarded, mvp-free-flow). |
| **Size (S)** | 4 | Phases are balanced (1: 8 tasks, 2: 19 tasks, 3: 32 tasks). Phase 3 is the largest because i18n + entity + tests all cluster there; tasks are still individually atomic. No task > 1 file except i18n (en.json/es.json split into 2). |
| **Mean** | **4.6** | **PASS** (≥ 3.00) |

## Dependencies & Sequencing

```
Phase 1 ─┬─ T1.1 ── T1.2 (PremiumGuard)
         ├─ T1.3 (JwtAiGuard)        [parallel to T1.1/T1.2]
         ├─ T1.4 (reports.service)  [parallel to T1.1-T1.3]
         ├─ T1.5 (budget.service)    [parallel to T1.1-T1.4]
         ├─ T1.6 (goal.service)      [parallel to T1.1-T1.5]
         ├─ T1.7 (budget.spec)       [after T1.5]
         └─ T1.8 (goal.spec)         [after T1.6]
         ↓ Phase 1 gate
Phase 2 ─┬─ Backend cluster T2.1–T2.10  [serial; entity drifts -> crashes]
         ├─ Frontend cluster T2.11–T2.29 [serial; component imports drift]
         ↓ Phase 2 gate
Phase 3 ─┬─ Widget reinflation T3.1–T3.3 [frontend only]
         ├─ Routes/i18n T3.4–T3.9         [parallel to widget]
         ├─ Entity/Migration T3.10–T3.22 [backend only, sequential by file]
         ├─ Backend tests T3.23–T3.27    [after T3.10–T3.22]
         └─ Frontend tests T3.28–T3.32   [after T3.1–T3.9 + T3.22]
         ↓ Phase 3 gate (launch readiness)
```

**Critical path:** Phase 2 frontend cluster (the import graph must be unwound without red builds). Phase 3 backend tests must wait for migration completion.

**External dependencies:** Zero — no third-party services affected.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Phase 2 leaves an orphan import (TS2307) | High | Build red mid-phase | Run `pnpm --filter frontend-web lint` after every T2.x frontend task to catch orphans immediately. If TS errors, search the missing symbol and finish the deletion. |
| `savingGoals` relation not properly removed from User entity | Medium | Migration fails (FK target missing) when DB drops `saving_goals` table later | T2.9 explicitly removes the relation. T3.12 verifies again. Do NOT drop the DB table in Phase 3 — defer to a post-MVP cleanup migration. |
| Goal modal has hidden 403 catch the thinker flagged | Medium | Stale `PremiumCard` import = runtime error | T2.27 explicitly searches; if not present, simply drop any premium-related string. |
| i18n line numbers shift between Phase phases | Low | Plan references stale lines | Use `jq` or ripgrep on `t('XYZ')` references at execution time, not source line numbers. |
| Sidebar `user?.isPremium` reference accidentally left | Low | Runtime crash for non-premium user | T2.25 explicitly cleans conditional + props references. After Phase 2, grep for any remaining `isPremium` in `apps/webClient/src/presentation/components/dashboard/sidebar.tsx` should return 0. |
| Migration `ispremium-default-true` not applied before deploy | Low | Existing users stay `isPremium=false` (irrelevant since no code reads it) | Acceptable — code never reads the column. Document the dormant state in `knowledge.md` post-MVP. |
| `RoutePaths.Savings`/`Investments`/`Upgrade` removed but old bookmarks hit 404 | Low | Bad UX for returning users | Acceptable for MVP — the catch-all `<Route path="*">` shows NotFoundPage. Post-MVP, redirect to dashboard home. |

## Rollback Strategy

| Phase | Rollback Point | Procedure |
|-------|---------------|-----------|
| Phase 1 | After T1.x complete, before T2.x | `git revert <phase-1-commits>` — all logic changes are independent of deletions. Backend re-blocks; frontend still gated. No DB impact. |
| Phase 2 | After Phase 2 gate | `git revert <phase-2-commits> && pnpm install`. Large revert; verify no missing files stick around. To restore SavingGoal entity + module + DTOs + UI, the original files are untouched in git history. |
| Phase 3 (pre-migration) | After T3.1–T3.9 (UI only) | `git revert <t3-ui-commits>` — pure rewrites; no DB impact. |
| Phase 3 (post-migration) | After T3.11 `pnpm --filter api migration:run` | Run `pnpm --filter api migration:revert` to undo default-true. Code still works because no reads. User-level `isPremium=false` users remain visually un-impacted because code ignores the field. |

**No irreversible destructive ops in Phase 1–3.** All deletions are git-recoverable; the only forward write to the DB is a column default flip which is trivially reversible.

## Reference

- Research artifact: `rpi/mvp-launch/research.md` (FAR Mean=4.67, PASS)
- Code lines: all `path:LINE` references cited in Research. Affected Files section.
- Project conventions: clean architecture (domain/application/infrastructure/adapters), alias imports, no `any` casts.
- Quality gates: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`.
- Implementation phase documents: `docs/rpi/Implement.md` (execution rules, parallel strategy `[P]` markers).
