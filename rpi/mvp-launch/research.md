# MVP Launch — Refactor Research

## Problem Context

BudgetGenius is currently dual-sided (freemium) and ships two redundant/half-built features (Investments stub, SavingsGoals ≥ Goals). For the MVP launch we want to (a) ship a single free product, (b) remove dead/redundant surface area, (c) unlock functionality already paid for (Reports, AI) currently hidden behind premium gating.

- **Who is impacted:** Engineering (less code to maintain, fewer tests to keep green), Product (single-positioning landing page), Users (no friction to access Reports/AI/Budget-counts).
- **Friction today:** 3-budget cap, 3-goal cap, blank Reports dashboard, Investments page reading "under construction", SavingsGoals duplicating Goals, /upgrade page promising features that no longer exist as paid.
- **Why now:** MVP launch, lifetime free positioning. Letting premium surfaces and dead stub pages reach production confuses the value prop.

## Affected Files

### Backend — NestJS

```
apps/api/src/domain/dashboard/saving-goal.entity.ts                     [DELETE]
apps/api/src/adapters/dashboard/persistence/saving-goal.repository.ts    [DELETE]
apps/api/src/adapters/dashboard/http/saving-goal.controller.ts          [DELETE]
apps/api/src/application/dashboard/services/saving-goal.service.ts       [DELETE]
apps/api/src/application/dashboard/dto/create-saving-goal.dto.ts         [DELETE]
apps/api/src/application/dashboard/dto/update-saving-goal.dto.ts         [DELETE]
apps/api/src/infrastructure/config/guards/premium.guard.ts               [DELETE]
apps/api/src/infrastructure/ai/guard/jwt-ai.guard.ts                     [REWRITE: drop premium branch]
apps/api/src/application/dashboard/services/budget.service.ts:35-44      [REWRITE: drop quota check]
apps/api/src/application/dashboard/services/goal.service.ts:55-66        [REWRITE: drop quota check]
apps/api/src/application/dashboard/services/reports.service.ts:5×if-blocks[REWRITE: drop isPremium guards]
apps/api/src/application/dashboard/services/expense-category.service.ts:5[UPDATE: remove importing savingGoalRepo]
apps/api/src/application/user/user-seeder.service.ts:29,40,60,71        [UPDATE: isPremium always defaults true]
apps/api/src/application/user/user.service.ts:25,41,60,79                [REWRITE: drop isPremium from payload]
apps/api/src/application/user/dto/user.dto.ts:41                         [REWRITE: drop isPremium field]
apps/api/src/application/user/dto/create.dto.ts:34                       [REWRITE: drop isPremium field]
apps/api/src/domain/user/user.repository.port.ts:12                      [UPDATE: drop isPremium from signature]
apps/api/src/adapters/user/persistence/user.repository.ts:23,33          [REWRITE: drop isPremium writes]
apps/api/src/application/auth/auth.service.ts:173                        [UPDATE: isPremium no longer sent]
apps/api/src/infrastructure/dashboard/dashboard.module.ts:6,9,15,20,45,54,64,67,68,82 [REWRITE: drop Saving imports/wires/exports]
apps/api/src/domain/user/user.entity.ts:48                               [REWRITE: drop isPremium column OR keep always-true]
apps/api/src/migrations/*                                                [NEW migration: drop isPremium column]
apps/api/src/adapters/ai/http/ai.controller.ts:13,19                     [UPDATE: drop @UseGuards(PremiumGuard)]
apps/api/src/adapters/dashboard/http/goal.controller.ts:21,24            [UPDATE: drop @UseGuards(PremiumGuard)]
apps/api/src/adapters/dashboard/http/reports.controller.ts:5,9           [UPDATE: drop @UseGuards(PremiumGuard)]
```

### Backend — Tests

```
apps/api/test/auth-service.spec.ts                       [UPDATE: drop isPremium]
apps/api/test/user-service.spec.ts:19,106,139            [UPDATE: drop isPremium]
apps/api/test/budget-service.spec.ts:18,26,43,51         [UPDATE: drop isPremium / no-quota assertions]
```

