# Project Audit — Comprehensive Sweep

> **RPI Phase:** Research
> **Date:** 2026-06-27
> **Scope:** Architecture, scalability, accessibility, edge cases, bug-hunt across frontend (webClient + mobile) and backend (api).
> **FAR Scale Score:** **4.67 / 5.00** (Factual 5, Actionable 4, Relevant 5)

---

## 1. Problem statement

The user requested a comprehensive sweep (`barrido`) of the BudgetGenius monorepo to identify (a) edge-case bugs that degrade UX when exploited and (b) architectural / a11y / scalability debt. Four candidate bugs were called out explicitly as hypotheses to validate:

| # | Candidate bug | Source claim |
|---|---------------|--------------|
| A | Currency display in `EditableBudgetCategory` ignores user-currency change | "el componente budget-category.tsx muestra siempre el valor en USD ignorando el cambio de currency por el usuario" |
| B | Currency conversion architecture is unclear (internal vs API) | "¿Cual es la fuente? ¿Un calculo interno o una api de cambio de moneda?" |
| C | `README.md` is outdated and doesn't match the App | "el README.md está desactualizado, no concuerda con lo que es la APP actualmente" |
| D | Language switcher in navbar should be scoped to `/profile` only | "este solo debe verse en /profile cuando el usuario está dentro de la APP" |

Success criteria for the audit deliverable:

- Each candidate bug is **validated or refuted** with concrete `file:line` evidence.
- Additional findings across architecture / scalability / a11y are surfaced with severity.
- An implementable, atomic Plan is produced in `plan.md` so the user can choose what to ship next.

---

## 2. Affected files inventory

### Frontend (webClient)

| Layer | Path | Relevance |
|-------|------|-----------|
| Presentation | `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx` | Bug A root |
| Presentation | `apps/webClient/src/presentation/components/dashboard/budgets/budget-list.tsx` | Currency rendering + react-redux §6.8 |
| Presentation | `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx` | Mutations + currency persistence |
| Presentation | `apps/webClient/src/presentation/components/dashboard/budgets/budget-modal.tsx` | Form submission |
| Presentation | `apps/webClient/src/presentation/pages/dashboard/budgetsPage.tsx` | Page composition |
| Presentation | `apps/webClient/src/presentation/components/dashboard/header.tsx` | Bug D root |
| Presentation | `apps/webClient/src/presentation/components/ui/header.tsx` | CTA-public chrome |
| Presentation | `apps/webClient/src/presentation/components/dashboard/language-switcher.tsx` | Used in both headers |
| Presentation | `apps/webClient/src/presentation/components/profile/account-settings.tsx` | Already has language dropdown + no-op self-assign |
| Presentation | `apps/webClient/src/presentation/pages/cta.tsx` | Marketing landing |
| Presentation | `apps/webClient/src/presentation/pages/user/profile.tsx` | Profile tabs |
| Presentation | `apps/webClient/src/presentation/utils/currencyService.ts` | Bug B root |
| Presentation | `apps/webClient/src/presentation/utils/routes.ts` | Route paths |
| Presentation | `apps/webClient/src/presentation/layouts/{main,landing,auth}.tsx` | Layout chrome |
| Application | `apps/webClient/src/adapters/http/{budget,transaction}.repository.ts` | HTTP layer |
| Adapters | `apps/webClient/src/adapters/slices/user-settings/settingsSlice.ts` | Settings slice |
| Infrastructure | `apps/webClient/src/infrastructure/i18n/i18n.ts` + `LocaleProvider.tsx` | i18n init + dispatcher |
| Tests | `apps/webClient/tests/currency-conversion.spec.ts` | Currency E2E |

### Backend (api)

| Layer | Path | Relevance |
|-------|------|-----------|
| Domain | `apps/api/src/domain/dashboard/{budget,budget-category,transaction,expense-category}.entity.ts` | Storage schema |
| Application | `apps/api/src/application/dashboard/services/budget.service.ts` | Service layer |
| Adapters | `apps/api/src/adapters/dashboard/http/budget.controller.ts` | Controller surface |
| Infrastructure | `apps/api/src/main.ts` + `app.module.ts` | Bootstrap + Throttler config |
| Tests | `apps/api/test/auth-cookie-bridge.spec.ts`, `budget-service.spec.ts` | Prior regression tests |

