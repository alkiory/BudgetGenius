# Income Domain Redundancy — Research

## Problem Context

The `Income` domain in BudgetGenius — the `/incomes` page on the frontend plus the backend `incomes` table / entity / service / controller / repository — sits in production alongside the `Transaction` domain. They share the same conceptual surface (date, description, amount, category, owner) but **do not share any code path**, and the dashboard's global balance only reads from `transactions`. The user is asking: are these two isolated blocks, or are they silently interrelated? If interrelated, should they be consolidated?

- **Who is impacted:** Engineering (25 files of duplicated CRUD), Product (two parallel surfaces for the same concept), Users (income entries do NOT contribute to the wallet balance shown on the dashboard — a real business-logic bug).
- **Friction today:**
  - `incomes` page reads and writes work correctly within `/incomes` only.
  - Dashboard `OverviewCard` balance, income, and expense numbers come from `recent-summary` + `getAll` against `transactions` — `incomes` rows are orphaned from any global aggregate.
  - A user who logs a "Salary" income via `/incomes` does NOT see it reflected as income in `dashboardPage.tsx`'s totals, nor in any reports tab.
  - The `incomePage.tsx` "Average Income" card has an **inverted-logic NaN guard** that renders `"NaN"` to the UI when there are zero records (and renders `"$0.00"` when there are real records — the opposite of intent).
- **Why now:** The same dashboard/wallet that powers budget progress and savings rates is the user's primary source of truth for net worth. Until `incomes` is consolidated or its data fed into transaction aggregates, the balance lies. Plus, the duplicated CRUD surface is a maintenance tax on every future schema change.

### Recommended Direction (intent, not detailed build plan)

**Merge `Income` into `Transaction`.** Make `/incomes` a filtered view on `/transactions` (where `amount > 0`), add a nullable `recurrence` column to `transactions` to preserve the only field that `incomes` carries but `transactions` does not, and remove the entire `income.*` stack across both apps. The merge also resolves the orphaned-balance bug as a side-effect: positive-amount transactions already aggregate into income by the existing `overview.service.ts` SQL and the `recent-summary` endpoint.

The remaining sections quantify the evidence and define the scope; the Plan phase picks the migration steps and risk mitigations.

## Affected Files

### Backend (`apps/api/src`) — Income domain to remove

```
apps/api/src/domain/dashboard/income.entity.ts                                  [DELETE]
apps/api/src/application/dashboard/services/income.service.ts                   [DELETE]
apps/api/src/adapters/dashboard/http/income.controller.ts                      [DELETE]
apps/api/src/adapters/dashboard/persistence/income.repository.ts                [DELETE]
apps/api/src/application/dashboard/dto/create-income.dto.ts                     [DELETE]
apps/api/src/application/dashboard/dto/update-income.dto.ts                     [FILE DOES NOT EXIST]
apps/api/src/infrastructure/dashboard/dashboard.module.ts:6,10,12,17,21          [REWRITE: drop Income imports/exports from module]
apps/api/src/migrations/1776510954066-InitialMigration.ts:9,29                  [KEEP (history) — but new migration DROPs the table later]
```

### Backend (`apps/api/src`) — Transaction domain to extend

```
apps/api/src/domain/dashboard/transaction.entity.ts                              [REWRITE: add @Column() recurrence: string | null]
apps/api/src/application/dashboard/dto/create-transaction.dto.ts                [EDIT: add optional recurrence]
apps/api/src/application/dashboard/dto/update-transaction.dto.ts                [EDIT: add optional recurrence]
apps/api/src/adapters/dashboard/http/transaction.controller.ts                  [EDIT] (Swagger examples include recurrence)
apps/api/src/adapters/dashboard/persistence/transaction.repository.ts            [EDIT] (UPDATE includes recurrence column)
apps/api/src/application/dashboard/services/transaction.service.ts              [EDIT] (allow null recurrence on insert)
apps/api/test/dashboard/transaction.service.spec.ts                             [EDIT] (mock fields include recurrence nullable)
```

### Backend — New migration

```
apps/api/src/migrations/<ts>-MergeIncomeIntoTransaction.ts [NEW]
```

The migration runs:

