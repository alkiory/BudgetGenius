# Project Audit — Plan Phase (atomic remediation)

> **RPI Phase:** Plan
> **Companion to:** `research.md` (FAR 4.67)
> **FACTS Scale Score:** **4.40 / 5.00** (F 4, A 5, C 4, T 4, S 5)
> **Status:** All tasks below are sequenced for `Implement`. Each task is owned by a single area and gating on the next is explicit. Quality gate: backend `tsc + jest`, frontend `tsc + lint + Playwright`.

The plan is grouped by **Severity Wave** so the user can choose what to ship:

- **Wave 1 — Quick wins & visible UX cleanup** (≈ 1 day)
- **Wave 2 — UX correctness + a11y** (≈ 2–3 days)
- **Wave 3 — Currency architecture rework** (≈ 4–6 days, gated on user buy-in for design decision from research.md §3.B option table)

---

## Wave 1 — Quick wins & visible UX cleanup

### [T1.1] Remove `<LanguageSwitcher />` from dashboard navbar
- **File:** `apps/webClient/src/presentation/components/dashboard/header.tsx`
- **Why:** Matches the user's request (Bug D). CTA landing retains the switcher for anonymous visitors, profile `/profile` already exposes it via `account-settings.tsx`.
- **Do:**
  - Remove `<LanguageSwitcher />` import + JSX usage (line 4, line 28).
  - Leave `<ThemeToggle />` and the avatar in place.
- **Verify:** `pnpm --filter frontend-web tsc --noEmit -p tsconfig.app.json`; visual smoke-test `/app/dashboard`, `/app/budgets`, `/app/profile/...` in dev mode.
- **Acceptance:** Dashboard header shows only ThemeToggle + avatar; profile still shows the dropdown in `account-settings`.

### [T1.2] Remove no-op self-assignments in `account-settings.tsx`
- **File:** `apps/webClient/src/presentation/components/profile/account-settings.tsx` (lines 61–76)
- **Do:** Delete the three no-op conditional blocks:
  ```ts
  if (settingsToUpdate.timezone !== settings?.timezone) {
    settingsToUpdate.timezone = settingsToUpdate.timezone;
  }
  // …identical for currency and locale
  ```
- **Verify:** tsc.
- **Acceptance:** No behavioural change (the dead code was a no-op); the mutation is now: `updateSettings(settingsToUpdate)` consumed as-is.

### [T1.3] Drop the falsy empty `name` from the categories query
- **File:** `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx` (line ~50)
- **Why:** Backend service at `apps/api/src/application/dashboard/services/budget.service.ts:167` strips `name` if falsy. Forward `undefined` instead of `""` to express the intent.
- **Do:**
  ```ts
  useFetchBudgetCategories({
    budgetId: Number(activeBudget),
    name: search ?? undefined,
  });
  ```
- **Verify:** tsc + smoke test in `/app/budgets`.
- **Acceptance:** Network tab shows `?budgetId=N` (no `name=`); endpoint behaves identically.

### [T1.4] Fix the README typo `MEASURENT_ID` → `MEASUREMENT_ID`
- **Files:**
  - `README.md` (env-var tables)
  - `apps/webClient/.env.example`
  - `.github/workflows/{build-apk,firebase-hosting-merge,firebase-pull-request}.yml` (search and rename)
- **Why:** Search-and-replace is mechanical; trip hazard for onboarding developers.
- **Do:** Rename `VITE_FIREBASE_MEASURENT_ID` → `VITE_FIREBASE_MEASUREMENT_ID`. Add a `// MEASUREMENT_ID typo fix 2026-06-27` changelog note inside the workflow files for auditability.
- **Verify:** `git grep -n MEASURENT` returns zero hits (the canonical env var stays as the spelling `measurement_id`).
- **Acceptance:** New developers can `cp .env.example .env.development` and find the variable under its correct name.

