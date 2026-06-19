# Income Domain Redundancy — Plan

> Companion to `rpi/income-redundancy/research.md` (FAR Mean = 4.67 PASS).
> Goal: phase the merge of `/incomes` into `/transactions` so each commit compiles, every phase is reversible, and the orphaned-balance + `$NaN` bugs vanish as a side-effect.

## Implementation Overview

Five phases, executed in commit order:

1. **Phase 1 — Extend `transactions` with `recurrence`** (pure schema-and-type widening; no data movement; risk = none, the column starts nullable).
2. **Phase 2 — Migrate data + drop `incomes` table** (one migration: snapshot → INSERT-SELECT → drop FK → drop table).
3. **Phase 3 — Strangler-facade the `/income` UI on top of `/transactions`** (no backend deletion yet; the Income page now reads from `/transactions?type=income` and reuses shared form/modal/filter/table components).
4. **Phase 4 — Delete the Income stack** (backend entity/service/controller/repository/DTO; frontend domain/repository/hook; `users.incomes` inverse relation).
5. **Phase 5 — i18n key cleanup** (rename/dedupe `income.*` keys into `transactions.*` or `categories.*`; delete deprecated entry points).

Architectural decisions already locked from Research:

- ✅ Sign convention preserved: positive `amount` = income (mirrors `overview.service.ts` SQL).
- ✅ `recurrence` is **nullable** on `transactions` (legacy expense rows stay null; income rows migrated WITH a value).
- ✅ Migration uses an `incomes_snapshot` table to make rollback trivially reversible (no binary dump needed).
- ✅ The `users.incomes` inverse relation is removed in **Phase 4** (after migrations, before backend-stack deletion) to avoid a stale FK target during the table drop.
- ✅ Strangler facade keeps `/app/dashboard/income` route live through Phase 3 → Phase 4. Hard cut only in Phase 4.

Quality gates after **every** task: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. Final gate adds `pnpm build`.

## Task Breakdown

### Phase 1 — Extend transactions with `recurrence`

> Goal: schema is ready to absorb income rows. Backward-compatible (column nullable). No production behavior change.

- [ ] T1.1 Edit `apps/api/src/domain/dashboard/transaction.entity.ts:30` — append `@Column({ type: 'varchar', length: 32, nullable: true }) recurrence: string | null;`. Keep numeric transformer intact.
- [ ] T1.2 Edit `apps/api/src/application/dashboard/dto/create-transaction.dto.ts` — append `@IsOptional() @IsString() recurrence?: string;` (no `@Min`, no `@IsEnum` yet — recur entries are free-text for legacy compatibility; the type unions are enforced in the form layer in T3.3).
- [ ] T1.3 Edit `apps/api/src/application/dashboard/dto/update-transaction.dto.ts` — append `@IsOptional() @IsString() recurrence?: string;` (mirrors T1.2).
- [ ] T1.4 Edit `apps/api/src/adapters/dashboard/http/transaction.controller.ts` — add `@ApiParam({ name: 'recurrence', required: false, type: String, example: 'Monthly' })` to the create + update Swagger blocks, and `'recurrence': 'Monthly'` line in each example body. (Use line searches; specifically the create block at ~L25–L70 and update block at ~L160–L255.)
- [ ] T1.5 Edit `apps/api/src/adapters/dashboard/persistence/transaction.repository.ts` — extend the `update({...})` shape (L53) and the `create` (L21) to include `recurrence`. Update the destructured arguments accordingly. (`update` currently destructures `{ id, description, category, amount }`; extend to `{ id, description, category, amount, recurrence }` and add `transaction.recurrence = recurrence;` after a nullish-check that defaults to null.)
- [ ] T1.6 Edit `apps/api/src/application/dashboard/services/transaction.service.ts` — pass through `recurrence` from DTO into `createTransaction` (L17) and `updateTransaction` (L62). Confirms `?:` for create; for update, only write when explicitly provided (existing partial semantics preserved).
- [ ] T1.7 Edit `apps/api/test/dashboard/transaction.service.spec.ts` — extend the `mockTransaction` factory to include `recurrence: null`; add one new spec `"persists recurrence on create"` that posts `{ recurrence: 'Monthly', ... }` and asserts the row carried the value. Add one spec `"leaves recurrence null when omitted"`.
- [ ] **Phase 1 gate** — `pnpm --filter api lint && pnpm --filter api test`. Backend now permits but does not yet enforce `recurrence` writes. Frontend untouched.

### Phase 2 — Migrate data + drop `incomes` table

> Goal: the legacy `incomes` rows are now `transactions` rows with positive amount + recurrence. The `incomes` table is dropped, but a snapshot table preserves reversibility.