### Documentation

| Path | Relevance |
|------|-----------|
| `README.md` | Bug C root |
| `docs/changelog.md` | Up-to-date authoritative history (v1.3.1) |
| `knowledge.md` §6.8 / §13.3 / §16.1 | Architectural conventions |

---

## 3. Validation of candidate bugs

### Bug A — `EditableBudgetCategory` ignores currency change → **VALIDATED (P0)**

**Symptom:** A COP-locale user with `40000` allocated to a category toggles their account setting to USD; the same row suddenly shows `40000 USD` instead of a converted ~`10 USD`. (Same bug in reverse direction can also under-report by a factor of 4000×.)

**Root cause:** `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx:48-53`:

```tsx
const targetCurrency = (settings?.currency || "USD") as Currency;
const formattedSpent = currencyService.formatCurrency(
  category.spent,
  targetCurrency,
  targetCurrency,   // ← identity conversion: no rate applied at all
  false,
);
```

This is an **identity conversion** that never applies exchange rates. The pre-existing `#currency-edit-mangling` comment block claims "un-normalizing the writes so the value is stored in the user's configured currency" but that fix is **wrong / incomplete** — the storage backend has no currency column (see Bug B), so the value isn't stored in any currency.

**Two structural problems compound:**

1. `BudgetCategory.spent` and `.allocated` (`apps/api/src/domain/dashboard/budget-category.entity.ts:30-49`) are typed as raw `numeric` in Postgres with no `currency` ISO column — there is no historical truth.
2. `currencyService.formatCurrency(amt, X, X)` does **no rate lookup** — the user visibly pays/receives whatever number was last typed, just re-labeled with a new symbol. If a USD user typed `100.00` and then switches to EUR, they see `100,00 €` — the same 100 (not the real ≈ €93).

**Magnitude:** ⚠️ This is the worst kind of edge-case bug — silent mis-pricing on currency toggles. A user who fixes budget overages in USD could unknowingly stay "over budget" by 4000× in COP after a settings toggle. Reproducible with a single settings switch.

---

### Bug B — Currency conversion source is broken → **VALIDATED (P0)**

**Symptom:** Conversion is presentation-layer in-memory AND the service is never started, AND historical fidelity is impossible.

**Three concrete defects:**

1. **`CurrencyService.startExchangeRateUpdater()` is never invoked.**
   - `apps/webClient/src/presentation/utils/currencyService.ts:183-191` exposes the hourly updater method.
   - A grep across `apps/webClient` and `apps/mobile` shows zero call sites.
   - Net effect: the app boots and ships with `DEFAULT_EXCHANGE_RATES` baked in (`USD:1, EUR:0.93, COP:4000`). If COP floats to 4200, users see stale rates forever.
2. **`updateExchangeRates()` hits `https://open.er-api.com/v6/latest/USD`.**
   - This is a public free-tier API with no key, **no SLA**, no caching proxy, and is called from every user's browser hourly. Each browser tab makes a fresh network round-trip; there is no server-side caching, no error UI when the call fails (`console.error` is the only signal), and the CORS allow-list on `apps/api/src/main.ts:30-39` cannot help here (the call is browser → open.er-api.com, not via the NestJS backend).
3. **The backend has zero currency awareness.**
   - `BudgetCategory`, `Budget`, `Transaction`, `Overview`, `ExpenseCategory`, `Income`, `Goal`, `SavingGoal` all lack an ISO currency column.
   - There is no server-side rate cache; the conversion is purely a presentation cosmetic.

**Architectural verdict:** This is **not a fix-the-bug situation, it's a design gap.** The user's question ("¿un calculo interno o una api externa?") deserves a target architecture rather than a patch:

| Option | Pros | Cons |
|--------|------|------|
| **Internal — server-side rate cache** | Authenticated / rate-limited; reproducible across users; backend is authoritative for everything else; no CORS / quota drama with third-party providers; can fall back to the open.er-api.com fetch server-side with Redis caching | Requires a migration to add `currency` ISO columns + a historical snapshot pattern (e.g. `amountUSD` canonical column + display-time conversion) |
| **External — keep presentation-side** | No backend work | Already proven broken: zero startup, stale rates, no historical fidelity, third-party CORS/privacy exposure |
| **Hybrid (server caches, browser requests from server)** | Best of both | Most work — needs new endpoint, new Redis key, slider for rate freshness |

