# BudgetGenius Changelog

> Session: Currency Consistency Fixes — June 2026

---

## Overview

This session fixed a systematic bug where components displayed and stored financial data in the user's display currency instead of normalizing to/from USD. All financial data is stored in USD (via `currencyService.normalizeAmount()`), but many display components passed the user's display currency as `fromCurrency` in `formatCurrency()`, making `fromCurrency === toCurrency` — no conversion occurred. Several input forms also sent raw values to the API without normalizing to USD.

---

## Core Bug Fixes

### 1. `currencyService.ts` — Decimal precision & regex crash

- **`getDecimalPrecision`**: Changed `|| 2` to `?? 2` — the `||` treated `0` as falsy, causing COP and JPY (both with 0 decimal places) to show with 2 decimals.
- **`validateAmount`**: When `decimalPlaces` is 0 (COP, JPY), the regex `/^-?\d+(\.\d{1,0})?$/` had an invalid `{1,0}` quantifier (min > max) causing a `SyntaxError`. Fixed by using `/^-?\d+$/` (integers only) for 0-decimal currencies.

### 2. `dashboardPage.tsx` — Null-safe access on expense breakdown

- `breackdown?.largest.value` crashed with `TypeError: Cannot read properties of null (reading 'value')` when the expense breakdown had `largest: null` (no expense data). Fixed: `breackdown?.largest?.value` (added optional chaining on `largest` too).

---

## Display Conversion Fixes (fromCurrency → 'USD')

All changes in this section fix `currencyService.formatCurrency()` calls where `fromCurrency` was set to the user's display currency instead of `'USD'`. Data is stored in USD, so `fromCurrency` must always be `'USD'` for proper conversion.

| File | Calls fixed | Previous fromCurrency |
|------|-------------|----------------------|
| `saving-goal-card-mini.tsx` | 2 | `targetCurrency` |
| `budget-progress.tsx` | 2 | `settings?.currency` |
| `recent-transactions.tsx` | 1 | `transaction.currency` |
| `incomePage.tsx` | 2 | `targetCurrency` |
| `budget-category.tsx` | 1 | `targetCurrency` |
| `category-list.tsx` | 3 | `targetCurrency` |
| **Report tabs** (4 files) | See below | - |

### Reports components — full refactor

The 4 report tab components (`overview-tab.tsx`, `income-expenses-tab.tsx`, `trends-tab.tsx`, `categories-tab.tsx`) all had a local `formatCurrency` function:

