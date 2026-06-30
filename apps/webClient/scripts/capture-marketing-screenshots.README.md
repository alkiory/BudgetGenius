# Marketing screenshot capture — synthetic-mock disclosure

Companion to `capture-marketing-screenshots.mjs`. Produces the two
PNG mockups used by `apps/webClient/src/presentation/components/landing/{hero,showcase,final-cta}.tsx`.

## What this is

A **deterministic capture pipeline** that renders the real production
components (`<OverviewCard />`, `<RecentTransactions />`, etc.) against
synthetic, hand-curated JSON. It **does not** depend on Postgres,
Redis, or the NestJS API — the running Vite dev server on `:5173` is
the only prerequisite. We intercept five `/api/...` routes via
Playwright's `page.route()` mirroring the pattern in
`apps/webClient/tests/auth.spec.ts`.

## Why mocks

The full dev stack (PG, Redis, API, optionally docker compose) is not
always available at the moment a marketing iteration ships. The mocks
let the capture script run in CI, in staging laptops without docker,
or right inside this CLI.

## Synthetic data — be honest

The screenshots are **synthetic** and the dashboard **renders real
React UI**. Trade-offs:

- Numbers, transactions, and account names are invented but tuned to
  look like a typical BudgetGenius user. The seed is **not** a claim
  about real product behaviour.
- The simulated locale (`en-US`) and currency (`USD`) are picked so
  the marketing mock is consistent in both languages. Spanish-mock
  variants would require a `locale: "es-CO"` + COP currency rerun.
- `isPremium` is intentionally **omitted** from the profile payload —
  every account defaults to `premium=true` AND the codebase has
  removed every "upgrade" affordance. **Audit trail:** the schema
  flip is `apps/api/src/migrations/1776520000001-IspremiumDefaultTrue.ts`
  (audit timestamp 1776520000001) paired with the goal-table drop
  at `1800000000000-RemoveGoalsTable.ts`; the release summaries live
  in `docs/changelog.md`. The screenshot capture can never represent
  a paywall because the codebase no longer has one.

## What gets mocked

| Endpoint                                     | Result                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `GET /api/auth/verify`                       | `{}` (HTTP 200, signed-in)                            |
| `GET /api/user/profile`                      | `{ id, name, surname, email, ... }`                  |
| `GET /api/user-settings`                     | `{ timezone: "America/New_York", currency: "USD", locale: "en-US" }` |
| `GET /api/dashboard/overview`                | `{ balance, income, expenses, period }`              |
| `GET /api/dashboard/recent-summary?limit=50` | `{ transactions: [...] }`                            |
| `GET /api/dashboard/expense-breakdown`       | `{ byCategory: [], total: 0, largest, period }`      |
| `GET /api/budgets**`                         | `[]` (BudgetProgress empty branch)                   |
| `GET /api/users**`                           | `[]`                                                  |

## Run

The pre-reqs are confirmed by `playwright` reporting
`Version 1.51.1` and `~/.cache/ms-playwright/chromium-1161` being
populated. The webClient dev server must already be running
(`pnpm --filter frontend-web dev` proxies a Vite server on `:5173`).

```bash
# From repo root
node apps/webClient/scripts/capture-marketing-screenshots.mjs

# Override Vite URL if needed (e.g. preview server on 4173)
BG_CAPTURE_BASE_URL=http://localhost:4173 \
  node apps/webClient/scripts/capture-marketing-screenshots.mjs
```

The script writes two PNGs to a temporary preview folder:

```
/tmp/budgetgenius-marketing-shots/dashboard_mobile.png
/tmp/budgetgenius-marketing-shots/presentation_dashboard.png
```

…and prints a manifest to stdout.

## Re-run cadence

Capture scripts are pure data + template: the React UI is rendered
fresh each run unless the dashboard tree changes. When
`<OverviewCard />`, `<RecentTransactions />`, or any of the queried
endpoints change shape, re-run the script and re-verify the PNGs.

## Swap to assets once approved

After previewing the PNGs:

```bash
mv /tmp/budgetgenius-marketing-shots/dashboard_mobile.png \
   apps/webClient/src/presentation/assets/dashboard_mobile.png

mv /tmp/budgetgenius-marketing-shots/presentation_dashboard.png \
   apps/webClient/src/presentation/assets/presentation_dashboard.png
```

Then `git status` to confirm only the two PNG paths are dirty, and
commit:

```bash
git add apps/webClient/src/presentation/assets/dashboard_mobile.png \
        apps/webClient/src/presentation/assets/presentation_dashboard.png
git commit -m "chore: refresh marketing mockup screenshots"
```

## When to drop the mocks

Future capture runs should swap to capturing the real `/app/dashboard`
once the dev stack is plumbed into CI. The pattern lift is small:

1. Boot `docker compose up -d postgres redis`.
2. Wait for `pg_isready` + `redis-cli ping`.
3. Run the existing `UserSeederService` (`pnpm --filter api seed`)
   OR pass a custom JWT through `localStorage`.
4. Skip the `page.route()` intercepts.
5. Navigate to `/app/dashboard` directly.

The mock script becomes a deterministic fallback for environments
without docker. Keep both paths.

## Operational notes

- **Headless chromium only.** Set `headless: false` temporarily for
  debugging — but never gate CI on it.
- **No console errors expected.** `useRestoreSession` calls
  `/auth/verify` first; if the mock chain is mis-wired, the page will
  paint the splash screen and you'll see `Recent transactions` never
  resolve.
- **Locale is `en-US`.** The Playwright config
  (`apps/webClient/playwright.config.ts:24`) pins this; toggling the
  language-switcher doesn't affect the capture.