### [T1.5] Sync README tech-stack to current Mobile + Auth stack
- **File:** `README.md` (Mobile Development section)
- **Do:**
  - Replace `@capacitor-firebase/authentication` references with `@capgo/capacitor-social-login`. Cite `docs/changelog.md v1.2.0`.
  - Replace the Chrome Custom Tab redirect narrative with the Credential Manager bottom-sheet narrative (cite v1.1.2).
  - Add a one-paragraph note on `VITE_GOOGLE_WEB_CLIENT_ID` (added in v1.2.0 to disambiguate from Android OAuth Client ID).
- **Verify:** README cross-checked against `docs/changelog.md` v1.1.2 + v1.2.0 entries.
- **Acceptance:** README Mobile section is consistent with `rpi/mobile-apk/` and the current `apps/mobile/capacitor.config.ts`.

### [T1.6] Reconcile ports in README architecture diagram
- **File:** `README.md` (Architecture diagram)
- **Do:**
  - Make the diagram two variants: **Docker compose (Mode B)** → frontend `3001`, backend `3000`; **local dev (Mode A)** → frontend `5173` (Vite) or `3001` (nginx container), backend `5000`. Use a table footnote.
  - Cite `apps/api/src/main.ts:107` (`await app.listen(process.env.PORT || 5000, '0.0.0.0')`) as the authoritative source.
- **Verify:** grep confirms only one place in README mentions backend port.
- **Acceptance:** Diagram + Mode A note no longer contradict.

---

## Wave 2 — UX correctness + a11y

### [T2.1] Locale-aware number input for budget category edit
- **File:** `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx`
- **Why:** HTML `<input type="number">` hardcodes `.` as decimal and rejects locales that use `,`. For a COP user typing `10,42`, the input silently rejects the comma and shows `1042`.
- **Do:**
  - Switch to `type="text"` with `inputMode="decimal"`.
  - Run user input through `currencyService.parseAmountInput(e.target.value)` (already exported from `currencyService.ts`).
  - On save, format the display value with the user's current `targetCurrency` locale (`toLocaleString(currencyLocale, …)`) for the `formattedSpent` label.
  - Match `step` to `getDecimalPrecision(targetCurrency)`. Specifically:
    ```tsx
    const precision = getDecimalPrecision(targetCurrency);
    <Input type="text" inputMode="decimal" step={precision === 0 ? 1 : 1 / 10 ** precision} … />
    ```
- **Verify:** Playwright spec that types `10,42` in a COP locale and asserts persistence as `10,42` (not `1042`).

### [T2.2] Decimal precision in transaction forms
- **File:** `apps/webClient/src/presentation/components/dashboard/transaction/transaction-form.tsx` + `add-transaction.tsx` + `edit-transaction.tsx`
- **Why:** Same locale issue as T2.1; transaction amounts dominate the dashboard.
- **Do:** Mirror T2.1 changes. Centralize the inline parse call into a `useDecimalInput(targetCurrency)` hook in `apps/webClient/src/adapters/hooks/` to dedupe.
- **Verify:** Playwright spec `tests/transaction-form.spec.ts` updated to cover COP decimal-comma and USD decimal-dot.

### [T2.3] Preserve intermediate decimal input (`"1."`)
- **File:** `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx:180-184`
- **Why:** `Number(value) || 0` collapses `"1."` to `1` and `"1.5"` half-typed to `1.5` only on blur. UX feels jerky while typing.
- **Do:** Use `parseAmountInput` (`currencyService.ts:107`) which already handles leading/trailing decimal placeholders explicitly. Map `name === "allocated" || name === "spent"` through `parseAmountInput(value)` then `Number.isFinite ? parsed : 0`.
- **Verify:** Playwright — type `"1."` then `"1.5"` and assert the input retains `1.5` and the displayed `formattedSpent` updates live.

