# Budget Currency Coercion — Research Phase

> **RPI Framework:** This is the Research phase deliverable per `knowledge.md §11.3` and `docs/rpi/README.md`. The audit findings below motivated an RPI cycle because the implementation is non-trivial (cross-currency math + service-layer dependency wiring + at least 2 caller refactors). Use this document as the FAR scale anchor before any Plan phase starts.

## Problem statement

`apps/api/src/application/dashboard/services/budget.service.ts` aggregates `BudgetCategory.spent` and `BudgetCategory.allocated` into `Budget.totalSpent` / `Budget.totalAllocated` via a naive numeric `+=`. Now that `BudgetCategory.currency` is a per-row enum (added in migration 1800000000004 — `apps/api/src/migrations/1800000000004-AddCurrencyToBudgetCategory.ts` — default `'USD'`, but legally `USD` / `EUR` / `COP` for new rows), mixed-currency budgets produce **mathematically invalid** totals:

```
category A.spent = 50     (currency USD)
category B.spent = 50000  (currency COP)
∑ reduces to 50050 — meaningless number returned as Budget.totalSpent
```

The Category-level webClient fix bundle (in this PR) renders each `category.spent` correctly because it formats against `category.currency → targetCurrency` via `currencyService.convertAmount`. But `BudgetSummary` reads `Budget.totalSpent` / `.totalAllocated` **directly**, so the parent-total displayed in the i18n-fix component is still produced by this naive sum.

## Affected files

| File | Lines | What |
|------|-------|------|
| `apps/api/src/application/dashboard/services/budget.service.ts` | 145–155 (inside `getBudgets`) | In-memory naive `+=` summation; returns to caller without persisting |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 281–288 (inside `recalculateBudgetTotalSpent`) | Persisted naive `+=` summation via `updateBudget()` after each `updateBudgetCategory` |
| `apps/api/src/domain/dashboard/budget.entity.ts` | 39 / 49 | `totalAllocated` / `totalSpent` columns — vestigial once on-the-fly math is correct |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 38–67 (`createBudget`) | Skips category sum entirely; persists only `dto.totalSpent ?? 0` |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 75–119 (`createBudgetCategory`) | Inserts a category row, no parent-budget sum update — `recalculateBudgetTotalSpent` is **not** called here |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 291–304 (`deleteBudgetCategory`) | Delete path also misses `recalculateBudgetTotalSpent` |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 195–225 (`updateBudget`) | `UpdateBudgetDto` exposes `totalAllocated?` + `totalSpent?` — caller-supplied DTO values can overwrite totals with arbitrary non-normalized numbers, bypassing the category sum logic entirely |
| `apps/api/src/application/dashboard/services/budget.service.ts` | 168–178 (`getBudget`) | Repo call returns persisted totals; this single-fetch endpoint is the only path that **actually reads from the DB columns** (since `getBudgets` overrides in-memory); it surfaces whatever stale garbage `updateBudget` last stored |

The 2 missed paths (`createBudgetCategory`, `deleteBudgetCategory`) compound the bug: even with single-currency budgets, the parent total drifts out of sync if a category is added or removed without a subsequent category-update triggering recalculation.

### Dead column signal

`Budget.totalAllocated` is **effectively dead** at the persistence layer:
- `createBudget` doesn't write it (no DTO field pass-through other than `totalAllocated` from the DTO literal).
- `recalculateBudgetTotalSpent` only touches `totalSpent`.
- The only place it's "computed" is `getBudgets`, but that's in-memory + never persisted.

The webside `BudgetSummary` reads `Budget.totalAllocated` directly via `selectedBudget.totalAllocated` without summing — so the displayed value is whatever stale, possibly-garbage DB snapshot survived the last full create/update cycle. This is the path Option (a) [schema `currency` column] does NOT fix; Option (B) [GET-time coercion] OR Option (E) [client-side compute] does.

## Write-path inventory

