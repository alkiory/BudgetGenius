# webClient

The BudgetGenius single-page app: React 19, Vite 6, TypeScript, Tailwind CSS,
TanStack Query and Redux Toolkit. It is the same bundle that ships inside the
Android APK (`apps/mobile`).

## Run it

```bash
# from the repository root
pnpm install
pnpm dev            # API + web client together
pnpm --filter frontend-web dev   # web client alone, http://localhost:5173
```

The API client is `src/infrastructure/api.config.ts` and its base URL is
exactly `VITE_API_URL`. The shipped example points straight at the API
(`http://localhost:5000/api`), which is a cross-origin call the API's CORS list
allows; set the base to `/api` instead if you want the Vite proxy
(`vite.config.ts`) to carry the request and avoid CORS entirely.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Production bundle into `dist/` (also what the APK bundles) |
| `pnpm preview` | Serve the built bundle locally |
| `pnpm check-types` | `tsc -b`, no emit |
| `pnpm lint` | ESLint over `src/**/*.ts{,x}` |
| `pnpm test:unit` | Vitest, `src/**/__tests__/**` |
| `pnpm test` | Vitest, then the Playwright suite in `tests/` |

Playwright needs a running stack and a browser; Vitest does not — keep new unit
tests in `__tests__/` next to the code they cover.

## Layout

```
src/
├── adapters/        # HTTP clients, Redux slices, React Query hooks
├── application/     # Use cases; orchestrate adapters + domain
├── domain/          # Entities, value objects, repository interfaces
├── infrastructure/  # Axios instance, query client, offline queue, platform bridges
└── presentation/    # Pages, components, hooks, i18n, styling
```

The dependency rule is the usual Clean Architecture one: `presentation →
application → domain`, with `adapters` and `infrastructure` implementing what
`domain` declares. A component that imports an adapter's HTTP call directly is
a bug, not a shortcut.

Path aliases (`@adapters`, `@application`, `@domain`, `@infrastructure`,
`@presentation`) are declared in `tsconfig` and mirrored in `vitest.config.ts`.
Add a new alias in both places or the unit tests stop resolving it.

## Environment

| Variable | Used for |
|---|---|
| `VITE_API_URL` | API base URL in the deployed bundle |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Google sign-in (web and native) |
| `VITE_APP_VERSION` | Version baked into the bundle, compared against `releases/latest` |

Local values go in `apps/webClient/.env.development`; production values are
injected at build time. Never commit either file.

## Behaviour worth knowing before you change it

- **Offline writes** — a mutation that cannot reach the network is stored in
  `localStorage` under `offline_queue` and replayed when the connection
  returns; logout clears it. The interceptor reports `_offline` to the caller
  instead of an error, so the optimistic UI closes its modal.
- **Errors and retries** — the Axios interceptor refreshes on `401`, ends the
  session on an unrecoverable one (clearing the React Query cache), and reports
  proxy `502/503/504` as "API down" rather than as a validation error. The
  shared `queryClient` sets no retry policy of its own: each query passes its
  own `retry` count, so a `4xx` is retried as often as that query asks.
- **Design tokens and components** — read [`DESIGN.md`](../../DESIGN.md) before
  changing public UI. Icons come from `@animateicons/react` through
  `presentation/components/ui/animated-icons.tsx`; do not add `lucide-react` or
  hand-drawn SVG paths.

## Tests

Vitest runs in the `node` environment with explicit imports (`globals: false`)
and refuses to load CSS, which is why `vitest.config.ts` exists separately from
`vite.config.ts`. Playwright specs live in `tests/` and mock the API per spec.

Some native behaviour is unit-tested too: `__tests__/apk-update.spec.ts` covers
the release check and download keying, and
`adapters/auth/__tests__/native-google-login.strategy.spec.ts` covers the
account-reauth matcher. The end-to-end device flows live in `tests/` (Playwright)
against a mocked bridge.