### [T2.4] a11y: dropdown semantics + keyboard support for `LanguageSwitcher`
- **File:** `apps/webClient/src/presentation/components/dashboard/language-switcher.tsx`
- **Do:**
  - Add `aria-haspopup="listbox"` and `aria-expanded={isOpen}` to the trigger button.
  - Add `role="listbox"` to the dropdown, `role="option"` + `aria-selected={locale === currentLocale}` to each option.
  - Add Escape-to-close: `useEffect(() => { function onKey(e){ if(e.key === "Escape") setIsOpen(false) } … }, [isOpen])`.
- **Acceptance:** axe-core scan reports zero issues on the CTA page and the profile-when-logged-in-but-logged-out path.

### [T2.5] a11y: profile tab `aria-current`
- **File:** `apps/webClient/src/presentation/pages/user/profile.tsx` (`TabsList` / `TabsTrigger`)
- **Why:** `TabsTrigger` from `@presentation/components/ui/tabs.tsx` should pass `aria-current="page"` when active. Most Radix-style Tabs do, but the project's wrapper may not.
- **Do:** Open `presentation/components/ui/tabs.tsx`, confirm `TabsTrigger` propagates Radix's `data-state` / `aria-selected`. If not, add a one-line `<TabsTrigger ... data-state={activeTab === val ? "active" : "inactive"}>` enrichment.
- **Verify:** axe-core.

### [T2.6] `aria-live` toast messages
- **Files:** `apps/webClient/src/presentation/utils/toast.tsx` + `apps/webClient/src/infrastructure/toast.config.tsx`
- **Why:** Success/error toasts on budget mutations need screen-reader announcement.
- **Do:** Add `role="status"` / `aria-live="polite"` to success toasts and `role="alert"` / `aria-live="assertive"` to error/warning toasts.
- **Verify:** axe-core.

### [T2.7] Currency round-trip + missing-rate Playwright tests
- **File:** `apps/webClient/tests/currency-conversion.spec.ts`
- **Do:** Add 3 cases:
  1. **USD→EUR→USD round-trip is identity modulo rounding** — guarantees the conversion is reversible.
  2. **Missing rate (e.g., JPY not in `DEFAULT_EXCHANGE_RATES`)** — graceful fallback to "—" or "rate unavailable" with toast.
  3. **COP precision** — input `10,42` is rejected (since COP precision is 0) and the input field snaps to the nearest integer with an info toast.
- **Verify:** `pnpm --filter frontend-web test`.

### [T2.8] Stale-closure / `staleTime` on budget queries
- **File:** `apps/webClient/src/adapters/query/dashboard.ts`
- **Why:** `useFetchBudgetCategories` has no `staleTime`; defaults to `0`, refetching on every focus. Mobile users on flaky connections will thrash.
- **Do:** Set `staleTime: 30_000` on `["budgets"]`, `["budgetCategories", activeBudget]`, `["dashboard*"]`. Regression: `refetchBudgets()` still called after mutation `onSuccess`.
- **Verify:** Playwright — fast network throttle + assert ≤ 1 re-fetch over 30s of tab focus / blur cycles.

---

## Wave 3 — Currency architecture rework (user buy-in required)

> **Decision needed:** Per `research.md §3.B` option table, the recommended path is **Internal — server-side rate cache**. Confirm with the user before opening Wave 3 tasks.

### [T3.1] Backend: server-side rate cache + `/exchange-rates` endpoint
- **Files (new):**
  - `apps/api/src/application/exchange/exchange.service.ts` — Redis-backed cache, 1hr TTL, fallback fetch to `open.er-api.com`.
  - `apps/api/src/infrastructure/exchange/exchange.module.ts`.
  - `apps/api/src/adapters/exchange/http/exchange.controller.ts` — `GET /exchange-rates`.
- **Files (modified):**
  - `apps/api/src/app.module.ts` — register `ExchangeModule`.