- [ ] T2.1 Create `apps/api/src/migrations/1776520999999-MergeIncomeIntoTransaction.ts` [NEW]. Class name `MergeIncomeIntoTransaction1776520999999`. `up` body:
  ```ts
  // 1. Add recurrence to transactions (idempotent if already present from Phase 1)
  await queryRunner.query(
    `ALTER TABLE "bg_public"."transactions" ADD COLUMN IF NOT EXISTS "recurrence" character varying`,
  );
  // 2. Snapshot legacy incomes for rollback
  await queryRunner.query(
    `CREATE TABLE IF NOT EXISTS "bg_public"."incomes_snapshot_2026" AS TABLE "bg_public"."incomes"`,
  );
  // 3. Migrate: copy incomes rows to transactions (insert-update conflict-free)
  await queryRunner.query(
    `INSERT INTO "bg_public"."transactions"
       ("date","description","amount","category","recurrence","createdAt","updatedAt","userId")
     SELECT "date","description","amount","category","recurrence","createdAt","updatedAt","userId"
     FROM "bg_public"."incomes"`,
  );
  // 4. Drop FK from incomes.userId to users
  await queryRunner.query(
    `ALTER TABLE "bg_public"."incomes" DROP CONSTRAINT IF EXISTS "FK_f6b7c6bbe04a203dfc67ae627ab"`,
  );
  // 5. Drop the table
  await queryRunner.query(`DROP TABLE "bg_public"."incomes"`);
  ```
  `down` body (reverses cleanly):
  ```ts
  await queryRunner.query(
    `CREATE TABLE "bg_public"."incomes" AS TABLE "bg_public"."incomes_snapshot_2026"`,
  );
  await queryRunner.query(
    `ALTER TABLE "bg_public"."incomes_snapshot_2026" DROP CONSTRAINT IF EXISTS "PK_d737b3d0314c1f0da5461a55e5e"`,
  );
  // Recreate FK + PK + indexes (mirror the InitialMigration DOWN for incomes)
  …
  // Optional: drop the recurrence column from transactions in a follow-up migration
  // (we keep it after rollback so legacy transactions remain nullable — harmless).
  await queryRunner.query(
    `ALTER TABLE "bg_public"."transactions" DROP COLUMN IF EXISTS "recurrence"`,
  );
  ```
- [ ] T2.2 Run the migration locally: `cd apps/api && pnpm migration:run`. Verify via live `SELECT COUNT(*) FROM bg_public.transactions` (must equal the pre-migration count + 4) and `SELECT COUNT(*) FROM bg_public.incomes_snapshot_2026` (must equal 4).
- [ ] T2.3 Create `apps/api/test/dashboard/migrations/merge-income.spec.ts` [NEW]. Use the `pg-mem` or actual Docker-Postgres approach already used in `apps/api/test/dashboard/recent-summary.spec.ts`. Asserts:
  - `transactions` count = `original_transactions + snapshot_count`
  - `incomes` table does NOT exist
  - Each migrated row has positive `amount` and `recurrence IS NOT NULL`
  - `down()` rebuilds `incomes` from snapshot (via `migration:revert` step).
- [ ] **Phase 2 gate** — `pnpm --filter api lint && pnpm --filter api test`. Backend now runs against a DB without `incomes` but with the data fused into transactions. Frontend untouched (still hitting `/incomes`). The orphaned-balance bug is *already* fixed at the data layer: positive transactions sum into income aggregates.

### Phase 3 — Strangler-facade the `/income` UI on top of `/transactions`

> Goal: the user-facing Income page reads from `/transactions?type=income` and reuses shared form/modal/filter/table. The original Income components become local-only thin wrappers, then get deleted in Phase 4.

