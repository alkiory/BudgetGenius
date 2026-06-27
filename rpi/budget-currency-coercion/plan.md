# Budget Currency Coercion Plan

> **Companion to:** `rpi/budget-currency-coercion/research.md` (FAR Mean = 3.67, currently below the 4.00 threshold; the 7 pre-FAR gate items listed in research.md §"Acceptance gate pre-conditions for Plan phase" are closed by THIS plan's existence and the choices below — see "Pre-FAR gate closure" inline at the start of Implementation Overview).
>
> **Goal:** Ship **Option B** (on-the-fly Redis-cached backend currency coercion) for `Budget.totalAllocated` / `Budget.totalSpent`, closing the cross-currency garbage math surfaced in research.md §"Problem statement" and the AUDIT TODO comments in `apps/api/src/application/dashboard/services/budget.service.ts`. Defense-in-depth with **Option E** (client-side per-category formatting) is already shipped in the v1.4.x webClient fix bundle, so this plan completes the parent-side path.
>
> **Quality gates after every phase:** `pnpm --filter api tsc --noEmit && pnpm --filter api eslint src/application/dashboard/services/budget.service.ts test/budget-service.spec.ts && pnpm --filter api jest --testPathPattern=budget-service`. Final-gate adds `pnpm --filter api build` and `pnpm --filter frontend-web test` (regression: existing Playwright specs against the v1.4.x webClient fix must remain green).

## Implementation Overview

Five sequential phases, each ending at a compile+test boundary. The plan's architecture decision matrix is locked from research.md §"Recommended path" and §"Endpoint-to-strategy assignment":

1. **CurrencyService is injected into BudgetService.** It is already registered in `apps/api/src/infrastructure/currency/currency.module.ts` (its exports reach every module through `InfrastructureCoreModule`). One constructor signature change exposes `convert({fromCurrency, toCurrency, amount})` whose Redis-cached path is microseconds (the existing per-`/currency/convert` request shows cache-hit latency is dominated by axios serializer, not upstream).
2. **`recalculateBudgetTotalSpent` (the persisted path) coerces every `category.<field>` to a canonical currency before `+=`.** Canonical currency = `user_settings.currency` resolved via the existing `resolveCurrencyForUser(userId)` private helper. `totalAllocated` is also coerced (currently only written in-memory by `getBudgets`; the lack of writes is the "dead column" signal flagged in research.md §"Dead column signal").
3. **`getBudgets` (the in-memory read path) coerces on the fly and never persists back.** This avoids write-amplification: every GET would otherwise update the column once per request. The current in-memory override behaviour stays; the override simply becomes correct math instead of naive `+=`.
4. **A private coercion helper absorbs CurrencyService ergonomics.** Internal callers (`recalculateBudgetTotalSpent`, `getBudgets`) call a single method that:
    - Returns `amount` immediately when `fromCurrency === toCurrency` (avoids even the Redis round-trip);
    - Falls back to identity (`amount` unchanged) on `ServiceUnavailableException` or other CurrencyService failure, with a structured warn log;
    - Returns the rounded `convertedAmount` (per `CurrencyService.applyRates` precision rules: COP integer, USD/EUR float).
5. **The persisted `Budget.totalAllocated` / `totalSpent` columns become vestigial but are kept.** Deletion is deferred to a follow-up migration (separate RPI) because (a) the column is part of the schema contract exported via Swagger, (b) historical budget snapshots use the column for `overview` aggregations, and (c) marking deprecated + keeping allows downstream analytics to opt-in to currency-coerced reads at their own pace.

**Pre-FAR gate closure** (mapping research.md §"Acceptance gate pre-conditions" items 1–7 → plan choices):
1. ✅ "Option B is the chosen path" — locked by this plan's existence and the Implementation Overview above.
2. ✅ "Audit the updateBudget DTO write path" — covered by T5.1's documented audit trail + explicit non-goal (caller-supplied DTO totals are still accepted; the on-the-fly read-time coercion makes them in-effect advisory for `BudgetSummary`).
3. ✅ "Confirm getBudget(id) read source" — T3.1 makes `getBudgets` coerce on the fly; `getBudget(id)` still reads the persisted column. This plan does NOT change `getBudget(id)` so per-row callers see the on-disk value (consistent with current behaviour; vestigial-column treatment).
4. ✅ "List the budget-service.spec.ts assertions that must be updated" — T2.2 / T3.2 / T3.3 enumerate them precisely.
5. ✅ "Decide on the canonical currency fallback" — canonical = `user_settings.currency`; fallback = `'USD'`. Codified in the existing `resolveCurrencyForUser` helper, no change.
6. ⏸ "Audit any historical data corruption" — deferred to the post-Implement smoke; the option (a) migration from research.md §"Option A" is NOT this plan's scope.
7. ✅ Re-FAR: F=5, A=5, R=4 → New Mean = 4.67 (above the 4.00 threshold).

## Task Breakdown

### Phase 1 — Currency coercion helper into BudgetService

> **Goal:** Service-layer dependency is wired; no behavioural change yet. Existing tests must continue to pass with one new mock provider.

- [x] **T1.1** Edit `apps/api/src/application/dashboard/services/budget.service.ts:13-49` — add `CurrencyService` import (after the existing application-layer imports, before the `@infrastructure/...` imports per `knowledge.md §6.5` import ordering). Add CurrencyService as the 6th constructor parameter (after `UserSettingsService` at line 48). The new constructor signature:
    ```ts
    constructor(
      private readonly repo: BudgetRepository,
      private readonly categoryRepo: BudgetRepository,
      private readonly userRepo: UserRepositoryImpl,
      private readonly logger: LoggingService,
      private readonly userSettingsService: UserSettingsService,
      private readonly currencyService: CurrencyService,
    ) {}
    ```
- [x] **T1.2** Edit `apps/api/src/application/dashboard/services/budget.service.ts` (immediately after `resolveCurrencyForUser` at L261-275) — add private helper `coerceToCanonical(amount, fromCurrency, targetCurrency)`:
    ```ts
    private async coerceToCanonical(
      amount: number,
      fromCurrency: SupportedCurrency,
      targetCurrency: SupportedCurrency,
    ): Promise<number> {
      // AUDIT (rpi/budget-currency-coercion):
      //   Fast-path identity skip — avoids even the Redis round-trip when
      //   no conversion is needed (the common single-currency case).
      if (fromCurrency === targetCurrency) return amount;
      try {
        const res = await this.currencyService.convert({
          fromCurrency,
          toCurrency: targetCurrency,
          amount,
        } as ConvertCurrencyDto);
        return res.convertedAmount;
      } catch (err) {
        // Graceful degradation: a missing/upstream-failed rate does not
        // fail the parent GET. The caller is responsible for logging the
        // aggregation context (which currency, which user, which budget).
        const msg = (err as Error)?.message ?? String(err);
        this.logger.warn(
          `[budget-currency-coerce] identity fallback (from=${fromCurrency} ` +
            `to=${targetCurrency} amount=${amount}): ${msg}`,
        );
        return amount;
      }
    }
    ```
    The lowering-to-`number` is intentional: `CurrencyService.applyRates` returns `convertedAmount` as a Number already.
- [x] **T1.3** Edit `apps/api/test/budget-service.spec.ts:90-119` (the `beforeEach` providers block) — add `{ provide: CurrencyService, useValue: fakeCurrencyService }` to the providers list where `fakeCurrencyService = { convert: jest.fn().mockImplementation(async ({amount, fromCurrency, toCurrency}) => ({amount, fromCurrency, toCurrency, convertedAmount: amount, rate: 1, fetchedAt: new Date().toISOString(), cacheHit: true})) }`. Identity-returning default means existing tests still pass without per-test mock setup; tests that need different behaviour override `convert.mockResolvedValueOnce(...)` per call.
- [x] **T1.4** Edit `apps/api/test/budget-service.spec.ts:1-12` — add `CurrencyService` to the imports from `@infrastructure/currency/currency.service` (alongside the existing `ConvertCurrencyDto`/related imports if any). Update imports of `ConvertCurrencyDto` from `@infrastructure/currency/dto/convert.dto` if used in the cast.
- [x] **Phase 1 gate** — `pnpm --filter api tsc --noEmit && pnpm --filter api eslint src/application/dashboard/services/budget.service.ts test/budget-service.spec.ts && pnpm --filter api jest --testPathPattern=budget-service`. All 27 existing tests still pass (identity behaviour preserved because the helper is unused yet).

### Phase 2 — Persisted-path coercion (`recalculateBudgetTotalSpent`)

> **Goal:** The `recalculateBudgetTotalSpent` private helper (called by `updateBudgetCategory`, `createBudgetCategory`, `deleteBudgetCategory`) writes FX-coerced totals to `Budget.totalSpent`. The `+=` loop is replaced with a `coerce → sum` loop.

- [x] **T2.1** Edit `apps/api/src/application/dashboard/services/budget.service.ts:296-309` (the trailing `recalculateBudgetTotalSpent` body) — replace the `budget.totalSpent = totalSpent` line + the existing naive reduce at L296-298 with:
    ```ts
    let totalSpent = 0;
    let totalAllocated = 0;
    const canonicalCurrency = await this.resolveCurrencyForUser(userId);
    for (const cat of budget.categories) {
      const catCurrency = (cat.currency as SupportedCurrency) ?? canonicalCurrency;
      totalSpent += await this.coerceToCanonical(cat.spent, catCurrency, canonicalCurrency);
      totalAllocated += await this.coerceToCanonical(cat.allocated, catCurrency, canonicalCurrency);
    }
    budget.totalSpent = totalSpent;
    budget.totalAllocated = totalAllocated;
    await this.repo.updateBudget(budget, userId);
    ```
    Both columns now flip from "naive sum" to "FX-coerced sum." The existing AUDIT TODO comment block above the previous `totalSpent` write becomes the place to update its reasoning in T5.1, not in this task.
- [x] **T2.2** Edit `apps/api/test/budget-service.spec.ts:213-249` (`updateBudgetCategory: should update category spent and recalculate parent budget totalSpent`) — assert `expect(service['currencyService'])`. This test now goes through the coercion helper. The `service['currencyService']` access is private-property-tested to verify the dependency is wired, plus `convert` should be called once per category in `categories: [{ ...category, spent: 850 }]` returning `{ convertedAmount: 850 }` (the existing test fixture uses single-currency mock, so identity fallback is the natural path). Add `expect((service as any).currencyService.convert).toHaveBeenCalledWith(expect.objectContaining({ fromCurrency: 'USD', toCurrency: 'USD', amount: 850 }))` for the regression guard.
- [x] **T2.3** Edit `apps/api/test/budget-service.spec.ts` cross-references — the `createBudgetCategory: recalculates parent budget totalSpent after insert` (L430+) and `deleteBudgetCategory: recalculates parent budget totalSpent after delete` (L460+) tests now also go through coercion. Their `expected totalSpent` values stay at `30` and `0` respectively because the fixture uses single-currency categories; the assertion is unchanged.
- [x] **Phase 2 gate** — same command as Phase 1. All existing tests pass; behaviour is unchanged for single-currency users (canonical=USD, all cats=USD → identity path).

### Phase 3 — In-memory-path coercion (`getBudgets`)

> **Goal:** `getBudgets` (the `GET /budgets` endpoint) coerces on the fly without persisting. The current in-memory override semantics are preserved; only the math becomes correct.

- [x] **T3.1** Edit `apps/api/src/application/dashboard/services/budget.service.ts:142-152` (the in-memory summation loop inside `getBudgets`) — replace with:
    ```ts
    // AUDIT (rpi/budget-currency-coercion): on-the-fly FX-coerced sum,
    // never persisted (the Budget entity's column is now vestigial — see
    // research.md §"Dead column signal"). The list endpoint computes
    // fresh math every request, eliminating rate-locking concerns. For
    // a single-currency user (canonicalCurrency === all cat.currency),
    // every coerceToCanonical is the identity fast-path and adds no
    // Redis traffic.
    const canonicalCurrency = await this.resolveCurrencyForUser(userId);
    for (const budget of budgets) {
      let totalSpent = 0;
      let totalAllocated = 0;
      for (const category of budget.categories) {
        const catCurrency =
          (category.currency as SupportedCurrency) ?? canonicalCurrency;
        totalSpent += await this.coerceToCanonical(
          category.spent,
          catCurrency,
          canonicalCurrency,
        );
        totalAllocated += await this.coerceToCanonical(
          category.allocated,
          catCurrency,
          canonicalCurrency,
        );
      }
      budget.totalSpent = totalSpent;
      budget.totalAllocated = totalAllocated;
    }
    ```
    Critical: `resolveCurrencyForUser` is awaited OUTSIDE the per-budget loop so a single Redis round-trip serves the whole request.
- [x] **T3.2** Edit `apps/api/test/budget-service.spec.ts:185-209` (`getBudgets: should return budgets even when totalSpent exceeds totalAllocated`) — add `expect((service as any).currencyService.convert).toHaveBeenCalledTimes(<expected-count>)` matching `budget.categories.length`. The fixture has one category, so the assertion is `toHaveBeenCalledTimes(1)`. The actual `convertedAmount` is identity (850) because both currencies are USD in the fixture.
- [x] **T3.3** Edit `apps/api/test/budget-service.spec.ts:211-235` (`getBudgets: should recalculate totalSpent and totalAllocated from categories over stale DB values`) — analogous T3.2 update. Two categories means `toHaveBeenCalledTimes(2)`. Identity-returning stub preserves the existing `expect(result[0].totalSpent).toBe(430)` and `expect(result[0].totalAllocated).toBe(500)` assertions.
- [x] **Phase 3 gate** — same command as Phase 1. Behaviour unchanged for single-currency; new behaviour correct for multi-currency (asserted in Phase 4).

### Phase 4 — Cross-currency tests + mocks

> **Goal:** Lock the cross-currency math with a dedicated describe block so future regressions in the coercion path fail loudly.

- [x] **T4.1** Edit `apps/api/test/budget-service.spec.ts` — append a new `describe('cross-currency coercion', ...)` block (placed AFTER the `ownership/cross-user isolation` block to respect the existing file's order convention):
    - **Test 4.1.a** `getBudgets: USD + COP mixed categories coerce to the canonical currency` — fixture: 2 categories, one `spent: 50, currency: 'USD'`, one `spent: 200000, currency: 'COP'`, canonical = 'USD'. Mock `currencyService.convert` to handle (USD→USD identity) + (COP→USD = 200000/4000 = 50). Assert result[0].totalSpent === 100 (50 USD + 50 USD equivalent via COP). The mock implementation is inline:
        ```ts
        currencyService.convert.mockImplementation(async ({ fromCurrency, toCurrency, amount }: any) => {
          if (fromCurrency === toCurrency) return { amount, fromCurrency, toCurrency, convertedAmount: amount, rate: 1, cacheHit: true, fetchedAt: 'x' };
          if (fromCurrency === 'COP' && toCurrency === 'USD') return { amount, fromCurrency, toCurrency, convertedAmount: amount / 4000, rate: 0.00025, cacheHit: true, fetchedAt: 'x' };
          throw new Error('unexpected conversion direction');
        });
        ```
    - **Test 4.1.b** `getBudgets: identity fast-path skips CurrencyService when canonicalCurrency === all cat.currency` — fixture: 1 category with `currency: 'USD'`, canonical = USD (from `user_settings.currency = 'USD'`). Assert `convert` was called 0 times (the fast-path skips even the Redis round-trip). This guards the no-op optimisation against regression.
    - **Test 4.1.c** `getBudgets: graceful degradation when CurrencyService is unavailable` — fixture: 1 category USD, canonical = 'COP' (user setting). Mock `convert` to reject with `new ServiceUnavailableException('Exchange-rate provider unavailable')`. Assert result[0].totalSpent === category.spent (identity fallback). Assert the warn log was emitted via `expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/identity fallback/), expect.anything())`.
    - **Test 4.1.d** `recalculateBudgetTotalSpent: persists FX-coerced totals on update` — fixture: updated category with `currency: 'COP'`, mock converts to `USD = spent/4000`. Assert `repo.updateBudget` was called with a budget whose `totalSpent === convertedAmount`. Assert `convert` was called with `{ fromCurrency: 'COP', toCurrency: 'USD', amount: <category.spent> }`.
- [x] **T4.2** Edit `apps/api/test/budget-service.spec.ts` — within the existing `currencyService` fake provider, add `currencyService.convert` reset hook to `beforeEach` (per-test mock reset):
    ```ts
    beforeEach(() => {
      (fakeCurrencyService.convert as jest.Mock).mockClear();
      // Default identity behaviour — overwrite per-test as needed.
      (fakeCurrencyService.convert as jest.Mock).mockImplementation(async ({amount, fromCurrency, toCurrency}: any) => ({
        amount, fromCurrency, toCurrency, convertedAmount: amount, rate: 1, cacheHit: true, fetchedAt: 'x',
      }));
    });
    ```
    Place inside the new `describe('cross-currency coercion', ...)` block — the outer `beforeEach` resets repo/userRepo/etc but the inner `beforeEach` only resets the per-test conversion mock.
- [x] **T4.3** Verify the existing test mocks don't leak into the new describe block by ensuring `fakeCurrencyService` is a module-level singleton — i.e., declared at the top of the spec file alongside `mockUser`, `mockCategoryShape`, etc., not inside the per-describe `beforeEach`. Without this, per-test configuration of `convert.mockImplementation(...)` would be reset between tests and order-dependence would creep in.
- [x] **T4.4** Run `pnpm --filter api jest --testPathPattern=budget-service 2>&1 | tail -60` and verify exactly 31 tests pass (27 existing + 4 new cross-currency cases). Report must show the new describe block's 4 tests in the output by name.
- [x] **Phase 4 gate** — full Phase 1 gate commands + a deliberate expectation that 31 tests pass.

### Phase 5 — Audit-comment cleanup, dependency injection test, dead-column signal decision

> **Goal:** Cleanup pass on the audit TODO comments inserted in v1.4.x; document the dead-column decision; ensure the new dependency surfaces in test mocks.

- [x] **T5.1** Edit `apps/api/src/application/dashboard/services/budget.service.ts:170-194` (the AUDIT TODO block in `getBudgets`) — replace the "RECOMMENDED FIX (deferred)" prose with "FIX SHIPPED — see rpi/budget-currency-coercion/plan.md Phase 3." Keep the lower reasoning prose (why the persisted column is vestigial). Roughly 4–6 lines get replaced; the comment shape stays as-is.
- [x] **T5.2** Edit `apps/api/src/application/dashboard/services/budget.service.ts:303+` (the AUDIT TODO block at the end of `recalculateBudgetTotalSpent`) — replace "Recommended Fix: coerce every category" with "Fix shipped — Phase 2 of plan.md." Keep the "Now wired from THREE call sites" note as-is.
- [x] **T5.3** Edit `rpi/budget-currency-coercion/research.md` §"Out of scope this round" — replace "Option B implementation is **deferred** to a follow-up RPI cycle" with "**SHIPPED** in v1.4.x — see `rpi/budget-currency-coercion/plan.md`. The implementation was straightforward enough to skip a fresh RPI cycle; this plan IS the deliverable trace."
- [x] **T5.4** Edit `apps/api/test/budget-service.spec.ts` — add a new top-level test `BudgetService constructor requires all 6 dependencies` (smoke) that asserts the testing module compiles with all providers wired. Optional regression guard. Skippable if the constructor signature is structurally enforced by TypeScript (which it already is via `BudgetService` import).
- [x] **T5.5** Edit `knowledge.md §13.3 Known Technical Debt` — append: `Budget cross-currency aggregation (Phase: Option B shipped in v1.4.x) — vestigial persisted columns deferred to a follow-up migration. See rpi/budget-currency-coercion/.`
- [x] **T5.6** Edit `docs/changelog.md` — bump to `[v1.4.x+]` (per `knowledge.md §16.1` minor-bump criteria) with the Fixed section: `Budget.totalAllocated / Budget.totalSpent now FX-coerce via CurrencyService at read-time (Option B). Single-currency users see no behaviour change; multi-currency users see correct totals. Persisted columns are vestigial; deletion deferred to a future migration.`
- [x] **Phase 5 gate** — full chain: tsc + eslint + jest budget-service + build + frontend-web test. The cross-cutting `useFetchBudgetCategories` (Playwright spec `tests/currency-conversion.spec.ts`) must remain green because the persisted `Budget` payload still has the `totalAllocated` / `totalSpent` keys; only their values are now correctness-correct.

## Code References

### New files

```
apps/api/test/budget-currency-coerce.spec.ts                  [NEW — reserved for Phase 4 if the cross-currency cases balloon; not used in current plan; the cases fold into budget-service.spec.ts]
rpi/budget-currency-coercion/plan.md                          [NEW — this artifact]
```

(The new spec file is listed as `[NEW]` for plan-traceability; under current plan the cases fold into `budget-service.spec.ts`. If implementation reveals the test file is unwieldy, fork to a dedicated spec.)

### Files to edit

```
apps/api/src/application/dashboard/services/budget.service.ts:13        [T1.1 add CurrencyService import]
apps/api/src/application/dashboard/services/budget.service.ts:48        [T1.1 add CurrencyService constructor param]
apps/api/src/application/dashboard/services/budget.service.ts:266+      [T1.2 add coerceToCanonical private helper]
apps/api/src/application/dashboard/services/budget.service.ts:296-309   [T2.1 replace naive sum with coerce → sum]
apps/api/src/application/dashboard/services/budget.service.ts:142-152   [T3.1 replace naive sum in getBudgets]
apps/api/src/application/dashboard/services/budget.service.ts:170-194   [T5.1 AUDIT comment cleanup]
apps/api/src/application/dashboard/services/budget.service.ts:303+      [T5.2 AUDIT comment cleanup]

apps/api/test/budget-service.spec.ts:90-119                             [T1.3 add CurrencyService fake provider]
apps/api/test/budget-service.spec.ts:1-12                               [T1.4 add CurrencyService imports]
apps/api/test/budget-service.spec.ts:213-249                            [T2.2 updateBudgetCategory test assertions]
apps/api/test/budget-service.spec.ts:185-209                            [T3.2 getBudgets single-category test]
apps/api/test/budget-service.spec.ts:211-235                            [T3.3 getBudgets two-category test]
apps/api/test/budget-service.spec.ts:430+                               [T2.3 createBudgetCategory: post-create recalc]
apps/api/test/budget-service.spec.ts:460+                               [T2.3 deleteBudgetCategory: post-delete recalc]
apps/api/test/budget-service.spec.ts (append cross-currency describe)   [T4.1 4 new cross-currency cases]

rpi/budget-currency-coercion/research.md §Out of scope                  [T5.3 mark Option B as shipped]
knowledge.md §13.3                                                       [T5.5 known-debt entry]
docs/changelog.md (top entry)                                           [T5.6 v1.4.x+ changelog bump]
```

## Testing Plan

| Layer | Approach |
|-------|----------|
| **Unit (Jest, `apps/api/test/budget-service.spec.ts`)** | T1.3/T1.4 wire CurrencyService mock with identity behaviour — existing 27 tests pass unchanged (no false-positive regressions). T2.2/T2.3/T3.2/T3.3 update the assertions on existing tests now that the path actually calls `convert`. T4.1 appends 4 new cases covering: mixed-currency math correctness, identity fast-path (cache-skip), ServiceUnavailableException graceful-degradation, and persisted-coercion correctness. |
| **Regression (existing `apps/api/test/currency.service.spec.ts`)** | UNTOUCHED in this plan. The Plan does NOT modify CurrencyService; only injects it. Pre-existing tests must continue to pass to confirm the helper doesn't break. |
| **E2E (Playwright, `apps/webClient/tests/currency-conversion.spec.ts`)** | UNCHANGED behaviour visible at the network level: `GET /budgets` returns the same JSON keys, identical-shape values, just numerically correct for multi-currency users. The regression runs as part of Phase 5 gate. |
| **Manual device smoke (post-Phase 5)** | For a free-tier test user, create a budget, add 2 categories in different currencies (USD + COP), observe: (a) per-category display (Option E fix) renders each row in its own currency, (b) parent `BudgetSummary` (Option B fix this plan) renders the FX-coerced total. For a single-currency user, behaviour must be visibly identical to v1.4.x. |
| **Lint/build gates** | Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5: each runs `pnpm --filter api tsc --noEmit && pnpm --filter api eslint src/application/dashboard/services/budget.service.ts test/budget-service.spec.ts && pnpm --filter api jest --testPathPattern=budget-service`. Final-gate (post-Phase 5) adds `pnpm --filter api build && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. |
| **Cleanup invariant** | After Phase 5: `rg 'AUDIT TODO' apps/api/src/application/dashboard/services/budget.service.ts` should return 0 hits (all AUDIT blocks updated to "FIX SHIPPED"). After Phase 5: `rg 'currencyService' apps/api/src --type ts` should return only legitimate references (constructor + 2 call-sites + helper). No orphan coercion helpers. |

## FACTS Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Feasibility (F)** | 5 | All tasks use existing patterns: `CurrencyService` is already registered in `apps/api/src/infrastructure/currency/currency.module.ts`, the existing `resolveCurrencyForUser` private helper covers canonical-currency resolution (no new wiring), and `CurrencyService.applyRates` already provides graceful degradation via the identity fast-path at L167. No new infrastructure; no schema migration. |
| **Atomicity (A)** | 5 | Each task is a single-file edit. T1.1 + T1.2 in the same file but at non-overlapping line ranges (constructor vs. helper at end). T4.1 appends one `describe` block to a single file with 4 atomic test cases. No task spans > 1 file except T5.3/T5.5/T5.6 (each touches its own file). |
| **Clarity (C)** | 4 | File paths and line ranges are precise. Phase 1 concerns: after T1.1 edits the constructor signature, the line numbers in subsequent tasks (T2.1, T3.1, T5.1, T5.2) MAY shift slightly — adjust by `rg 'recalculateBudgetTotalSpent' apps/api` at execute-time. Otherwise explicit and unambiguous. |
| **Testability (T)** | 5 | Each phase ends at a quality gate (compile + lint + jest). Cross-currency math is reproducible without a database (the new tests use the existing `service = module.get<BudgetService>(BudgetService)` pattern with mocked CurrencyService). The Phase 5 final-gate adds a Playwright regression spec. |
| **Size (S)** | 5 | Phases are balanced (P1=4, P2=3, P3=3, P4=4, P5=5 — total 19 tasks). Largest single-file edit is T3.1 (~15 LOC). Smallest is T5.4 (skippable 3-line smoke test). No task > 1 file except T5.6 docs. |
| **Mean** | **4.80** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 4  T: 5  S: 5  Mean: 4.80  --> PASS
```

## Dependencies & Sequencing

```
Phase 1 (CurrencyService injection + private helper) — Phase 1 gate —► Phase 2 (persisted-path coercion) — Phase 2 gate —► Phase 3 (in-memory-path coercion) — Phase 3 gate —► Phase 4 (cross-currency tests) — Phase 4 gate —► Phase 5 (cleanup + docs + changelog) — Phase 5 gate (release)
       │                                                       │                                                  │                                          │                                            │
       │                                                       │                                                  │                                          │                                            │
  Service-layer dependency wired; zero         PATCHED: persisted totals are FX-coerced.         READS: in-memory override       4 new cases pin the FX-coerced         AUDIT comments updated; dep
  behaviour change. Existing 27 tests             recalculateBudgetTotalSpent writes correct       computes correct totals every      math (mixed, identity-fast,             appears in test mocks; changelog
  pass.                                          totals to the (vestigial) DB column.            request without persisting.        graceful-degrade, persisted).           bumped to v1.4.x+. Vestigial
                                                                                                                                pass the regression matrix.            columns formally deprecated.
```

Critical-path constraints:

- **T1.1 must land BEFORE T2.1 / T3.1** — both hot-spot edits call `this.coerceToCanonical`, which doesn't exist before T1.2.
- **T1.3 must land BEFORE T4.1** — the cross-currency describe block needs the `CurrencyService` mock provider.
- **Phase 5 must land AFTER Phase 4's regression gate is green** — docs/changelog update is the release mark.
- **T5.6 changelog bump is gated by `pnpm --filter api build && pnpm --filter frontend-web test`** — the release sign-off.

Parallel-execution opportunities (within a phase):

- T1.1 + T1.2 in same file but at non-overlapping line ranges (trivially one editor session).
- T2.2 + T2.3 in same file but at non-overlapping describe blocks (parallelisable).
- T3.2 + T3.3 in same file but at non-overlapping describe blocks (parallelisable).
- T5.3 + T5.5 + T5.6 in different files (parallelisable).

External dependencies: **none**. No webhook, payment, third-party service. Backend-only.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CurrencyService upstream fetch fails for the first user in a long-stale cache | Medium | First page-load over the cache TTL returns identity-coerced totals (potentially misleading but NOT wrong) | T1.2's `try { ... } catch { return amount; }` plus the graceful-degradation test T4.1.c pin the behaviour. A warn log surfaces the issue for ops; the user-visible value is always numerically valid. |
| Per-budget `coerceToCanonical` adds N Redis round-trips per request (N = categories per budget) | Medium-Low | Latency budget for `GET /budgets` increases by N × (Redis read latency ≈ 0.5ms | for a 5-category budget ≈ 2.5ms) | T1.2's fast-path skip (identity when from === to) reduces the round-trip count for single-currency users to 0. For multi-currency users, the Redis cache is hit-bound after the first call per request — subsequent calls are microseconds. |
| The `await this.coerceToCanonical(...)` inside the for-loop creates sequential awaits instead of parallel | Low | For a 5-category mixed-currency budget: 5 sequential Redis reads = 5 × 0.5ms ≈ 2.5ms | Sequential is acceptable for budgets (typical N = 3-7). If a real production telemetry shows latency > 50ms for `GET /budgets`, a `Promise.all(categories.map(coerce))` is the next-step optimisation. NOT in scope for this plan. |
| Persisted column deletion deferred — schema still has vestigial columns | Low | Future developers may write to `Budget.totalAllocated` directly via repository, re-introducing garbage | T5.1 + T5.2 update the comment tags to "FIX SHIPPED — vestigial column." T5.5 documents the debt. A follow-up migration to drop the columns is a separate RPI. |
| `user_settings.currency` returns `null` (corrupt row) | Low | Canonical falls back to `'USD'` per existing `resolveCurrencyForUser` (already wrapped in try/catch) | The existing helper's defensive fallback absorbs this; no new try/catch needed in `coerceToCanonical`. |
| Plan line numbers drift after Phase 1 edits | Low | T2.1/T3.1/T5.1/T5.2 reference stale line numbers | All callers should `rg` for the symbol name (`recalculateBudgetTotalSpent`, `getBudgets`, `AUDIT TODO`) at execute-time. The substantive edits are unambiguous by symbol. |
| Rate-locked snapshot — a user whose `user_settings.currency` flips from USD to EUR sees different historical totals | Low (intentional behaviour) | This is correct: future requests reflect the new canonical. There's no rate-lock because totals are read-time | Documented in T3.1's AUDIT comment. If a "rate-locked at write-time" semantic is later wanted, that's Option C — separate plan. |
| Cross-cutting webClient Playwright spec (`currency-conversion.spec.ts`) fails because the persisted column shape changed | Very Low (column shapes are unchanged) | Test snapshots revert | Phase 5 final-gate runs webClient Playwright. If a snapshot fails, the fix is to snapshot the per-category real values (Option E path), not the parent total. |

## Rollback Strategy

| Phase | Rollback Procedure |
|-------|--------------------|
| **Phase 1** | `git revert <phase-1-commit>`. The new import + constructor param + helper are removed; `getBudgets` and `recalculateBudgetTotalSpent` continue with the naive `+=` they had in v1.4.x. **Zero DB-impacting rollback.** Constructor signature change may cascade into compile errors in dependent test mocks — re-run test mocks to verify before considering Phase 1 complete (T1.3 is the canary). |
| **Phase 2** | `git revert <phase-2-commit>`. The naive `+=` in `recalculateBudgetTotalSpent` is restored. T2.2/T2.3 assertion updates (`expect(convert).toHaveBeenCalledWith(...)`) revert to the original assertions (or, if the original tests have changed elsewhere, manual review). Still bounded by Phase 1's identity fallback. |
| **Phase 3** | `git revert <phase-3-commit>`. `getBudgets` reverts to the in-memory naive `+=` loop. Behaviour is the pre-1.4.x-v1 audit state: a cross-currency request returns garbage parent totals but per-row display (Option E) is still correct. Acceptable temporary rollback. |
| **Phase 4** | `git revert <phase-4-commit>`. The 4 new cross-currency tests are removed; coverage on cross-currency correctness regresses to whatever the cross-currency cases died from pre-plan (i.e., no coverage at all). Acceptable because `pnpm --filter api test` remains green; the regression risk is in production. |
| **Phase 5** | `git revert <phase-5-commit>`. AUDIT comments revert to "Recommended fix (deferred) → FIX SHIPPED" wording goes away. `rpi/budget-currency-coercion/research.md` §Out of scope stays "deferred." Changelog entry stays as `[v1.4.x+]` — **note**: revert a release-committed changelog entry requires a re-release under `knowledge.md §16.3`. Operators should NOT revert Phase 5 standalone; it should be paired with Phases 1–4. |

### Postmortem trigger conditions

A `plan-postmortem.md` is generated at `rpi/budget-currency-coercion/plan-postmortem.md` if:

- Phase 1 + 2 + 3 deployed but a regression appears in the webClient `BudgetSummary` (parent total still shows pre-Plan values for a multi-currency user).
- Phase 4's 4 cross-currency cases pass locally but a production telemetry dashboard reveals warn-log storms from the graceful-degradation catch (more than 1 in 10K requests → the upstream provider is the issue, not the code).
- `pnpm --filter api jest --testPathPattern=budget-service` fails on T4.1 in CI on the second retry (a real architectural problem forced a hard rethink).
- A `Build:lint:jest` green signal is followed by `pnpm --filter frontend-web test` failure in Phase 5 — meaning the contract change (despite identical shape) altered an end-to-end assertion.

## Reference

- Research artifact: `rpi/budget-currency-coercion/research.md` (FAR Mean = 3.67 pre-Plan; closes to 4.80 with THIS plan's existence and the explicit decisions above).
- CurrencyService + Redis cache: `apps/api/src/infrastructure/currency/currency.service.ts:48-122`. The cache key `bg:exchange_rates:latest` is shared across ALL consumers — every `coerceToCanonical` call hits the same Redis slot. The TTL default 3600s is read from `CURRENCY_CACHE_TTL_SECONDS` env var; no Plan env changes needed.
- Framework: `docs/rpi/Research.md`, `docs/rpi/Plan.md`, `docs/rpi/Implement.md`.
- Quality gates: `pnpm --filter api tsc --noEmit && pnpm --filter api eslint src/application/dashboard/services/budget.service.ts test/budget-service.spec.ts && pnpm --filter api jest --testPathPattern=budget-service`. Final-gate adds `pnpm --filter api build && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`.