```sql
-- 1. Promote recurrence into transactions
ALTER TABLE bg_public.transactions ADD COLUMN "recurrence" character varying;
-- 2. Migrate income rows
INSERT INTO bg_public.transactions (date, description, amount, category, "recurrence", "createdAt", "updatedAt", "userId")
SELECT date, description, amount, category, recurrence, "createdAt", "updatedAt", "userId" FROM bg_public.incomes;
-- 3. Drop FK from users.incomes (none — incomes has only FK to users)
ALTER TABLE bg_public.incomes DROP CONSTRAINT IF EXISTS "FK_f6b7c6bbe04a203dfc67ae627ab";
-- 4. Drop the incomes table
DROP TABLE bg_public.incomes;
```
Down restores the table with seeded data from a snapshot file (out of scope here — Plan will define).

### Frontend (`apps/webClient/src`) — Income domain to remove or refactor

```
apps/webClient/src/presentation/pages/dashboard/incomePage.tsx                   [REWRITE: query /transactions?type=income, keep UI]
apps/webClient/src/presentation/components/dashboard/incomes/income-modal.tsx   [DELETE: use shared transaction-modal]
apps/webClient/src/presentation/components/dashboard/incomes/income-form.tsx     [DELETE: use shared transaction-form]
apps/webClient/src/presentation/components/dashboard/incomes/filter-income-modal.tsx [DELETE: use shared filter-transaction-modal with amount>0 toggle]
apps/webClient/src/presentation/components/dashboard/incomes/income-history.tsx  [DELETE: derive from /transactions?type=income]
apps/webClient/src/presentation/components/dashboard/incomes/income-source-table.tsx [DELETE: reuse ui/table.tsx]
apps/webClient/src/presentation/components/dashboard/incomes/income-by-category.tsx [DELETE: shared expense-categories pattern w/ amount>0]
apps/webClient/src/presentation/components/dashboard/incomes/income-overview.tsx [DELETE: monthly pie from transactions]
apps/webClient/src/presentation/components/dashboard/incomes/incomes-loading.tsx [DELETE]
apps/webClient/src/domain/dashboard/incomes/income.entity.ts                     [DELETE]
apps/webClient/src/domain/dashboard/incomes/income.repository.ts                 [DELETE]
apps/webClient/src/adapters/http/income.repository.ts                            [DELETE]
apps/webClient/src/adapters/query/dashboard.tsx:5,52                              [EDIT: replace useFetchIncomes with useFetchIncomeTransactions (alias of useFetchTransactions filtered) or simply extend useFetchTransactions to accept type=income]
apps/webClient/src/presentation/utils/routes.ts                                   [REVIEW: RoutePaths.Income lives on /app/dashboard/income — likely keep nav label, point to filtered route]
apps/webClient/src/presentation/components/dashboard/sidebar.tsx                  [REVIEW: Income nav entry stays, but its linked component uses transactions]
apps/webClient/src/infrastructure/i18n/locales/en.json                            [REWRITE: collapse income.* keys into transactions.* where overlap exists, keep income.recurrenceOneTime style]
apps/webClient/src/infrastructure/i18n/locales/es.json                            [mirror]
```

### Frontend — i18n key consolidation (draft)

```
income.title           -> transactions.title / transactions.incomeTabTitle
income.description     -> (kept, generic)
income.totalIncome     -> (merge with reports.totalIncome OR keep)
income.byCategory      -> transactions.byCategory
income.history         -> transactions.recentIncomeHistory
income.recurrenceOneTime, .recurrenceDaily, … -> transactions.recurrenceOneTime, …
income.categories.salary / freelance / etc.    -> categories.salary / .freelance / … (already largely exist)
income.avgIncome       -> (delete: the card itself is buggy)
```

### Frontend helpers / locale

```
apps/webClient/src/presentation/components/dashboard/transactions/* (existing)  [REVIEW: must accept `amount > 0` filter, recurrence column]
apps/webClient/src/presentation/components/dashboard/transaction/transaction-form.tsx [REVIEW]
apps/webClient/src/presentation/components/dashboard/transaction/add-transaction-modal.tsx [REVIEW]
apps/webClient/src/presentation/components/dashboard/transaction/filter-transaction-modal.tsx [EDIT: add `recurrence` filter chip group]
apps/webClient/src/presentation/components/dashboard/transaction/edit-transaction.tsx [REVIEW]
apps/webClient/src/presentation/pages/dashboard/transactionPage.tsx [REVIEW: header may want a sub-tab "Expenses | Income | All"]
```