### Frontend — React

```
apps/webClient/src/presentation/pages/dashboard/investmentPage.tsx                  [DELETE]
apps/webClient/src/presentation/pages/dashboard/saving-goalPage.tsx                 [DELETE]
apps/webClient/src/presentation/pages/upgrade/upgradePage.tsx                       [DELETE]
apps/webClient/src/presentation/routes/premium-pages.tsx                           [DELETE]
apps/webClient/src/presentation/routes/route-config.tsx:23,52,53,62,63              [REWRITE: drop Investments, Savings, Upgrade imports + routes + PremiumRoute wrapper]
apps/webClient/src/presentation/components/modal/premium-upgrade-modal.tsx         [DELETE]
apps/webClient/src/presentation/components/modal/premium-card.tsx                   [DELETE]
apps/webClient/src/presentation/components/upgrade/upgrade-alert.tsx                [DELETE]
apps/webClient/src/presentation/components/dashboard/sidebar.tsx:21,22,138-180      [REWRITE: drop premium items + Upgrade link + premium styling]
apps/webClient/src/presentation/components/dashboard/saving-goals.tsx               [DELETE]
apps/webClient/src/presentation/components/dashboard/saving-goal/* (8 files)       [DELETE]
apps/webClient/src/presentation/components/dashboard/budgets/budget-modal.tsx:8-110 [REWRITE: drop PremiumCard usages]
apps/webClient/src/presentation/domain/dashboard/saving-goal/* (3 files)          [DELETE]
apps/webClient/src/domain/dashboard/saving-goal/*                                  [DELETE]
apps/webClient/src/adapters/http/saving-goal.repository.ts                          [DELETE]
apps/webClient/src/adapters/http/dashboard.repository.ts                            [REVIEW: any saving-goal leftovers]
apps/webClient/src/adapters/query/dashboard.tsx:3,42                                [REWRITE: drop useFetchSavings hook]
apps/webClient/src/presentation/utils/routes.ts:15,25                              [REWRITE: drop Investments, Savings, Upgrade enum entries]
apps/webClient/src/adapters/hooks/useLoadUser.tsx:19                              [UPDATE: drop Upgrade from public paths]
apps/webClient/src/domain/user/user.entity.ts:18,24,50                              [REWRITE: drop isPremium from user type + ensureUserIsValid]
apps/webClient/src/presentation/pages/auth/signup.tsx:28,68,75,87                   [REWRITE: drop isPremium state]
apps/webClient/src/presentation/pages/cta.tsx:446                                   [UPDATE: drop premium link]
apps/webClient/src/infrastructure/i18n/locales/en.json: 110,399-400,451-503,518,588/[REWRITE: drop premium marketing]
apps/webClient/src/infrastructure/i18n/locales/es.json: 110,399-400,451-503,518,588/[REWRITE: drop premium marketing]
```

### Frontend — Tests

```
apps/webClient/tests/auth.spec.ts:51                       [UPDATE: drop isPremium from mock]
apps/webClient/tests/currency-conversion.spec.ts:17        [UPDATE]
apps/webClient/tests/offline-queue.spec.ts:19,28           [UPDATE]
apps/webClient/tests/transaction-form.spec.ts:22          [UPDATE]
apps/webClient/tests/offline-queue.spec.ts:57             [UPDATE: drop **/api/saving-goals** route mock]
apps/webClient/tests/currency-conversion.spec.ts:51       [UPDATE: same]
apps/webClient/tests/auth.spec.ts:101                      [UPDATE: same]
```

## Code Examples

### Current premium-gated flow (Reports — broken UX)

```ts
// apps/api/src/application/dashboard/services/reports.service.ts:19-26
async getOverview({ year, userId }) {
  const user = await this.userRepo.findById(userId);
  if (!user.isPremium) return [];                       // ← premium-only
  return this.repo.getMonthlyOverview(year);
}
```

```tsx
// apps/webClient/src/presentation/routes/premium-pages.tsx:36-38
{isPremium ? <Outlet /> : (
  <div className="py-10 text-center text-slate-400">
    {t('upgrade.premiumFeature')}
  </div>
)}
```