- **Do:** Cache key `bg:exchange-rates:<date>`-ish; values per ISO code. Returns JSON: `{ base: "USD", rates: { EUR: …, COP: …, … }, fetchedAt: ISO, ttl: 3600 }`. Prisma/TypeORM not required.
- **Verify:** Jest — fetch endpoint twice in 1 hr → second call hits cache; third call after TTL refreshes.

### [T3.2] Migration: add `currency` ISO + canonical `amountUSD` column on monetary aggregates
- **Files:**
  - New migrations under `apps/api/src/migrations/18xxxxxxxx-MonetizationColumns.ts` covering: `transactions`, `budgets`, `budget_categories`, `incomes`, `expense_categories`, `overview`, `goals`, `saving_goals`.
  - Per entity, add:
    - `currency varchar(3) NOT NULL DEFAULT 'USD'`
    - `amountUSD numeric ... NOT NULL` (canonical snapshot)
  - Backfill `amountUSD` by reading from the orchestrating `user_settings` for the row's owner at write-time of the migration — i.e. compute `value / rates[userSettings.currency]` for each row, store it; if currency was USD already, copy directly.
  - The original amount column is kept (so the v1.x presentation-layer utilities can still read what the user typed), and `amountUSD` is added for cross-currency analytics.
- **Verify:**
  - Migration backwards-compatible: existing rows get `currency="USD"`, `amountUSD = value`.
  - Pre-migration dry-run report via `RAISE NOTICE` so the operator sees total rows + rough rate source.
- **Acceptance:** A user who flips their currency from USD to EUR on day 30 sees their day-1 USD-typed transactions re-rendered as EUR using `amountUSD * rates['EUR']`.

### [T3.3] Service layer: persist both at write-time
- **Files:** `apps/api/src/application/dashboard/services/{transaction,budget,expense-category,income,goal,saving-goal,overview}.service.ts`
- **Do:** Each `create`/`update` now takes a `currency` field. The service:
  1. Validates the user setting's currency matches the request (or accepts an explicit override).
  2. Persists the typed value as `value` plus the typed ISO currency.
  3. Computes `valueUSD = convertToUSD(value, currency)` via `ExchangeService.convert(value, from, 'USD')` and stores that.
- **Acceptance:** Same `value` could now legitimately differ across users in different currencies without ambiguity.

### [T3.4] Frontend: thin client `currencyService` → ask backend
- **File:** `apps/webClient/src/presentation/utils/currencyService.ts`
- **Do:** Remove `updateExchangeRates()` / `startExchangeRateUpdater()` / direct fetch to `open.er-api.com`. New `currencyService.refreshFromServer()` calls `GET /api/exchange-rates` and stores rates in Redux (`state.userSettings.rates`). `convertAmount` becomes `(amount, from, to) => amount * rates[from->USD?] ?? default`.
- **Verify:** Jest — service falls back gracefully when network offline (uses last-known-good from Redux). React Query `staleTime: 30 min` so we don't hammer the server.

### [T3.5] Display: always format in the user's locale + currency with proper Intl
- **File:** `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx` + every `formatCurrency` consumer
- **Do:**
  - Replace `currencyService.formatCurrency` usage with a thin `formatCurrency(amount, currency, locale)` that calls `Intl.NumberFormat(locale, { style: "currency", currency }).format(amount)`.
  - Drop the `fromCurrency`/`toCurrency` parameters from `formatCurrency` — storage is now canonical `amountInCurrency` + `currency` ISO, so there's no conversion on the read path.
  - Where the user explicitly wants a cross-currency display ("Total spent across all categories in USD equivalent"), use `Redux rates` lookups: `valueInUserCurrency * (rates['USD'] / rates[currency])`.
- **Verify:** Playwright regression `currency-conversion.spec.ts` — assertion set is now identical to before but the underlying pipeline is correctness-not-a-number.

