# api

The BudgetGenius backend: NestJS 11, TypeORM 0.3 over PostgreSQL, Redis for
throttling and caching, Passport for auth (local, Google, JWT refresh).

## Run it

```bash
# from the repository root
pnpm install
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL + Redis only
pnpm --filter api dev                            # http://localhost:5000
```

`pnpm dev` at the root starts the API and the web client together. The API reads
`apps/api/.env.development`; copy `.env.example` from the repository root and
fill in the database, Redis and JWT values.

Swagger is served at `/docs` in development only — since v1.10.0 the module is
not registered when `NODE_ENV=production`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | `nest start --watch` (kills whatever holds `PORT`, default 5000) |
| `pnpm build` | `nest build` into `dist/` |
| `pnpm start` | Build, run migrations, then start (production entry) |
| `pnpm test` | Jest, `test/*.spec.ts` |
| `pnpm test:e2e` | Jest with `test/jest-e2e.json` |
| `pnpm migration:generate` | Diff entities against the database |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:show` | List applied and pending migrations |
| `pnpm seed` | Seed the superadmin and reference data |

`migration:run` has a `premigration:run` hook that runs `src/setup-db.ts` first:
the schema `bg_public` must exist before TypeORM connects.

## Layout

```
src/
├── adapters/       # Controllers, repositories, DTOs (HTTP + persistence)
├── application/    # Services per feature area (auth, dashboard, budgets, …)
├── domain/         # Entities and domain rules
├── infrastructure/ # Database module, mailer, logging, config
├── migrations/     # TypeORM migrations, timestamp-prefixed
├── cors.ts         # Allowed origins, exposed headers
└── main.ts         # Bootstrap: prefix, CORS, cookies, Swagger
```

## Environment

`.env.example` at the repository root lists the keys. The ones that change
behaviour:

| Key | Notes |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | Or a single `DB_URL` |
| `REDIS_HOST` `REDIS_URL` `REDIS_PASSWORD` | Throttler storage; optional in development |
| `FRONTEND_URL` | Comma-separated origins accepted by CORS |
| `PUBLIC_API_URL` | Public origin of this API; **required in production** — the Google strategy throws at startup if it is missing or a loopback |
| `SUPERADMIN_EMAIL` `SUPERADMIN_PASSWORD` | Seeded operator account; without them the backoffice answers `403` |
| `RESEND_API_KEY` `MAIL_FROM` | Password recovery; the mailer refuses to boot without the key |

Secrets never belong in the repository. Production values come from the
environment file on the host (or `Sites → Secrets` when deployed as a Worker).

## Behaviour worth knowing before you change it

- **CORS** — `cors.ts` owns the allowed origins, the request headers
  (`Idempotency-Key` included) and the exposed ones (`Retry-After`). A header
  that is not listed there is invisible to the browser, even if the API sends
  it, and a preflight test covers the list (`test/cors-preflight.spec.ts`).
- **Idempotency** — `POST /transactions/import` stores a receipt with the rows
  it inserted keyed by `Idempotency-Key`; a retry with the same key answers from
  that receipt instead of inserting again. This is what makes the offline queue
  safe to replay.
- **Timeouts** — the client sends a 30 s timeout, or 120 s for media, imports and
  AI analysis. The database pool uses the same deadline
  (`connectionTimeoutMillis`).
- **Access log** — `infrastructure/log/access-log.middleware.ts` logs method,
  path without query, status and duration; static assets are filtered out.
- **Tenancy** — every table lives in the `bg_public` schema and every query is
  scoped by `req.user.id`, never by a client-supplied id.

## Tests

Jest specs live in `test/` and run against the module graph with mocks; they do
not need a database. Anything that needs PostgreSQL belongs in a migration test
or in the deploy check, not here.