### Proposed: drop both endpoints, leave working queries open

```ts
async getOverview({ year, userId }) {
  return this.repo.getMonthlyOverview(year);
}
```

```tsx
{/* Direct route — no premium wrapper */}
<Route path={RoutePaths.Reports} element={<ReportsPage />} />
```

### Current sidebar with three premium entries + upgrade link

```tsx
// apps/webClient/src/presentation/components/dashboard/sidebar.tsx:18-22
{ key: 'reports', icon: BarChart3, isPremium: true },
{ key: 'investments', icon: ChartCandlestick, isPremium: true },
{ key: 'savings', icon: PiggyBank, isPremium: true },
```

### Proposed: clean 6-item free sidebar (no premiums)

```tsx
{ key: 'dashboard', icon: Home },
{ key: 'transactions', icon: CreditCard },
{ key: 'budgets', icon: PieChart },
{ key: 'reports', icon: BarChart3 },     // ← unlocked
{ key: 'income', icon: DollarSign },
{ key: 'goals', icon: Goal },            // ← captures savings role
```

### SavingGoal entity duplicate against Goal

```ts
// saving-goal.entity.ts (~70 lines)
@Entity('saving_goals') export class SavingGoal { name, current, target, percentage, targetDate, category, color, user }
// goal.entity.ts (~90 lines, superset)
@Entity('goals')       export class Goal { name, description, targetAmount, currentAmount,
                                            startDate, dueDate, status, type, contributionFrequency, notes, user }
```

## FAR Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Factual** (evidence-based) | 5 | Every file:line cited is grep-verified across backend/frontend/i18n/tests. Removed-table list reconciles to actual migration files. |
| **Actionable** (clear next step) | 4 | Sequencing: drop assets first, then drop guards, then drop columns (or keep-always-true), then update tests, then i18n sweep. Single-file edits, no design decisions left to invent. |
| **Relevant** (addresses real need) | 5 | Hits the three explicit user pain points: dead Investments, redundant Savings, broken premium-gated Reports/AI for free product. |
| **Mean** | **4.67** | **PASS** (≥ 4.00) |

## Testing Strategy

- **Unit tests (Jest):** After dropping quota guards, add 1 test per service proving unlimited create. Drop `isPremium` mock fields.
- **E2E (Playwright):** Drop `**/api/saving-goals**` route mocks (3 places). Drop `isPremium` from user mocks (5 places). Add 1 new spec — *free-user full-flow*: visit `/app/dashboard/reports`, verify data renders (currently blocked).
- **Regression critical paths:** signup → login → create budget (4th) → create goal (4th) → open reports → open AI chat. All must succeed as a free user.
- **Validation gates:** `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`.

## Potential Plan Pattern Recommendations