### [T3.6] TypeORM `numeric` transformer hardened for bigint + null
- **Files:** All entity files
- **Do:** Standardise the `numeric` transformer to:
  ```ts
  transformer: {
    to: (value: number) => value,
    from: (value: string | null) => value === null ? 0 : Number(value),
  }
  ```
  - Currently `from: (value: number | string) => Number(value)` silently catches `null` as `NaN` for new nullable cases the platform adds later.
- **Verify:** Jest unit test.

### [T3.7] Observability: minimal Sentry (or `pino`-only) for production
- **Files:** `apps/api/src/adapters/app.controller.ts` + `apps/webClient/src/infrastructure/api.config.ts`
- **Scope:** Just enough to capture (a) the next currency bug if it ships, (b) `react-redux` selector-trip failures per §6.8, (c) refresh-token reuse errors per v1.1.2 + v1.3.0.
- **Acceptance:** Pre-commit script refuses to start backend without `SENTRY_DSN` set OR `pino`-logging pipeline with at least one forwarder.

### [T3.8] Documentation: update `knowledge.md` §3 (now-stale schema) + README currency section
- **Files:** `knowledge.md` (§2, §5.2 currency entries), `README.md` (Features → "Localization")
- **Do:**
  - Update the §5.2 entity table to list `currency` + `amountUSD` columns for every monetary aggregate.
  - Add a "Currency model" bullet: "amounts are stored in the user's currency at write time plus a canonical `amountUSD`. Cross-currency rendering goes through `ExchangeService.convert(…, to: 'USD')` then `Intl.NumberFormat`."
  - README Adds: "To change the default fallback rate snapshot, edit `apps/api/seed/exchange-rates-fallback.json`."
- **Verify:** `grep -rn "DEFAULT_EXCHANGE_RATES" apps/webClient` returns only `currencyService.ts`'s _fallback_ comment + the migration seed (post-T3.4).

---

## Sequencing & dependencies

```
Wave 1 (no deps):
  T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6      (parallelisable)

Wave 2 (depends on nothing in Wave 3):
  T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6 → T2.7 → T2.8

Wave 3 (sequential, all depend on user buy-in for "Internal — server-side rate cache"):
  T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6 → T3.7 → T3.8
```

Tasks within a wave can be done in parallel; trigger `Implement` with this plan and the `Implement.md` template will gate each via `Build → Lint → Test`.

---

## Quality gates (per Implement phase)

Before marking any task `[x]`:

- **Backend** — `pnpm --filter api tsc --noEmit -p tsconfig.json` AND `pnpm --filter api jest`.
- **Frontend** — `pnpm --filter frontend-web tsc --noEmit -p tsconfig.app.json` AND `pnpm --filter frontend-web lint` AND `pnpm --filter frontend-web test` (Playwright).
- **Conventional commits** — Each task = its own commit (or grouped if atomic). Reference the task ID in the commit message, e.g., `fix: [T2.1] locale-aware budget category input`.

---

## Out of scope (deferred)

- **i18n completeness** — many UI strings still untranslated; out of audit scope.
- **Replace cta.tsx preview with a real screenshot engine** — luxury-tier follow-up per `docs/changelog.md v1.0.0`.
- **Stress test on 10k transactions per budget** — load-test follow-up.
- **Capacitor `CapacitorCookies` reinstall** if a future npm version of `@capacitor-community/cookies` lands (per `docs/changelog.md v1.3.0` out-of-scope section).

---

## Open questions for the user (before T3 plans ship)

1. **Currency architecture decision:** Internal (recommended) / External (status quo) / Hybrid? See research.md §3.B option table.
2. **Migration safety:** Wave 3 T3.2 backfills existing rows using the user's settings currency at migration-time. Acceptable, or do we want a per-row prompt for ambiguous data?
3. **Sentry vs Pino-only:** T3.7 — which to standardise on?

If the user defers Wave 3 entirely, Waves 1 → 2 still remove the most visible UX bugs (Bug A's silent re-base is closed by T2.1/T2.2 + T2.3 once data display is consistent).