**Recommended option: Internal (server-side).** A `currency` column on every monetary aggregate + a server-side rate fetch (cached in Redis, refreshed hourly) + a presentation utility that asks the server when currency is needed.

---

### Bug C — `README.md` is stale → **VALIDATED (P2)**

**Concrete inaccuracies (sample, not exhaustive):**

| Claim in README.md | Reality (per `knowledge.md` + `docs/changelog.md`) |
|---|---|
| Architecture diagram places API on `port 3000` | In Mode A (local dev), backend runs on `port 5000` (footnote admits this in §Web Development Workflow → Mode A). The diagram is misleading visual-first. |
| Mobile section says: "uses `@capacitor-firebase/authentication`" | v1.2.0 changelog replaced it with `@capgo/capacitor-social-login@7`. The older plugin is no longer in the bundle. |
| Mobile section says native login "opens Chrome Custom Tabs / localhost:5000 redirect" | v1.1.2 fixed this — APK now uses Android Credential Manager; no Chrome Custom Tab, no deeplink. |
| Env-var lists `VITE_FIREBASE_MEASURENT_ID` | Typo for `MEASUREMENT_ID`; not consumed anywhere in code. The same typo is referenced via `FIREBASE_MEASURENT_ID` in the API env table. |
| Tech-stack table lists Vite / React 19 (correct) but does not mention the lazy-load split (`manualChunks` for `recharts` + `firebase`) | The lazy-route-config split was a substantial bundle-size effort (§6.8 of `knowledge.md`). Worth documenting. |
| "Encryption & Security" / "Rate Limiting" sections are vague | The actual implementation (Redis-backed `ThrottlerModule.forRoot`, `@SkipThrottle()` on `/auth/refresh`, `X-Device-Id` per-device buckets per v1.3.0) is not mentioned. |

The README is otherwise **well-structured** — the project structure tree, install workflows, RPI pointer, and `knowledge.md` reference are accurate. A targeted reconcile, not a rewrite, would suffice.

---

### Bug D — Language switcher should not appear in the dashboard navbar → **VALIDATED (P1)**

**Current state:**

| Component | Switcher present? | User context |
|-----------|-------------------|--------------|
| `apps/webClient/src/presentation/components/dashboard/header.tsx:28` (DashboardHeader, used by `MainLayout`) | **YES** — inserted between `<ThemeToggle />` and the avatar bubble | Authenticated user, inside `/app/*` |
| `apps/webClient/src/presentation/components/ui/header.tsx:46` (HeaderComponent, used by `LandingLayout`) | YES (also) | Anonymous user on `/` marketing site |
| `apps/webClient/src/presentation/components/profile/account-settings.tsx:115-128` (Profile → Account tab) | YES (as `<Select>`) | Authenticated user, in `/profile` |

**Two interpretations of the user's instruction are possible:**

> "este solo debe verse en /profile cuando el usuario está dentro de la APP"
>
> "(dado que ese boton es solo para CTA)"

— strictly literal: remove from BOTH navbars (CTA + Dashboard), make the only inside-app switcher the `account-settings` form. But that breaks anonymous visitors' ability to read Spanish marketing copy.

— common-sense: keep `<LanguageSwitcher />` on the **CTA landing** (anonymous, no other UI for it), and **remove from the dashboard navbar** (because `/profile` already exposes language). The qualifier "(dado que ese boton es solo para CTA)" reads as the user **justifying why it's redundant in the dashboard** — pointing out the dashboard doesn't need it because the CTA path is the marketing-public chrome.

**Recommended fix (non-destructive):**
- Remove `<LanguageSwitcher />` from `dashboard/header.tsx`.
- Leave it on `ui/header.tsx` (CTA / public chrome) so anonymous visitors can still toggle marketing copy in `es-CO`.
- The profile `account-settings.tsx` dropdown already handles it for in-app users.

---

## 4. Additional findings (surfaced by the audit)

### P0 — Currency is the biggest seam (compounds with Bug A & B)