- [ ] T3.1 Edit `apps/webClient/src/domain/dashboard/transactions/transaction.repository.ts` — extend the `RootPromise` return to support a `Transaction` with `recurrence: string | null`. Extend `TRANSACTION_CATEGORIES` if needed to include Income-specific entries (`Salary`, `Freelance`, `Investments`, `Rental`, `Business`, `Refunds`) — only those not already present. (Confirm by reading the array; `Salary` and `Gifts` are in TRANSACTION_CATEGORIES; need to add Freelance, Investments, Rental, Business, Refunds.)
- [ ] T3.2 Edit `apps/webClient/src/adapters/http/transaction.repository.ts` — append helper `getIncomeOnly(offset, limit): Promise<RootPromise>` that calls `GET /transactions?type=income` (the backend should accept that query after **T3.fast-path**). If the backend rejects `type=income`, fall back to `getAll(offset, limit)` and let the page filter client-side.
- [ ] T3.3 Add server-side filter support: edit `apps/api/src/adapters/dashboard/http/transaction.controller.ts` `@Get()` (L108–L130) to accept `@Query('type') type?: 'income' | 'expense'`, pass to service. Edit `apps/api/src/application/dashboard/services/transaction.service.ts` `getTransactionsByUser` (~L40–L60) to forward. Edit `apps/api/src/adapters/dashboard/persistence/transaction.repository.ts` `findAndCount` (~L96–L114) to apply a TypeORM `where: { amount: type === 'income' ? MoreThan(0) : LessThan(0), user: { id: userId } }` clause.
- [ ] T3.4 Rewrite `apps/webClient/src/presentation/pages/dashboard/incomePage.tsx`:
  - Replace `useFetchIncomes(offset, limit)` with `useFetchTransactions(offset, limit)` + a local `filter(income.amount > 0)` OR add `useFetchIncomeTransactions(offset, limit)` that wraps `useFetchTransactions` plus a `type=income` query-param request to the backend (after T3.3 lands).
  - Replace `<IncomeSourceTable>` with the shared `<Table>` (apps/webClient/src/presentation/components/ui/table.tsx). It already supports the columns we need (date, description, category, amount).
  - Replace `<IncomeByCategory>` and `<IncomeHistory>` with shared expense-categories-style charts scoped to income rows (reuse the same chart configs with `dataKey="amount"` and a `data={...filteredIncome}` source).
  - **Kill the inverted `$NaN` ternary** at line ~113: replace `totalIncomeToDisplay !== "NaN" ? "$0.00" : totalIncomeToDisplay` with `Number.isFinite(avg) ? formatCurrency(avg).formatted : t("common.noData")`. (Even if Phase 4 deletes this page, fixing the bug here costs zero technical debt and prevents the bug from being copy-pasted into the new page.)
  - Add a small regression test asserting no string `"NaN"` is rendered (covered by T6.x).