```tsx
const formatCurrency = (value: number) =>
  `$${value?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
```

This always showed `$` with `en-US` locale regardless of the user's currency setting. Replaced with:

```tsx
const formatCurrency = (value: number) =>
  currencyService.formatCurrency(value, 'USD' as Currency, targetCurrency, false).formatted;
```

Each tab now reads `targetCurrency` from Redux (`state.userSettings.settings.currency`).

---

## Storage Normalization Fixes (added normalizeAmount calls)

All changes in this section add `currencyService.normalizeAmount()` calls to convert user-entered values from their display currency to USD before saving.

| File | What changed |
|------|-------------|
| `saving-goal-form.tsx` | `handleSubmit`: normalizes `target` and `current` |
| `goal-form.tsx` | `handleSubmit`: normalizes `targetAmount` and `currentAmount` |
| `goal-card.tsx` | `handleAddProgress`: normalizes progress amount + fixed hardcoded `$` prefix to use `currencyService.getSymbol(targetCurrency)` |
| `budget-form.tsx` | `handleSubmit`: normalizes each category's `allocated` and `spent` |
| `budget-detail.tsx` | `handleAddCategorySubmit`: normalizes `allocated` and `spent`; `onUpdateSpent`: normalizes `spent` |

---

## Test Fixes

### `auth.spec.ts` — Flaky test fix

- **Root cause:** Dashboard page makes 8+ API calls on load. Only verify + profile were mocked — all others failed with network errors, keeping React Query in loading state indefinitely.
- **Fixes:** Added 6 more route mocks (user-settings, dashboard, expense-categories, transactions, budgets, saving-goals). Used `domcontentloaded` + `waitForTimeout` instead of `networkidle`.

### `offline-queue.spec.ts` — Flaky test fix

- **Root cause 1:** `**/api/transactions` mock didn't match URLs with query params (`?offset=0&limit=50`). Fixed: `**/api/transactions**` (trailing wildcard).
- **Root cause 2:** Login-via-UI flow had race condition between `ProtectedRoute` and `useRestoreSession`. Fixed: `addInitScript` to inject localStorage tokens before any JS runs.
- **Root cause 3:** `waitForEvent('requestfailed')` set up AFTER `form.requestSubmit()`, but the event fires synchronously during submit. Fixed: listener created before `requestSubmit()`.

### New test: `currency-conversion.spec.ts`

Playwright E2E test that mocks all API endpoints with COP as the user's currency (`locale: 'es-CO'`, `currency: 'COP'`) and verifies USD→COP conversion works correctly across the dashboard. Confirms:
- Balance: $5,000 USD → `$ 20.000.000,00` COP
- Income: $3,000 USD → `$ 12.000.000,00` COP
- Expenses: $2,000 USD → `$ 8.000.000,00` COP

---

## Files Changed (frontend)

| File | Change type |
|------|-------------|
| `src/presentation/utils/currencyService.ts` | Bug fix |
| `src/presentation/pages/dashboard/dashboardPage.tsx` | Bug fix |
| `src/presentation/pages/dashboard/saving-goalPage.tsx` | ✅ Already correct |
| `src/presentation/pages/dashboard/goalsPage.tsx` | ✅ Already correct |
| `src/presentation/pages/dashboard/incomePage.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/saving-goal/saving-goal-card.tsx` | ✅ Already correct |
| `src/presentation/components/dashboard/saving-goal/saving-goal-card-mini.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/saving-goal/saving-goal-form.tsx` | normalizeAmount added |
| `src/presentation/components/dashboard/budget-progress.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/recent-transactions.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/budgets/budget-form.tsx` | normalizeAmount added |
| `src/presentation/components/dashboard/budgets/budget-detail.tsx` | normalizeAmount added + fromCurrency fix |
| `src/presentation/components/dashboard/budgets/budget-category.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/budgets/category-list.tsx` | fromCurrency fix |
| `src/presentation/components/dashboard/goals/goal-card.tsx` | normalizeAmount added + symbol fix |
| `src/presentation/components/dashboard/goals/goal-form.tsx` | normalizeAmount added |
| `src/presentation/components/dashboard/reports/overview-tab.tsx` | Formatting refactor |
| `src/presentation/components/dashboard/reports/income-expenses-tab.tsx` | Formatting refactor |
| `src/presentation/components/dashboard/reports/trends-tab.tsx` | Formatting refactor |
| `src/presentation/components/dashboard/reports/categories-tab.tsx` | Formatting refactor |
| `tests/auth.spec.ts` | Test fix |
| `tests/offline-queue.spec.ts` | Test fix |
| `tests/currency-conversion.spec.ts` | New test |

---

## Test Results (final)

| Suite | Tests | Status |
|-------|-------|--------|
| Backend Jest | 25/25 | ✅ |
| Frontend Playwright | 19/19 | ✅ |
| **Total** | **44/44** | **🟢 All green** |

---

## Architecture Decision

**Data storage currency:** All financial data (transactions, budgets, budget categories, saving goals, goals, incomes) is stored in **USD** after normalization via `currencyService.normalizeAmount()`.

**Display conversion:** All display components use `currencyService.formatCurrency(amount, 'USD', targetCurrency, false).formatted` where `targetCurrency` comes from the user's Redux settings (`state.userSettings.settings.currency`).

**Supported currencies:** USD, EUR, GBP, JPY, COP (defined in `currencyService.ts`).