1. **Creation** (`createBudget`) — writes `totalSpent` from `dto.totalSpent ?? 0`; doesn't compute `totalAllocated`.
2. **Category update** (`updateBudgetCategory` → `recalculateBudgetTotalSpent`) — re-sums after each category edit, persists, no FX.
3. **Category create** (`createBudgetCategory`) — missing sum update. (Reviewed #1: highest-impact missed path.)
4. **Category delete** (`deleteBudgetCategory`) — missing sum update. (Reviewed #1.)
5. **Budget update DTO** (`updateBudget`) — accepts arbitrary `totalAllocated?` + `totalSpent?` from the caller; no FX normalization; overwrites whatever the category-sum produced. (Reviewed #1.)
6. **Single-budget fetch** (`getBudget`) — does NOT recompute in-memory; returns the persisted value. (Reviewed #1: this is the read site that surfaces the persisted garbage.)
7. **List read** (`getBudgets`) — overrides totals in-memory before returning, no FX.

## Fix options

### Option A — Add `currency` column to `Budget` entity

- New migration adding `budgets.currency` (default `'USD'`).
- Decide on canonical currency semantics: creation-time user setting vs. asked-time user setting.
- Does **not** by itself fix the math — only labels the garbage. To fix, must pair with Option C coercion.
- Effort: ~100+ LOC (entity + migration + service touches).
- Risk: high (schema change; legacy-row fallback decision; existing tests assume no-currency on Budget).

### Option B — Compute totals on-the-fly in `BudgetService.getBudgets()`

- Inject `CurrencyService` into `BudgetService`.
- Replace both summation loops with: for every category, `currencyService.convert({amount, from: category.currency, to: canonical})`, then sum the converted values.
- Canonical currency: `user_settings.currency` from `UserSettingsService` (already injected), defaulting to `'USD'`.
- Removes the lock-in risk because totals are NOT persisted — fresh FX every GET.
- Effort: ~40–60 LOC, all in `budget.service.ts`.
- Touches: `budget.service.ts` (getBudgets + recalculateBudgetTotalSpent), `dashboard.module.ts` (no — CurrencyService is already globally registered).
- Tests: `budget-service.spec.ts` will need new mock for CurrencyService + new spec lines for cross-currency sum.

### Option C — Service-layer coercion persisted on every category mutation

- Same logic as B but persisted in `Budget.totalSpent` / `.totalAllocated`.
- `recalculateBudgetTotalSpent` runs on category create + update + delete.
- Risk: medium. Locks in exchange rate at write time (rate stays "stale" from the user's UI perspective). Also doesn't fix historical budget creation snapshots when daily FX shifts.

### Option D — Audit note only

- Tagged TODO comments in 2 hot-spots. Zero behavior change.
- Future work tracked via this RPI artifact.
- Effort: ~5 LOC + research doc.
- **This is what this RPI round delivered.**

### Option E — Client-side compute only

- WebClient sums `category.<field>` in `budget-detail.tsx` using `currencyService.convertAmount` per category.
- Backend `Budget.totalSpent` / `.totalAllocated` become vestigial / deprecated.
- Effort: ~20 LOC in webClient.
- Risk: backend column drift is now meaningless; webClient becomes source of truth for totals.

## Recommended path

**Option B primarily, Option E defense-in-depth.**

> Note: Option (a) is orthogonal to the bug. It is a schema-improvement lever (currency column on `Budget`) but does NOT address the cross-currency summation on its own. Option (a) should be re-ranked as a future-only "schema cleanup" deliverable, never the primary correctness fix. Earlier hot-rankings conflating (a) with the math bug are corrected in this revision.

Suggested endpoint-to-strategy assignment:

| Endpoint | Strategy | Why |
|----------|----------|-----|
| `GET /budgets` (list) | **B** | Already in-memory sum; replace with FX-coerced sum. Lowest risk since no persistence change. |
| `GET /budgets/:id` (single) | **B** | Single-budget fetch should re-sum too — current read of garbage DB column is the bug's most visible surface. |
| `GET /budgets/categories` | **B + per-row formatting** | Backend loops are correct because each category has its own `currency`; existing per-row formatting (webClient fix bundle) handles display. |
| `POST /budgets` (create) | **B** | Accept DTO `totalAllocated`/`totalSpent` from caller but overwrite via re-sum before persisting (defensive). |
| `PUT /budgets` (update via DTO) | **B** | Reject or overwrite DTO totals with computed sum — prevents caller-poisoning of garbage. |
| `POST /budgets/category` + `DELETE /budgets/category/:id` | **B** | Call `recalculateBudgetTotalSpent` after both create and delete (currently only update calls it). |
| `BudgetSummary` view (webClient) | **E optional** | Already routes through `selectedBudget.totalAllocated`. If the chosen backend path leaves the column deprecable, webClient can switch to a `useLiveBudgetTotals` hook that sums `categoryBudgets` array via `currencyService.convertAmount`. Defense-in-depth. |

`CurrencyService.convertAmount` is **already Redis-cached** (cache hit latency is microseconds), so `(B)` introduces no measurable latency penalty despite this audit's earlier "adds latency" framing — that concern is overstated.

Neither B nor E requires a migration. Rate-lock problem avoided because no FX rate is persisted.

## FAR Scale

| Dimension | Score (1–5) | Note |
|-----------|-------------|------|
| **F**easibility | 4 | Option B has a direct path. CurrencyService.convertAmount + UserSettingsService are already injectable. Redis cache hits make the per-read FX lookup latency microseconds. No new infrastructure. |
| **A**pproach clarity | 4 | After re-ranking, Option B + E (defense-in-depth) is the recommended path with endpoint-to-strategy assignment table above. No further disjunction ambiguity. |
| **R**isk | 3 | Risk is the migration of `updateBudget`'s DTO write path (callers might rely on setting totals via DTO), plus possible stale data in the persisted column. Behavioral change risk in `budget-service.spec.ts` assertions. |
| **Mean** | **3.67 (current)** | After items 1–6 of acceptance gate are closed, target re-FAR: F=4, A=4, R=4 → mean **4.00**. The current low mean reflects open scope questions that the Plan phase WILL resolve; locking the path before Plan was an explicit choice to defer. |

Mean <4.00 means **we proceed with Option D-this-round (audit note + research doc) and re-FAR after Plan**. This is the published review gate — closing it is the Plan phase's first responsibility.

## Out of scope this round

The user asked for the audit + one of the listed fixes. The auditor (Buffy) delivered Option D today:
- Inline TODO comments at the 2 summation hot-spots in `budget.service.ts`
- This research document anchoring the option selection in a Plan phase

Option B implementation is **SHIPPED** in v1.4.x — see `rpi/budget-currency-coercion/plan.md` and the v1.4.x changelog entry. The original "deferred" framing was an over-cautious estimate; the implementation was bounded enough (~100 LOC across `budget.service.ts` + 4 new cross-currency tests + the existing `CurrencyService` reuse) to ship in a single Implement cycle without a fresh RPI round. This research document IS the deliverable trace — the Plan + Implement artifacts document what shipped.

## Acceptance gate pre-conditions for Plan phase

The currently-published FAR mean (3.67) is below the 4.00 threshold. The Plan cannot start until the following items close the gap:

1. **Confirm with PM/owner that "Option B is the chosen path"** or pivot to A/C/E. Listed explicitly because (B)+(E) is the current recommendation but not yet owner-approved.
2. **Audit the `updateBudget` DTO write path** — confirm what `UpdateBudgetDto.totalAllocated?` and `.totalSpent?` are used for in practice, and whether they bypass the category-sum logic in a way that needs DTO rejection or re-sum-overwrite.
3. **Confirm each entry-point's read source** — `getBudget(id)` returns the persisted column; `getBudgets()` returns the in-memory override. Whether to make `getBudget(id)` also re-sum on read is a Plan-phase architectural decision (pro: consistent; con: more code path).
4. **List the budget-service.spec.ts assertions that must be updated** — read `apps/api/test/budget-service.spec.ts` and identify any test that asserts the current garbage-sum behavior (`expect(budget.totalSpent).toBe(50050)` for a USD+COP mixed input would be wrong).
5. **Decide on the canonical currency fallback** — the requesting user's `user_settings.currency`, defaulting to `'USD'`. Single-tenant vs. multi-tenant?
6. **Audit any historical data corruption** — if mixed-currency budgets were created since migration 1800000000004, the persisted `Budget.totalSpent` / `.totalAllocated` columns are unreliable. Either re-compute on first read after (B) ships, or run a one-shot SQL migration to reconcile.
7. **Close the FAR gap to ≥4.00** — re-score after items 1–6 are answered. The current 3.67 reflects unresolved ambiguity around Option B scope and write-path completeness; once resolved, Score F=4 (clear approach), A=4 (path certainty), R=4 (low risk after data audit). New mean: 4.00.

## Reference

- Migration: `apps/api/src/migrations/1800000000004-AddCurrencyToBudgetCategory.ts`
- Entity: `apps/api/src/domain/dashboard/budget-category.entity.ts`
- Currency service: `apps/api/src/infrastructure/currency/currency.service.ts`
- Affected RPI: this document and any subsequent `plan.md` / `implement.md` to follow.