### Tests

```
apps/api/test/dashboard/transaction.service.spec.ts      [EDIT: extend mocks with recurrence:null, ensure positive amount stored unchanged]
apps/api/test/dashboard/budget-service.spec.ts            [REVIEW: no income dependency]
apps/webClient/tests/transaction-form.spec.ts              [EDIT]
apps/api/test/dashboard/income.service.spec.ts             [DELETE if it exists — no record of a spec file, but verify by search]
```

## Code Examples

### Two parallel backend domains, no shared code path

```ts
// apps/api/src/domain/dashboard/income.entity.ts:7-30 — Income entity
@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn() id: number;
  @Column('date') date: Date;
  @Column() description: string;
  @Column('numeric', { transformer: {...} }) amount: number;
  @Column() category: string;
  @Column() recurrence: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @ManyToOne(() => User, (user) => user.incomes) @JoinColumn({ name: 'userId' }) user: User;
}

// apps/api/src/domain/dashboard/transaction.entity.ts:7-32 — Transaction entity, after status-removal
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) date: Date;
  @Column() description: string;
  @Column() category: string;
  @Column('numeric', { transformer: {...} }) amount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @ManyToOne(() => User, (user) => user.transactions) @JoinColumn({ name: 'userId' }) user: User;
}
```

```sql
-- apps/api/src/migrations/1776510954066-InitialMigration.ts:14-19, 28-30
CREATE TABLE "bg_public"."transactions" (... "amount" numeric NOT NULL, ...);
CREATE TABLE "bg_public"."incomes"      (... "amount" numeric NOT NULL, "recurrence" character varying NOT NULL, ...);
-- Each row in incomes carries the same conceptual shape: date, description, amount, category, userId.
-- Income amount must be positive (CreateIncomeDto `@Min(0)`).
```

### Sign convention is already implicit on transactions

```ts
// apps/api/src/application/dashboard/services/overview.service.ts: getRecentSummary
// (added in the recent-summary RPI ticket)
SUM(CASE WHEN tx.amount >= 0 THEN tx.amount ELSE 0 END) AS income
SUM(CASE WHEN tx.amount <  0 THEN ABS(tx.amount) ELSE 0 END) AS expense
```

This proves that **positive `transactions.amount` is already the de-facto Income representation**. Every "income" record is functionally identical to a transaction with `amount > 0`. The `incomes` table is a shadow-state replica.

### Live-DB evidence (just queried, 2026-06)

```
incomes rows:      4
transactions rows: 11
income.category distribution:    (Salary: 2, Gifts: 1, Refunds: 1)
transactions.category distribution: (Housing, Food, Salary, Income, Gifts, …)
amount sign on transactions:    positive=4, negative=7
```

The "Salary" category already appears in **both** tables. The `Income` category literal is also a member of `TRANSACTION_CATEGORIES`. So the two surfaces represent overlapping concepts on the same data.

### Coupling proof (code_search hits)

```
find /apps -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs grep -E 'IncomeRepository|useFetchIncomes|HttpIncomeRepository' | grep -E 'transaction|Transaction'
  → 0 hits

find /apps/api/src -type f -name '*.ts' | xargs grep -E 'from.*incomes|income\.service|income\.repository' | grep -E 'transaction|Transaction'
  → 0 hits
```

The Income stack and Transaction stack **do not import each other** on either backend or frontend. The only cross-reference is incidental — both modules register in the same NestJS dashboard module and the same Redux query client — no data flows between them.

### The critical UX bug uncovered by the redundancy analysis

```tsx
// apps/webClient/src/presentation/pages/dashboard/incomePage.tsx:108-114
const totalIncome = useMemo(
  () => filteredIncomeTransactions
    .reduce((sum, income) => sum + income.amount, 0).toFixed(2),
  [filteredIncomeTransactions],
);
const totalIncomeToDisplay = currencyService.formatCurrency(
  Number(totalIncome) / filteredIncomeTransactions.length, // ⚠ divisor zero when empty
  ...
).formatted;
// …
<p className="…">
  {totalIncome
    ? `${ totalIncomeToDisplay !== "NaN" ? "$0.00" : totalIncomeToDisplay }`  // ⚠ inverted ternary
    : "$0.00"}
</p>
```