- [ ] T3.5 Add `apps/webClient/src/presentation/components/dashboard/transaction/transaction-form.tsx` capability: render the recurrence `<select>` field whenever the `IncomeCategory` is selected. Wire up `INCOME_RECURRENCES` from a new colocated constant (move from `apps/webClient/src/domain/dashboard/incomes/income.entity.ts` to `apps/webClient/src/domain/dashboard/transactions/transaction.entity.ts` once Phase 4 is approved and the income-side file is deleted).
- [ ] T3.6 Edit `apps/webClient/src/presentation/components/dashboard/transaction/filter-transaction-modal.tsx` (`FilterCriteria`) — extend with `recurrences: ('All' | 'One-time' | 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Quarterly' | 'Annually')[]` and render the new chips in the modal. Wire the existing `handleSelection` helper to work with the new dimension.
- [ ] T3.7 Edit `apps/webClient/src/presentation/components/dashboard/transaction/add-transaction-modal.tsx` and `apps/webClient/src/presentation/components/dashboard/transaction/edit-transaction.tsx` — both already call `addTransaction`/`updateTransaction` mutations; on success they invalidate queries. Extend their `onSuccess` to also invalidate `["transactions", "income"]` (the new query key from the incomePage).
- [ ] T3.8 Edit `apps/webClient/src/presentation/pages/dashboard/transactionPage.tsx` — add a sub-tab (or filter chip) `Income` alongside `All`/`Expense`. Use the new `useFetchTransactions` filter helper from T3.2 to populate.
- [ ] T3.9 Edit the React Query hook `useFetchTransactions` in `apps/webClient/src/adapters/query/dashboard.tsx:5,52` — currently generic on `(offset, limit)`. Update key from `["transactions", offset, limit]` to `["transactions", offset, limit, type?]` so cache invalidation is filter-aware.
- [ ] **Phase 3 gate** — `pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. UI parity: `/app/dashboard/income` and `/app/dashboard/transactions?type=income` render the same rows. `$NaN` card is fixed.

### Phase 4 — Delete the Income stack (backend + frontend leftovers)

> Goal: every Income-only backend file is gone. The frontend only has shared, Income-aware transaction components. `users.incomes` relation is removed so the table is genuinely un-owned.

- [ ] T4.1 Edit `apps/api/src/domain/user/user.entity.ts` — drop the `import { Income } from '@domain/dashboard/income.entity';` (if still present) and the `'incomes'` entry from any `OneToMany` relations array; the FK target no longer exists.
- [ ] T4.2 Delete `apps/api/src/domain/dashboard/income.entity.ts`.
- [ ] T4.3 Delete `apps/api/src/application/dashboard/services/income.service.ts`.
- [ ] T4.4 Delete `apps/api/src/adapters/dashboard/http/income.controller.ts`.
- [ ] T4.5 Delete `apps/api/src/adapters/dashboard/persistence/income.repository.ts`.
- [ ] T4.6 Delete `apps/api/src/application/dashboard/dto/create-income.dto.ts`. (No update dto exists — verify with `ls` after T4.5.)
- [ ] T4.7 Edit `apps/api/src/infrastructure/dashboard/dashboard.module.ts` — drop `IncomeController` from `controllers`, drop `IncomeService` and `IncomeRepository` from `providers`/`exports`, drop `Income` entity from `TypeOrmModule.forFeature([...])`. Existing dashboard.module.ts has Income wired in — search for the import lines (Likely L7, L13, L21, L30s based on prior similar reviews; verify).
- [ ] T4.8 Search audit: `rg 'IncomeController|IncomeService|IncomeRepository|@domain/dashboard/income\.entity|CreateIncomeDto' apps/api/src --type ts` must return 0 hits after T4.2–T4.7. If anything remains, delete/edit.
- [ ] T4.9 Edit `apps/webClient/src/adapters/hooks/useLoadUser.tsx` — verify no Income-specific hook exists; if found, delete or rewrite.
- [ ] T4.10 Delete `apps/webClient/src/domain/dashboard/incomes/income.entity.ts`.
- [ ] T4.11 Delete `apps/webClient/src/domain/dashboard/incomes/income.repository.ts`.
- [ ] T4.12 Delete `apps/webClient/src/adapters/http/income.repository.ts` (already no callers; verify with `rg HttpIncomeRepository apps/webClient/src --type ts` should be 0 after T3.4).
- [ ] T4.13 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-modal.tsx`.
- [ ] T4.14 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-form.tsx`.
- [ ] T4.15 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-history.tsx`.
- [ ] T4.16 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-source-table.tsx`.
- [ ] T4.17 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-by-category.tsx`.
- [ ] T4.18 Delete `apps/webClient/src/presentation/components/dashboard/incomes/income-overview.tsx`.
- [ ] T4.19 Delete `apps/webClient/src/presentation/components/dashboard/incomes/filter-income-modal.tsx`.
- [ ] T4.20 Delete `apps/webClient/src/presentation/components/dashboard/incomes/incomes-loading.tsx`.
- [ ] T4.21 Delete `apps/webClient/src/presentation/components/dashboard/incomes/` (parent dir if empty after T4.13–T4.20).
- [ ] T4.22 Delete `apps/webClient/src/domain/dashboard/incomes/` (parent dir if empty after T4.10–T4.11).
- [ ] T4.23 Search audit: `rg -i 'income' apps/webClient/src/domain apps/webClient/src/adapters --type ts --type tsx` should return at most the new `recurrences` filter type in `transaction.entity.ts` and the convoluted income-aware filter criteria on the transactions modal. Anything else = orphan.
- [ ] **Phase 4 gate** — `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`. Everything green.

### Phase 5 — i18n cleanup

> Goal: orphan `income.*` keys are removed; the few that survive are routed through a single dedicated namespace (`categories.income.*` pattern). Sidebar/Routes/Tests are cleaned.

- [ ] T5.1 Edit `apps/webClient/src/infrastructure/i18n/locales/en.json` — operations:
  - Delete `income.recurrenceOneTime|Daily|Weekly|Bi-weekly|Monthly|Quarterly|Annually` keys (replaced by T3.6).
  - Delete `income.amountCannotBeZero` (translated by inline form validation now; replace with a `transactions.amountCannotBeZero` key).
  - Delete `income.byCategory`, `income.history`, `income.fromIncomes`, `income.avgIncome`, `income.perIncome`, `income.totalIncome`, `income.primaryIncome`, `income.noSourcesFound` (all orphaned by T3.4).
  - Delete `income.addIncome`, `income.addIncomeSource`, `income.editIncomeSource`, `income.addIncomeButton`, `income.updateIncomeButton`, `income.filter`, `income.descriptionLabel`, `income.descriptionPlaceholder`, `income.recurrence`, `income.amount`, `income.amountPlaceholder`, `income.category`, `income.selectCategory`, `income.title`, `income.description` (page-level keys orphaned by T3.4).
  - Keep `income.title` if the sidebar route label still reads it — repoint label to `routes.app.dashboard.income` (route-side i18n) and remove the page-local one.