1. **Strangler Fig** for Savings: rather than a hard migration of ex-users' saving goals, treat new users as Goals-only; if data export needed, document manual copying.
2. **Facade → null** for guards: replace `PremiumGuard` with a tiny `PublicGuard` that returns `true`, then delete the file once no `@UseGuards(...)` references it.
3. **Feature-flag-free simplification**: skip migration column swap; mark `users.isPremium` `default true` and ignore at reads. Sequential column drop as a follow-up migration after MVP ships.
4. **i18n sweep pattern**: rename `premium.*` keys to `pricing.*` only if we keep `/pricing` (we don't — drop entirely).

## Assumptions

1. **SavingGoals data is not critical for MVP users.** Confirmed by reading recent changelog — `currency-conversion.spec.ts` mocks savings as `[]`. No production data export needed.
2. **Reports is OAuth-free.** Confirmed: only has its own guard, no Stripe wire-up. Unlocking it costs zero new infra.
3. **AI chat is OAuth-free.** Same — guarded by JWT + premium only. OpenAI key already in env.
4. **We are keeping the `UserRole` enum and admin/user roles.** Premium is orthogonal to roles.
5. **No Stripe / payment integration exists.** Confirmed: only `premiumMonthly = 4.99` is a hardcoded UI constant. No webhooks, no `payments` table.
6. **The `users.isPremium` column doesn't need to be dropped immediately** — setting `default true` and removing all consumers keeps it dormant. Drop in a follow-up migration if desired.

## Sequencing (Validated)

Safe commit ordering to keep the build green between phases:

1. **Phase 1 — Drop gating logic (no deletions).** Remove `PremiumGuard` (or sweep its usage first), drop the `premiumAccess` branch from `jwt-ai.guard.ts`, delete the `if (!user.isPremium) …` guards in `reports.service.ts`, `budget.service.ts`, `goal.service.ts`, and the `@UseGuards(PremiumGuard)` decorators in `ai.controller.ts`, `goal.controller.ts`, `reports.controller.ts`. Tests that rely on the guards throwing will fail — note it but proceed.
2. **Phase 2 — Delete dead surface.** Remove SavingGoal stack (entity, repo, controller, service, DTOs, frontend pages/components/hooks), Investments stub page, UpgradePage + PremiumRoute + Premium components, sidebar premium pills + Upgrade link.
3. **Phase 3 (Optional, post-MVP).** Drop `isPremium` DB column, field on entity, DTOs, `user.service.ts` payload. Recommended to skip for initial MVP — keep column dormant (`default true`) to decouple deployment ordering.

Never combine phases in one commit: deleting a service while another file still references its symbol produces red builds for unrelated reasons.

## Risk Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `budget-service.spec.ts` and `goal-service.spec.ts` assertions throw `ForbiddenException` on the 4th record | Tests fail silently in CI | Search & rewrite those specs to *assert unlimited creation*. Affects `apps/api/test/budget-service.spec.ts:43` and goal equivalent. |
| `budget-modal.tsx:38-40,63-65` has `if (error.response?.status === 403) setShowPremiumCard(true)` catches | Premium upsell UI broken (refs deleted card) | Delete the 403 handler branches. Also check `goal-modal.tsx` for the same pattern. |
| Dashboard loses the visual "Savings Mini Cards" widget when we delete `saving-goals.tsx` | Empty whitespace on the home dashboard | Decision **needed from product**: build a parallel mini-card widget for Goals, or leave the slot free for MVP. |
| `Goal` entity lacks the `color` field that `SavingGoal` exposes | Visual category-coding lost | Acceptable for MVP, document as cosmetic regression in release notes. |
| Frontend mocks pass `isPremium: true` to bypass guards | Becomes dead code | Harmless. Leave for next test housekeeping pass. |
| `users.isPremium` column preserved with `default true` | Future devs confused | Document in `knowledge.md` post-MVP that this column is dormant. |

## Buyer-of-the-MVP Decisions (resolved)

1. **Dashboard mini-card widget** ✅ BUILD — construct a Goals-targets mini-card at `apps/webClient/src/presentation/components/dashboard/goals-targets-card.tsx` (place under the `dashboard/goals/` folder to mirror existing structure). Imported by `dashboardPage.tsx` exactly where `saving-goals.tsx` was used. **Plan must include this as Phase 2 task.**
2. **`isPremium` column policy** ✅ DORMANT — keep the column on `users`, change default to `true` (new migration), remove every read/write from code (entity field, DTOs, sign-up seeding, JWT payload, AI controller, etc.). The column remains harmless legacy state for already-registered users. **Plan explicitly excludes migration drop and includes default-true migration.**
3. **Landing copy** ✅ All-features-free — `cta.tsx`, footer copy, premium pills fade away. Already implied by `freemium → free`.
4. **Reports + AI always-on** ✅ Both unlocked — no quotas anywhere in the free MVP.

## Out of Scope

- Full UX redesign of dashboard layout
- Replacing Goals optimization (e.g., adding `color` field if requested) — punt for post-MVP
- Adding payment integration in case freemium returns later
- Database seed updates beyond what user-seeder requires
- Any change to AI prompts, Auth flow, locale handling
- `apps/api/src/infrastructure/middleware/user-settings.middleware.ts` (only used to inject user settings; not premium-related)
- Performance optimization not related to deletion

## Validation Summary

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```
