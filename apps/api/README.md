# api

The BudgetGenius backend: NestJS 11, TypeORM 0.3 over PostgreSQL, Redis for
throttling and caching, Passport for auth (local, Google, JWT refresh).

## Run it

```bash
# from the repository root
pnpm install
cp apps/api/.env.example apps/api/.env.development

# PostgreSQL + Redis only: docker-compose.dev.yml declares no images of its
# own, it overlays the base file.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis

pnpm --filter api migration:run   # creates bg_public and the tables
pnpm --filter api dev             # http://localhost:5000
```

`pnpm dev` at the root starts the API and the web client together. For a run
outside Docker, `DB_HOST` and `REDIS_HOST` must be `localhost`: the values
shipped in `.env.example` are the compose service names (`database`, `redis`).
`RESEND_API_KEY` is required even for a local boot — the mailer refuses to
construct without it.

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
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | Required. `DB_URL` exists in the example file but the API does not read it |
| `REDIS_HOST` `REDIS_URL` `REDIS_PASSWORD` | Throttler storage; optional in development |
| `FRONTEND_URL` | Comma-separated origins accepted by CORS |
| `PUBLIC_API_URL` | Public origin of this API; **required in production** — the Google strategy throws at startup if it is missing or a loopback |
| `SUPERADMIN_EMAIL` `SUPERADMIN_PASSWORD` | Seeded operator account; without them the backoffice answers `403` |
| `RESEND_API_KEY` `MAIL_FROM` | Password recovery; the mailer refuses to boot without the key |

Secrets never belong in the repository. Production values come from the
environment file on the host (or `Sites → Secrets` when deployed as a Worker).

## Behaviour worth knowing before you change it

- **CORS** — `buildCorsOptions` in `cors.ts` owns the allowed origins, the
  accepted request headers (`Content-Type`, `Authorization`,
  `X-Requested-With`, `X-Device-Id`, `Idempotency-Key`) and the exposed ones
  (`Content-Type`, `Authorization`, `X-Requested-With`, `Retry-After`). A
  header that is not listed there is invisible to the browser even if the API
  sends it, and `test/cors-preflight.spec.ts` pins the list. Adding a request
  header on the client means adding it here first; dropping `Idempotency-Key`
  or `Retry-After` silently breaks replay and throttling.
- **Idempotency** — `POST /transactions/import` stores a receipt with the rows
  it inserted, keyed by `(userId, Idempotency-Key)`; a retry carrying the same
  key answers from that receipt instead of inserting again. The web client
  generates the key per import and keeps it on the queued row, so an offline
  replay is deduplicated. A caller that omits the header gets a second import.
- **Tenancy** — every table lives in the `bg_public` schema and every query is
  scoped by `req.user.id`, never by a client-supplied id.
- **Timeouts** — the Axios client defaults to 30 s, with 120 s for media
  uploads, spreadsheet imports and AI analysis. The database pool gives up on a
  connection after 10 s (`connectionTimeoutMillis` in both `AppModule` and
  `DatabaseModule`).
- **Access log** — `infrastructure/log/access-log.middleware.ts` logs method,
  path without query, status and duration; static assets are filtered out so the
  log stays readable.

## Tests

Jest specs live in `test/`. Most mock the module graph, but **the default suite
is not database-free**: `user-delete-permission.spec.ts` boots the real
`AppModule`, deletes a user and asserts the cascade against live tables. CI runs
it against a PostgreSQL service after `pnpm --filter api migration:run`, so make
sure `DB_*` and `REDIS_*` point at a running stack before `pnpm test`.

`*.e2e-spec.ts` files are the other half: the default `testRegex`
(`.*\.spec\.ts$`) does not match them, they run through `test/jest-e2e.json`
with `pnpm test:e2e`, and CI never calls that command. Run them yourself when
you touch auth, CORS or the throttler.