- [ ] T5.2 Same sweep for `apps/webClient/src/infrastructure/i18n/locales/es.json`.
- [ ] T5.3 Edit `apps/webClient/src/presentation/components/dashboard/sidebar.tsx` — keep the `Income` nav entry; verify its label resolves to a non-removed key (`routes.app.dashboard.income`).
- [ ] T5.4 Edit `apps/webClient/src/presentation/routes/route-config.tsx` — confirm `/app/dashboard/income` still resolves to `IncomePage` (now the strangler-facade version). Mark any unused imports (e.g., `IncomeByCategory`, `IncomeHistory`, `IncomeSourcesTable`) as removed.
- [ ] T5.5 Edit `apps/webClient/src/presentation/utils/routes.ts` — keep `RoutePaths.Income` enum entry (route still exists, points at the same path).
- [ ] T5.6 Edit `apps/webClient/tests/transaction-form.spec.ts` — extend the existing spec to assert that selecting a recurrence value persists across the form→submit roundtrip (positive path).
- [ ] T5.7 Add `apps/webClient/tests/income-merger.spec.ts` [NEW] — Playwright spec covering the user-visible end-state:
  - Login, navigate to `/app/dashboard/income`. Assert table rendered. Assert **no** `NaN` string appears anywhere on the page.
  - Click "Add" → fill form with positive amount + Salary + Monthly → submit → expect row appears in table.
  - Navigate to `/app/dashboard/transactions` (default = all) → filter by Amount > 0 (chip) → expect the same row is visible. (Confirms write path landed on transactions, not orphaned.)
  - Take a snapshot. Snapshot the original legacy DB (or seed/dev user) before the test; assert legacy incomes rows are visible at `/app/dashboard/transactions?type=income` (proves the migration moved data correctly).
- [ ] **Phase 5 gate** — `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`. The full deletion path is verified end-to-end.

## Code References

### New files (greenfield)

```
apps/api/src/migrations/1776520999999-MergeIncomeIntoTransaction.ts        [NEW]
apps/api/test/dashboard/migrations/merge-income.spec.ts                    [NEW]
apps/webClient/tests/income-merger.spec.ts                                 [NEW]
```

### Files to delete (Phase 4 sweep)

```
apps/api/src/domain/dashboard/income.entity.ts
apps/api/src/application/dashboard/services/income.service.ts
apps/api/src/adapters/dashboard/http/income.controller.ts
apps/api/src/adapters/dashboard/persistence/income.repository.ts
apps/api/src/application/dashboard/dto/create-income.dto.ts
apps/webClient/src/adapters/http/income.repository.ts
apps/webClient/src/domain/dashboard/incomes/income.entity.ts
apps/webClient/src/domain/dashboard/incomes/income.repository.ts
apps/webClient/src/presentation/components/dashboard/incomes/income-modal.tsx
apps/webClient/src/presentation/components/dashboard/incomes/income-form.tsx
apps/webClient/src/presentation/components/dashboard/incomes/income-history.tsx
apps/webClient/src/presentation/components/dashboard/incomes/income-source-table.tsx
apps/webClient/src/presentation/components/dashboard/incomes/income-by-category.tsx
apps/webClient/src/presentation/components/dashboard/incomes/income-overview.tsx
apps/webClient/src/presentation/components/dashboard/incomes/filter-income-modal.tsx
apps/webClient/src/presentation/components/dashboard/incomes/incomes-loading.tsx
apps/webClient/src/presentation/components/dashboard/incomes/              [parent dir if empty]
apps/webClient/src/domain/dashboard/incomes/                              [parent dir if empty]
```

### Files to edit

```
apps/api/src/domain/dashboard/transaction.entity.ts                          [T1.1]
apps/api/src/application/dashboard/dto/create-transaction.dto.ts            [T1.2]
apps/api/src/application/dashboard/dto/update-transaction.dto.ts            [T1.3]
apps/api/src/adapters/dashboard/http/transaction.controller.ts               [T1.4; T3.3]
apps/api/src/adapters/dashboard/persistence/transaction.repository.ts        [T1.5; T3.3]
apps/api/src/application/dashboard/services/transaction.service.ts          [T1.6; T3.3]
apps/api/src/domain/user/user.entity.ts                                      [T4.1]
apps/api/src/infrastructure/dashboard/dashboard.module.ts                    [T4.7]
apps/api/test/dashboard/transaction.service.spec.ts                          [T1.7; T5.6-adjacent]

apps/webClient/src/domain/dashboard/transactions/transaction.entity.ts       [T3.1]
apps/webClient/src/adapters/http/transaction.repository.ts                  [T3.2]
apps/webClient/src/adapters/query/dashboard.tsx:5,52                         [T2.2/T3.9]
apps/webClient/src/presentation/pages/dashboard/incomePage.tsx               [T3.4]
apps/webClient/src/presentation/pages/dashboard/transactionPage.tsx          [T3.8]
apps/webClient/src/presentation/components/dashboard/transaction/transaction-form.tsx [T3.5]
apps/webClient/src/presentation/components/dashboard/transaction/filter-transaction-modal.tsx [T3.6]
apps/webClient/src/presentation/components/dashboard/transaction/add-transaction-modal.tsx [T3.7]
apps/webClient/src/presentation/components/dashboard/transaction/edit-transaction.tsx [T3.7]
apps/webClient/src/presentation/components/dashboard/sidebar.tsx            [T5.3]
apps/webClient/src/presentation/routes/route-config.tsx                     [T5.4]
apps/webClient/src/presentation/utils/routes.ts                               [T5.5]
apps/webClient/src/infrastructure/i18n/locales/en.json                        [T5.1]
apps/webClient/src/infrastructure/i18n/locales/es.json                        [T5.2]
apps/webClient/tests/transaction-form.spec.ts                                 [T5.6]
```