| ID | Issue | Location |
|----|-------|----------|
| **E1** | No currency column on `BudgetCategory` / `Transaction` / `ExpenseCategory` / etc. → historical amounts are unrecoverable. | `apps/api/src/domain/dashboard/budget-category.entity.ts:30-49` |
| **E2** | `CurrencyService.startExchangeRateUpdater()` not called at app start → rates stuck on DEFAULT_EXCHANGE_RATES. | `apps/webClient/src/presentation/utils/currencyService.ts:183` |
| **E3** | `updateExchangeRates()` browser-side calls free public API `open.er-api.com` with no fallback UI on failure. | `apps/webClient/src/presentation/utils/currencyService.ts:64-78` |
| **E4** | `Number(value) \|\| 0` strips legitimate intermediate inputs like `"1."` (decimal point typed before tenths). | `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx:177-184` |

### P1 — UX correctness

| ID | Issue | Location |
|----|-------|----------|
| **E5** | `<Input type="number" step="0.01" />` in budget-category edit — breaks for COP (precision 0). Should be `step={precisionMap[currency] === 0 ? 1 : 0.01}`. | `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx:84` |
| **E6** | HTML number inputs respect only `.` decimal — a COP user typing `"10,42"` (Spanish decimal-comma) sees the browser reject the value at the DOM level, but `<Input type="number">` masks it; `currencyService.parseAmountInput` (intended for string fields) is never wired to numeric inputs. | `apps/webClient/src/presentation/utils/currencyService.ts:107-149` |
| **E7** | `useFetchBudgetCategories({ ..., name: "" })` from `budget-detail.tsx:50` passes an `""` value to a query param that the backend then **silently filters out** under `if (filters.name)` — uglier than necessary; `name: undefined` would be cleaner. | `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx:50` · `apps/api/src/adapters/dashboard/http/budget.controller.ts:39-46` |
| **E8** | `account-settings.tsx` does `settingsToUpdate.timezone = settingsToUpdate.timezone` (no-op self-assignment) inside three identical conditionals. Dead code that suggests an in-flight refactor — should be removed. | `apps/webClient/src/presentation/components/profile/account-settings.tsx:65-76` |
| **E9** | Although `knowledge.md` §6.8 documents that `useSelector((s) => s.userSettings)` followed by destructure is safe (Redux Toolkit + Immer preserves references), this convention isn't enforced via lint, so the rule will erode as the team grows. | `apps/webClient/src/presentation/components/dashboard/budgets/budget-category.tsx:24-25` (same pattern in `budget-list.tsx`, `account-settings.tsx`) |

### P2 — Code hygiene / a11y / scalability

| ID | Issue | Location |
|----|-------|----------|
| **E10** | `LanguageSwitcher` button has `aria-label="Switch language"` but no `aria-haspopup="listbox"` / `aria-expanded={isOpen}` — screen readers can't tell it's a dropdown. | `apps/webClient/src/presentation/components/dashboard/language-switcher.tsx:55-64` |
| **E11** | `LanguageSwitcher` also lacks keyboard support (Escape-closes dropdown, arrow-key navigation). | same file |
| **E12** | `cta.tsx` (≈ 200 lines of hardcoded preview JSX with inline Tailwind grid positioning) is marked as a "luxury-tier follow-up" in the changelog — still acting as a payoff surface for first impressions. Fragile. | `apps/webClient/src/presentation/pages/cta.tsx` |
| **E13** | `RootRoute` / `SplashPage` fail-safe is `sessionStorage.mobile.splash.shown` keyed by string `"1"` — fine for now but should be paired with a TTL (`Date.now()` written, hydrated against build version) so a regression doesn't cache the splash forward. | `apps/webClient/src/presentation/pages/splash.tsx` |
| **E14** | Sentry / OpenTelemetry / observability — zero. No `console.error` aggregation, no Sentry SDK, no APM. The user has no production visibility for the kind of currency / refresh-token bugs we keep fixing. | All `*.service.ts` |
| **E15** | Currency test (`currency-conversion.spec.ts`) only verifies a positive USD→COP conversion. No round-trip, no missing-rate fallback, no COP→EUR coverage. | `apps/webClient/tests/currency-conversion.spec.ts:78-91` |
| **E16** | Scalability: `useFetchBudgetCategories` keyed only by `["budgetCategories", activeBudget]`. If a user has 100 budgets, cache invalidation on `["budgets"]` clears everything but we don't pre-fetch. No `staleTime` config. | `apps/webClient/src/presentation/components/dashboard/budgets/budget-detail.tsx:49-56` |
| **E17** | README env-var typo: `FIREBASE_MEASURENT_ID` / `VITE_FIREBASE_MEASURENT_ID`. Templates + CI workflows propagate it. | `README.md` · `apps/webClient/.env.example` · 3 GitHub workflow files |