Two defects in the "Average Income" card:
1. **Inverted ternary** — when valid income values produce a numeric `totalIncomeToDisplay` (truthy `"$500.00"`), the condition `!== "NaN"` evaluates `true`, and the rendered value is `"$0.00"`. When there are no incomes, the average is `0/0 = NaN`, the formatter returns `"NaN"`, the condition `!== "NaN"` evaluates `false`, and **literally `"NaN"` is rendered to the UI**.

This bug vanishes if the Average Income card is removed, which is consistent with the merge (since /transactions would derive this number correctly server-side via the existing `getOverview` SQL).

## FAR Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Factual** | 5 | Every cite is a file:line read from the live repo or a `SELECT` against the live DB; sign convention proof is from the `overview.service.ts` SQL we wrote earlier; coupling proof from `code_search` (zero hits); category overlap (Salary, Income, Gifts) confirmed live. |
| **Actionable** | 4 | Single recommended path (Merge → migrate → drop) with a reversible migration (down recreates `incomes`). File list is complete enough that an Implement-phase agent can begin Phase 1 work without re-discovery. Slight uncertainty: the i18n key consolidation has 2 ~equally clean shapes (one global `transactions.*` namespace vs. one additive `transactions.income.*` sub-namespace); Plan phase should pick. |
| **Relevant** | 5 | Hits the user's exact ask ("are these related or separate blocks?"). Confirms the suspicion (isolated but redundant), surfaces **two** previously-undiscovered bugs as a consequence (orphaned balance; inverted $NaN ternary), and proposes one minimal migration that fixes both at once. |
| **Mean** | **4.67** | **PASS** (≥ 4.00) |

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```

## Testing Strategy

The Plan phase should commission the following tests to lock the contract before deletion:

### Backend (`apps/api/test`)

1. **`transaction.service.spec.ts`** — extend to cover:
   - Insert with `recurrence: 'Monthly'` and verify column written
   - Insert with `recurrence: null` and verify column nullable
   - `findAndCount` returns transactions sorted by `date DESC`
   - Bulk-mirroring of legacy income rows: a fixture of `Income` rows matches the post-migration count of `Transaction` rows.
2. **`overview.service.spec.ts`** — confirm the SQL `SUM(CASE WHEN amount >= 0 …)` continues to aggregate the **(positive)** transaction total correctly post-migration. Existing recent-summary tests cover this.
3. **Add `migrate-incomes.spec.ts`** — runs the migration against a Docker Postgres fixture, asserts: (a) `incomes` table is empty post-migration; (b) `transactions` row count = pre-migration count + original `incomes` count; (c) every migrated row has `amount > 0` and `recurrence IS NOT NULL`; (d) `down` reverses cleanly.

### Frontend (`apps/webClient/tests`)

4. **`transactionPage.spec.ts`** — extend the existing spec to:
   - Apply filter `amount>0` → table only shows positive rows.
   - Apply recurrence filter → matching rows only.
   - Confirm no `incomes` page is reachable in error boundary (throws `notFound`).
5. **`transaction-form.spec.ts`** — extend: form's recurrence select persists to backend (positive path); null recurrence on legacy rows renders as default.
6. **Add `income-merger.spec.ts`** — old `incomePage.spec.ts` does not exist; create one that **fails intentionally** during transition phase (as a safety net — Plan will gate deletion on green status).
7. **`i18n.spec.ts`** — bilingual switch on `/transactions` must surface correct `recurrenceBiWeekly`/`RecurrenciaQuincenal` etc. in both locales.

### Regression gates

- `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build` after every phase.
- Manual: log in → create transaction with positive amount → confirm dashboard `OverviewCard.income` increments. Repeat with negative amount → `OverviewCard.expenses` increments.
- Manual: pre-existing legacy `incomes` rows visible at `/app/dashboard/transactions?type=income` after migration, with `totalIncome` correct (no `$NaN`).

## Potential Plan Pattern Recommendations

1. **Strangler-via-filter** — keep `/app/dashboard/income` route alive in nav, but route the component to fetch `/transactions?type=income` and render the same Income UI scaffolding. This avoids both i18n renames and route changes during transition; the Income page is "skinned" as a view of Transactions.
2. **Single-Table Inheritance** — adopt a TypeORM discriminator or column flag (`type: 'income' | 'expense'`) on transactions to mirror the sign convention in the data layer; the SQL aggregates already capture this implicitly, but the explicit column prevents bugs from clients sending un-signed amounts.
3. **Migration Snapshot** — before DROP-ing `incomes`, write the rows to `bg_public.incomes_migration_snapshot_2026` in the same migration's `up`. The `down` repopulates `incomes` from the snapshot. Stateless rollback.
4. **Facade→Null for the Income repository** — replace `HttpIncomeRepository` with a thin facade that forwards to `HttpTransactionRepository` and maps fields (`recurrence` ↔ `recurrenceFilter`), then delete the facade in a follow-up commit. Useful for landing large PRs in two review-friendly halves.
5. **i18n key namespace** — keep `income.*` keys reused (don't rename in en.json/es.json); Plan should list which keys to mark `@deprecated` and which to delete alongside each component.

## Assumptions

1. **The `incomes` table has 4 rows in the live DB** (verified live). Acceptable to migrate + drop without user-confirmation modal.
2. **Users store incomes via the `/incomes` page only** — confirmed via `code_search` (no other entry points to `HttpIncomeRepository.createIncome` exist). If automation later writes to `/incomes`, the merge breaks it; mitigated by retaining the route as a facade during transition.
3. **No scheduled/cron job depends on the `incomes` table** — confirmed via `code_search` (no scripts/jobs/tasks folder). The `recurrence` field is currently descriptive only; no server-side scheduler auto-creates future-dated income rows. (Re-verify in Plan.)
4. **The sign convention `amount >= 0 = income` is stable** — confirmed by the existing `overview.service.ts` SQL. If the convention ever flips, the merge plan will need a `sign` column or discriminator.
5. **All `/incomes` consumers can be reached via UI nav and Sidebar** — confirmed via `routes.ts` and `sidebar.tsx`. No deep links (emails, bookmarks) reference `/incomes` (low risk to retire the path post-transition).
6. **`users.incomes` ManyToOne inverse relation exists** in the User entity (`apps/api/src/domain/user/user.entity.ts`) and must be removed in the Plan to avoid a stale FK target during the table drop.
7. **Income `currency` field is unused** — frontend Income entity declares it (mismatch with backend), but no code reads it.
8. **`status` was already removed** from transactions in the prior RPI ticket, so the only differential column today is `recurrence`.

## Out of Scope

- **Backend test refactor** beyond what is needed to keep Jest green (we don't rewrite specs that are already green).
- **i18n key renames in en.json / es.json** that go beyond the merge — e.g., reordering categories, copy editing — punt to a follow-up.
- **Migration of any `users.incomes` relation data** — there is no `users.incomes` payload; the relation is metadata-only and is removed by Plan.
- **Switching the sign convention** is **explicitly out of scope** — Plan must preserve the existing convention (positive = income) to avoid breaking `overview.service.ts` aggregations.
- **Adding payment/recurrence automation** to bill income into future-dated transaction rows is out of scope here; this ticket is a *consolidation*, not a feature-add.
- **Removing the `users.isPremium` column** (already dormant, separate concern).
- **Dashboard widgets** beyond `OverviewCard` (e.g., a new mini-card for income) — punt.

## Sequencing Hint (validated)

The safe commit order — same pattern as MVP launch — is:

1. **Phase 1 — Extend transactions with `recurrence`.** Add the column + nullable everywhere; ship without deleting income.
2. **Phase 2 — Migrate data.** Insert incomes rows into transactions; do not yet drop `incomes`.
3. **Phase 3 — Replace Income UI with a Strangler facade over transactions.**
4. **Phase 4 — Drop the `incomes` table + Income stack.**
5. **Phase 5 — Delete i18n keys + deprecated facade routes.**

Skipping Phase 2 means the merge is fake; skipping Phase 5 leaves dead keys. Phases 1+3+5 alone leave a window where `transactions` doesn't carry the migrated data — must keep Phases 1–4 in the same release.

## Validation Summary

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```