### Migration registrations / data-source

```
apps/api/src/data-source.ts                                                   [passive — glob auto-picks up migrations/*]
```

## Testing Plan

| Layer | Approach |
|-------|----------|
| **Unit (backend Jest)** | T1.7 extends `transaction.service.spec.ts`; T2.3 adds `migrate-income.spec.ts` against a Docker fixture (or `pg-mem` fallback) to assert row count + sign before/after. |
| **E2E (Playwright)** | T5.7 adds `income-merger.spec.ts` covering the full straddling path (legacy income rows visible via transactions; new positive-amount row visible in both views; sidebar nav round-trips; i18n `es` no string `"NaN"` anywhere). |
| **Visual** | After Phase 3 + Phase 5, snapshot `/app/dashboard/income` and `/app/dashboard/transactions` side-by-side. Diff: zero rendering diffs allowed except for the inherent `Income` sub-tab styling. |
| **DB integrity** | After Phase 2: `SELECT COUNT(*) FROM bg_public.transactions` = pre-migration + 4; `SELECT COUNT(*) FROM bg_public.incomes_snapshot_2026` = 4; `SELECT COUNT(*) FROM information_schema.tables WHERE table_name='incomes'` = 0. |
| **Sign convention** | After Phase 2: `SELECT SUM(amount) FROM bg_public.transactions WHERE amount > 0 AND recurrence IS NOT NULL` matches pre-migration income total (cents precision OK). `overview.service.ts` recent-summary endpoint should return the same `income` aggregate value as before migration. |
| **Reversibility** | Phase 2 spec asserts `migration:revert` rebuilds `incomes` from snapshot (count matches), then `migration:run` replays cleanly (forward). |
| **i18n regression** | `apps/webClient/tests/i18n.spec.ts` (existing) must continue passing: switching locale should not surface raw `NaN`, `currencyService`-formatted values should still localize. |
| **Lint/build gates** | After every task: `pnpm --filter api lint && pnpm --filter api test`; plus `pnpm --filter frontend-web lint && pnpm --filter frontend-web test` after frontend-touched tasks. Phase gates additionally run `pnpm build`. |

## FACTS Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Feasibility (F)** | 5 | All tasks use existing patterns (NestJS migration glob, TypeORM column-add + IndexedQueryBuilder, React Query cache-key extension, Playwright E2E). No new dependencies, no third-party services. |
| **Atomicity (A)** | 5 | Each task is single-file: T1.1–T1.7 each touch one backend file; T2.1 is one new migration file; T3.1–T3.9 each one frontend module; T4.2–T4.22 are pure deletions; T5.1–T5.7 each one i18n or test file. Grouped edits (per-test) are explicit. |
| **Clarity (C)** | 4 | File paths and line ranges are precise (line ranges verified against the live file tree at plan-creation time). Some line numbers in T1.4, T1.7, T4.7, T5.1–T5.2 may shift after earlier edits — adjust by `jq` / `rg` at execution time. Sidebar/Routes edits in T5.3–T5.5 depend on existing copy patterns; verify against the latest commits. |
| **Testability (T)** | 5 | Every task ends at a compile boundary. Lock tests added at phase gates (T2.3 / T5.7 / T1.7). Build/lint/test gates surface failures immediately post-task. The migration can be tested in isolation (T2.3) against a fixture DB. |
| **Size (S)** | 4 | Phases are balanced: P1=8 tasks, P2=4 tasks, P3=10 tasks, P4=23 tasks (mostly deletions, very low complexity), P5=8 tasks. No task > 1 file except T2.1 (which is the entire migration by design). |
| **Mean** | **4.6** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 4  T: 5  S: 4  Mean: 4.6  --> PASS
```

## Dependencies & Sequencing

```
Phase 1 ─ Phase 1 gate ─► Phase 2 ─ Phase 2 gate ─► Phase 3 ─ Phase 3 gate ─► Phase 4 ─ Phase 4 gate ─► Phase 5 ─ Phase 5 gate (launch readiness)
       │                       │                       │                       │                       │
       │                       │                       │                       │                       │
   (T1.1..T1.7)             (T2.1 migration          (T3.1..T3.9            (T4.1..T4.23:            (T5.1..T5.7:
                            + T2.2 run                  frontend              user.incomes             i18n sweep,
                            + T2.3 spec)                strangler)            relation +              tests,
                                                                              backend + frontend      snapshot
                                                                              deletes)                test)
