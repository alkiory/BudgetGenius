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
  `X-Requested-With`, `X-Device-Id`) and the exposed ones (`Content-Type`,
  `Authorization`, `X-Requested-With`). A header that is not listed there is
  invisible to the browser even if the API sends it, and
  `test/cors-preflight.spec.ts` pins the list. Adding a request header on the
  client means adding it here first.
- **Idempotency** — `POST /transactions/import` stores a receipt with the rows
  it inserted, keyed by `Idempotency-Key`; a retry carrying the same key answers
  from that receipt instead of inserting again. The deduplication only happens
  when the caller sends the header: a replay that omits it is a second import.
- **Tenancy** — every table lives in the `bg_public` schema and every query is
  scoped by `req.user.id`, never by a client-supplied id.
- **Timeouts** — the Axios client sets no default timeout and the pool uses the
  driver defaults; a stuck request is bounded by the proxy, not by the code.

## Tests

Jest specs live in `test/` and run against the module graph with mocks; they do
not need a database. Anything that needs PostgreSQL belongs in a migration test
or in the deploy check, not here.

`pnpm test` runs the default Jest config, whose `testRegex` (`.*\.spec\.ts$`)
does not match `*.e2e-spec.ts`. Those boot the real `AppModule` through
`test/jest-e2e.json` and are **not** part of CI — run `pnpm test:e2e` yourself
when you touch auth, CORS or the throttler.