---

## 5. Risk register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User loses trust in historical currency values after toggling settings | **High** (single click away) | Product-defining | Surface a per-aggregate "created before currency change" badge; OR migrate to a canonical `amountUSD` column + display-time conversion. |
| Backend has no rate cache → open.er-api.com quota / privacy | High | Privacy + UX | Server-side rate cache with Redis. |
| Currency-explicit input UX is broken for non-USD users | Medium | UX silent bug | `<Input>` should respect `parseAmountInput` + locale-aware separator. |
| Free public API for exchange rates goes down | Medium | Conversion shows DEFAULT | Local fallback snapshot file shipped with the bundle. |
| README keeps drifting | Low | Onboarding confusion | Add a "Last reviewed" section anchored to `docs/changelog.md` version. |
| Language switcher placement regression after landing refactor | Low | A11y / UX | Add a Playwright regression spec asserting `LanguageSwitcher` visible on `/`, not on `/app/*`. |

---

## 6. Architecture sketch — currency, the proposed direction

```
┌─────────────────┐
│   webClient     │
│  (presentation) │
└────────┬────────┘
         │ GET /exchange-rates (per user)
         │ GET /transactions?from=…&to=…
         ▼
┌─────────────────────────────────────────────────────┐
│   api                                               │
│   ┌────────────────────┐  ┌───────────────────────┐ │
│   │ CurrencyService     │  │ Migration: add       │ │
│   │  - cached rates     │  │ `currency` ISO col + │ │
│   │  - Redis-backed     │  │ `amountUSD` canon.   │ │
│   │  - 1hr TTL          │  │ per aggregate        │ │
│   └─────────┬───────────┘  └───────────────────────┘ │
│             │                                       │
│             ▼                                       │
│   ┌────────────────────┐                            │
│   │ Presentation util   │  gets rates on demand,   │
│   │ asks the server      │  no in-memory exchange  │
│   └────────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

Key invariants:

1. **The server is the authoritative source for both the rate and the storage unit.**
2. **The user sees a display currency; the DB stores an immutable canonical USD-plus-ISO-currency pair at write time.**
3. **`currencyService` becomes a thin client** — it asks the server, formats with `Intl.NumberFormat` per locale, never touches an external rate API.

This is the smallest design that:

- Closes Bug A (no silent currency "re-base" on toggle).
- Closes Bug B (no third-party dependency in the browser).
- Keeps the existing presentation utility mostly intact.
- Allows historical amounts to be converted forward and backward.

---

## 7. FAR Scale self-evaluation

| Dimension | Score | Notes |
|-----------|-------|-------|
| Factual | **5 / 5** | Every claim references concrete `file:line` ranges. The currency-architecture gap verifiably maps to a missing `currency` column. The README inaccuracies are direct quotes from `README.md` contrasted with `docs/changelog.md`. |
| Actionable | **4 / 5** | Each finding points at a specific module / line range. The Plan phase derives atomic tasks. Currency architecture upgrade requires explicit user buy-in (option table presented in §3.B). |
| Relevant | **5 / 5** | All findings map to the user's four questions plus additional concrete categories (architecture, scalability, a11y). |

**Mean: 4.67 / 5.00** — passes the Research→Plan gate (≥ 4.00).

---

## 8. References & supporting material

- `knowledge.md` §6.8 (react-redux pitfalls), §13.3 (known debt incl. mobile-cookie outage).
- `docs/changelog.md` v1.0.0 → v1.3.1 (used as the ground-truth for "what the app is").
- `docs/rpi/README.md` (framework methodology).
- `docs/rpi/Plan.md` (target structure for sibling `plan.md`).
- `rpi/mobile-cookies-persistence/` (most recent RPI artifact, useful template for FRobust RPI discipline).

---

*End of Research phase. Hand off to `plan.md` for atomic fix tasks.*