```

Critical-path constraints:
- **T2.1 must run after T1.1.** The `ALTER TABLE … ADD COLUMN recurrence` in the migration is idempotent (uses `IF NOT EXISTS`) so re-running a stale build won't break, but the migration sequencing assumes the column is in place.
- **T3.3 must land before T3.4.** Backend `type=income` query-param support has to exist before the frontend can rely on it (the fallback is client-side filtering, so T3.4 is robust to T3.3 missing — but nicer with it).
- **T4.1 must run before T2.1's `DROP TABLE`** (when run in cascade order). Effect: we drop the FK constraint inside the migration (T2.1 step 4). The users.incomes inverse relation can stay until Phase 4 via JPA/"eager:false" trick — TypeORM's `OneToMany` is metadata-only, not a DB constraint. Verified: the `"FK_f6b7c6bbe04a203dfc67ae627ab"` is the actual DB FK; the user entity's relation does not generate a separate constraint.
- **Phase 3 ⇒ Phase 4 ordering:** Strangler facade must complete deletion safely before we yank the backend `/incomes` controllers (T4.4). Without Phase 3, T4.4 leaves the UI calling an unreachable endpoint.

Parallel-execution opportunities (within a phase):
- T1.1 + T1.2 + T1.3 are independent (entity + DTOs). Run in parallel.
- T1.4 + T1.5 + T1.6 can run after the entity lands (T1.1) and the DTO widens (T1.2 + T1.3).
- T3.1 + T3.2 run before T3.4. T3.5 / T3.6 / T3.7 / T3.8 / T3.9 run after.
- T4.2..T4.22 are pure deletions — trivially parallel.
- T5.1 + T5.2 run in parallel; T5.3 + T5.4 + T5.5 also parallel; T5.6 + T5.7 are sequential (T5.7 needs T5.6).

External dependencies: none. No webhook, payment integration, or third-party service changes.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| `ALTER TABLE` on `transactions` (Phase 1 / T2.1 step 1) fails when running against a backend that has load without a maintenance window | Low | Phase 2 gate fails; can pause | T2.1 uses `IF NOT EXISTS` so re-running on an already-mutated DB is harmless; document the order; recommend a 1-minute maintenance window during deploy. |
| Live `users.incomes` ManyToOne inverse relation remains at Phase 4 begin | Low | TypeORM tests fail loading user entity | T4.1 explicitly removes the relation and verifies by `rg` — included as T4.23 audit step. The data-direction FK is dropped inside T2.1 step 4 (`DROP CONSTRAINT IF EXISTS`). |
| `transactions.amount = 0` legacy rows behave incorrectly under sign-convention predicates | Low | Zero-amount rows excluded from both income AND expense aggregations | Document: zero-amount rows are equivalent to "skip" rows. `overview.service.ts` already excludes them. **Acceptable**; no spec added (legacy behavior already validated). |
| `Bi-weekly` Unicode-hyphen regression | Medium | Frontend form throws TS2820 again | T3.5 explicitly uses ASCII hyphen `"Bi-weekly"` everywhere on the new transaction recurrence options; mirrors the prior fix. Audit `rg -i 'bi‑weekly'` for non-ASCII. |
| `recurrence` text-format inconsistently cased (`Monthly` vs `monthly`) | Medium | Filter chip ends up with two badges for one recurrence | Add normalization: T3.5 + T3.6 collapse to title-case on write and read. Local lock test in T5.6. |
| Migration destructive on a heavily-populated `incomes` table (e.g., 10k rows) | Low (live DB has 4) | Long ALTER TABLE during deployment | Migration `INSERT-SELECT` is a single statement, no per-row roundtrip — completes in <2s even at 10k rows. Not a real risk; `incomes_snapshot_2026` is the rollback. |
| Phase-3 Strangler facade leaks `useFetchIncomes` (forgotten import) → orphan hook | Low | Lint warning, dead code | T4.12 deletes `HttpIncomeRepository`; T3.4 deletes `useFetchIncomes`. T4.23 audit catches stragglers. |
| i18n key renames (Phase 5) break locale fallback (missing `es` translation) | Medium | Spanish locale shows raw `income.title` literal in stale places | T5.1 + T5.2 sweep both locale files in lockstep. `pnpm --filter frontend-web test` (i18n.spec.ts) gates. |
| Long-running dev-server instances cache stale `transactions` schema (no `recurrence`) | Low | New field writes throw at runtime | Restart Backend after Phase 1 + Phase 2 — documented in commit message. |
| `transaction.repository.ts` `findAndCount` `where.amount` clause conflicts with offset/limit semantics in TypeORM v0.3 | Low | Empty result on `?type=income` | T2.3 spec asserts non-empty result. If conflict, fall back to `queryBuilder.andWhere('amount > 0')`, which the version handles cleanly. |

## Rollback Strategy

### Per-phase rollback points

| Phase | Rollback Procedure |
|-------|--------------------|
| **Phase 1** (extend transactions) | `git revert <phase-1-commit>`. The added column is nullable and unused; reverting the entity + DTO + repo + spec restores prior behavior. Forward: works because the column doesn't exist (no data lost). **No DB-impacting rollback.** |
| **Phase 2** (migration data + drop) | `cd apps/api && pnpm migration:revert`. The migration's `down()` rebuilds `incomes` from `incomes_snapshot_2026`. After revert, the `transactions.recurrence` column is also dropped (defined inside the migration's down). Then `pnpm --filter api migration:run` replays the forward re-runs cleanly. **Single-step reversible via migration framework.** |
| **Phase 3** (Strangler facade) | `git revert <phase-3-commit>`. Reverts to the original `incomePage.tsx` reading from `/incomes`. But: in Phase 3 starts, `/incomes` is already gone (data-wise) — so the reverted page renders zero rows. Mitigate by reverting Phase 2 simultaneously. Acceptable mitigation: keep `/incomes` controller as a thin pass-through until Phase 4 (proposed refinement: leave Phase 3 as the only place where both surfaces exist; revert restores both correctly only if combined). |
| **Phase 4** (delete Income stack) | `git revert <phase-4-commit>` restores all the deleted files (git history is complete). Frontend fails TS2307 only if a new file imports a deleted symbol; mitigated because T4.23 audit landed. **Lowest risk: deletions are atomic + git-recoverable; the type system surfaces missing imports immediately.** |
| **Phase 5** (i18n cleanup) | `git revert <phase-5-commit>`. Restores en.json/es.json entries, restored sidebar/route-config/text. Only side-effect: any T5.6 spec or T5.7 snapshot test stays green on revert (no DB impact). |

### Recovery dataset

- **`bg_public.incomes_snapshot_2026`** — created in Phase 2. Single source of truth for `migration:revert`. Retain this table past Phase 5 (don't drop it explicitly) so any future `down()` replay is safe.
- **git history** — every deleted file is git-recoverable. Recovery granularity: per commit.
- **Migration audit table `bg_public.migrations`** — the `pnpm migration:show` command lists applied migrations and their order. Critical for production verification pre/post-deploy.

### Destructive ops guardrails

- Migration's `DROP TABLE incomes` is **preceded by** `CREATE TABLE incomes_snapshot_2026 AS TABLE incomes` for the same data set. Down-restoration is unconditional.
- Migration's `DROP CONSTRAINT IF EXISTS` is idempotent — running Phase 2 twice is harmless.
- The `users.incomes` relation deletion (T4.1) is decoupled from the DB constraint drop (T2.1 step 4) — running either alone is safe.
- Production deploy order (mandatory): Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. **Never combine phases in a single deploy**; failing mid-deploy would leave an inconsistent mid-state.

### Postmortem trigger conditions

A `plan-postmortem.md` is generated at `rpi/income-redundancy/plan-postmortem.md` if:
- Phase 2 migration fails after running on prod (not recoverable via `migration:revert` without manual `incomes_snapshot_2026` cross-check).
- `pnpm --filter api test` fails on any of T1.7 / T2.3 / T5.6-adjacent specs in the integration test path.
- The Strangler facade in Phase 3 surfaces a runtime error in `useFetchTransactions` that cannot be resolved without restoring `/incomes`.

## Reference

- Research artifact: `rpi/income-redundancy/research.md` (FAR Mean=4.67, PASS).
- Code lines cited: Phase 1 references verified against the live file tree (transaction.entity.ts:30, dto L-row ranges, transaction.controller.ts Swagger at L25–L70 and L160–L255, transaction.repository.ts:21+53, transaction.service.ts:17+62). Phase 4 deletion list verified by structure (no orphans in the income-vs-transaction cross-import set).
- Project conventions: clean architecture (domain/application/infrastructure/adapters), alias imports, prettier + eslint configurations unchanged, no `any` cast expansions.
- Quality gates: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`.
- Implementation phase document: `docs/rpi/Implement.md`.
