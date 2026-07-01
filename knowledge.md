# BudgetGenius — AI Model Knowledge Guide

> **Purpose:** This document provides a comprehensive, structured understanding of the BudgetGenius codebase to enable AI coding agents (GitHub Copilot, Claude, Cursor, etc.) to effectively navigate, extend, and build upon this repository. It should be read before any development task begins.

---

## 1. Project Identity

**BudgetGenius** is a full-stack personal finance management web application. It allows users to track income and expenses, create budgets, set savings goals, and receive AI-powered financial insights.

- **Target Users:** Individuals managing personal or household finances.
- **Business Model:** Freemium — core features are free; reports, savings goals, and investment tracking are premium-gated.
- **Language Support:** English & Spanish (bilingual UI and AI assistant).

---

## 2. High-Level Architecture

```
                       ┌──────────────────┐
                       │   webClient      │  React 19 + Vite 6
                       │   (port 3001)    │  Tailwind CSS + Recharts
                       └────────┬─────────┘
                                │ HTTP (axios)
                       ┌────────▼─────────┐
                       │   api            │  NestJS 10
                       │   (port 3000)    │  TypeORM + Passport.js
                       └──┬──────┬──────┬─┘
                          │      │      │
                    ┌─────▼┐ ┌──▼──┐ ┌─▼────┐
                    │PostgreSQL│Redis│ │OpenAI│
                    │(RDS/15) │(7.2)│ │(GPT) │
                    └─────────┘└─────┘ └──────┘
```

### 2.1 Monorepo Structure

The project is a **pnpm workspace monorepo** orchestrated by **Turbo**:

```
BudgetGenius/
├── apps/
│   ├── api/              # NestJS backend
│   └── webClient/        # React/Vite frontend
├── docs/
│   └── rpi/              # RPI Framework (Research, Plan, Implement)
├── scripts/
│   └── bootstrap.sh       # One-command setup script
├── docker-compose.yml     # Base service definitions
├── docker-compose.dev.yml # Development overrides
├── docker-compose.prod.yml# Production overrides
├── turbo.json             # Turbo pipeline configuration
├── pnpm-workspace.yaml   # Workspace definition
└── package.json           # Root workspace scripts
```

### 2.2 Layered Architecture (Both Frontend & Backend)

Both apps follow a **Clean Architecture / Hexagonal** pattern with strict layer separation:

| Layer | Backend (`apps/api/src/`) | Frontend (`apps/webClient/src/`) |
|-------|--------------------------|----------------------------------|
| **Domain** | `domain/` — Entities, repository port interfaces, value objects | `domain/` — Entity types, repository interfaces |
| **Application** | `application/` — Service classes (business logic) | `application/` — Service functions |
| **Infrastructure** | `infrastructure/` — Modules, controllers, strategies, config, middleware | `infrastructure/` — API config, Firebase config, error boundary |
| **Adapters** | `adapters/` — Repository implementations, HTTP controllers, DTOs | `adapters/` — HTTP repository implementations, Redux store, hooks, context |

**Critical rule:** Dependencies point inward. Domain never imports from Application or Infrastructure.

---

## 3. Tech Stack

### Backend (`apps/api`)
| Category | Technology | Version |
|----------|-----------|---------|
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.7 |
| ORM | TypeORM | 0.3.21 |
| Database | PostgreSQL | 15 |
| Cache/Sessions | Redis (ioredis) | 5.5 |
| Auth | Passport.js, JWT, bcryptjs, Firebase Admin | — |
| Rate Limiting | @nestjs/throttler + Redis | 6.4 |
| API Docs | Swagger/OpenAPI (@nestjs/swagger) | 11.x |
| AI | OpenAI SDK | 4.x |
| Logging | Winston + Morgan | — |
| Package Manager | pnpm | 10.x |

### Frontend (`apps/webClient`)
| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.0 |
| Build Tool | Vite | 6.2 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.x |
| State Management | Redux Toolkit + React Query (TanStack) | — |
| Routing | React Router | 7.3 |
| Charts | Recharts | 2.x |
| Icons | Lucide React | — |
| Testing | Playwright | 1.51 |
| Auth | Firebase JS SDK | 11.x |

### Infrastructure
| Category | Technology |
|----------|-----------|
| CI/CD | GitHub Actions |
| Containerization | Docker + Docker Compose |
| Hosting (Frontend) | Vercel + Firebase Hosting |
| Hosting (Backend) | Docker on VPS / AWS |
| DB Hosting | AWS RDS (PostgreSQL) |
| Monorepo Orchestration | Turbo |

---

## 4. Directory Structure & Layer Conventions

### 4.1 Backend: `apps/api/src/`

```
apps/api/src/
├── main.ts                         # Bootstrap — creates NestJS app
├── app.module.ts                   # Root module — all imports registered
├── app.service.ts                  # Root service
├── app.controller.ts               # Root controller (health, status)
├── data-source.ts                  # TypeORM CLI DataSource config
├── setup-db.ts                     # Database setup helper
├── domain/                         # ——— CORE BUSINESS LAYER ———
│   ├── index.ts
│   ├── auth/
│   │   ├── AuthRepository.ts       # Repository port (interface)
│   │   ├── auth.entity.ts          # Auth-related types
│   │   └── password-reset.entity.ts
│   ├── user/
│   │   ├── user.entity.ts          # User TypeORM entity
│   │   ├── user-settings.entity.ts # UserSettings TypeORM entity
│   │   ├── UserRepository.ts       # Repository port (interface)
│   │   ├── UserAuthProvider.ts
│   │   ├── UserEmail.ts
│   │   └── UserPassword.ts
│   └── dashboard/
│       ├── transaction.entity.ts
│       ├── budget.entity.ts
│       ├── budget-category.entity.ts
│       ├── expense-category.entity.ts
│       ├── goal.entity.ts
│       ├── saving-goal.entity.ts
│       ├── income.entity.ts
│       └── overview.entity.ts
├── application/                    # ——— BUSINESS LOGIC LAYER ———
│   ├── auth/
│   │   ├── auth.service.ts
│   │   └── dto/                    # Data Transfer Objects
│   ├── user/
│   │   ├── user.service.ts
│   │   ├── user-seeder.service.ts
│   │   ├── user-settings.service.ts
│   │   └── dto/
│   ├── ai/
│   │   └── ai.service.ts           # OpenAI "Finny" assistant
│   └── dashboard/
│       └── services/               # Transaction, Budget, Goal, etc.
├── infrastructure/                 # ——— TECHNICAL DETAILS LAYER ———
│   ├── database.module.ts
│   ├── core/core.module.ts         # Core middleware setup
│   ├── middleware/
│   │   └── user-settings.middleware.ts
│   ├── config/
│   │   ├── strategy/jwt.strategy.ts
│   │   ├── cookie.service.ts
│   │   ├── redis.service.ts
│   │   └── throttler-behind-proxy.guard.ts
│   ├── auth/
│   │   ├── google.strategy.ts
│   │   ├── firebase-auth.strategy.ts (middleware)
│   │   └── module/auth.module.ts
│   ├── log/logger.service.ts       # Winston wrapper
│   ├── dashboard/dashboard.module.ts
│   ├── user/user.module.ts
│   ├── user/user-settings.module.ts
│   └── ai/module/ai.module.ts
├── adapters/                       # ——— IMPLEMENTATION LAYER ———
│   ├── app.controller.ts           # Root + Test controllers
│   └── dashboard/
│       ├── http/                   # Controllers (Transaction, Budget, etc.)
│       └── persistence/           # Repository implementations
└── migrations/                     # TypeORM migration files
```

### 4.2 Frontend: `apps/webClient/src/`

```
apps/webClient/src/
├── main.tsx                        # Entry point
├── App.tsx                         # Root component (wraps with ErrorBoundary, Routes, Toaster)
├── index.css                       # Global styles + Tailwind directives
├── domain/                         # ——— CORE BUSINESS LAYER ———
│   ├── auth/
│   │   ├── AuthRepository.ts       # Repository interface
│   │   └── auth.entity.ts
│   ├── user/
│   │   ├── UserRepository.ts
│   │   ├── user.entity.ts
│   │   └── userSettings.ts
│   ├── dashboard/
│   │   ├── dashboard.entity.ts
│   │   ├── dashboard.repository.ts
│   │   └── ... (budgets, goals, etc.)
│   └── index.ts
├── application/                    # ——— BUSINESS LOGIC LAYER ———
│   ├── auth/auth.service.ts
│   └── user/user.service.ts
├── infrastructure/                 # ——— TECHNICAL DETAILS LAYER ———
│   ├── api.config.ts               # Axios instance
│   ├── firebaseConfig.ts
│   ├── errorBoundary.tsx
│   ├── request-queue.ts
│   └── toast.config.tsx
├── adapters/                       # ——— IMPLEMENTATION LAYER ———
│   ├── http/                       # Repository implementations (budget, transaction, etc.)
│   ├── store/rootStore.ts          # Redux store
│   ├── hooks/                      # Custom hooks (useMobile, themeContext, etc.)
│   ├── storage/cookie.util.ts
│   └── query/                      # React Query hooks
├── presentation/                   # ——— UI LAYER ———
│   ├── utils/
│   │   ├── routes.ts               # Route names + paths enums
│   │   ├── color.ts
│   │   ├── currencyService.ts
│   │   ├── localeInspector.ts
│   │   └── toast.tsx
│   ├── routes/
│   │   ├── route-config.tsx        # All route definitions
│   │   ├── protected-route.tsx     # Auth guard
│   │   └── premium-pages.tsx       # Premium feature guard
│   ├── layouts/
│   │   ├── landing.tsx             # Public landing layout
│   │   ├── auth.tsx                # Auth pages layout
│   │   └── main.tsx                # Dashboard layout (sidebar + header)
│   ├── pages/
│   │   ├── cta.tsx                 # Homepage/landing
│   │   ├── auth/                   # Login, Signup, Forgot/Reset Password
│   │   ├── dashboard/              # Dashboard, Transactions, Budgets, Goals, etc.
│   │   ├── upgrade/                # Premium upgrade page
│   │   ├── contact/                # Privacy, Terms, Contact Sales
│   │   ├── demo/                   # How It Works
│   │   └── user/                   # Profile, User List
│   └── components/
│       ├── ui/                     # Reusable UI primitives (Button, Card, Input, Modal, etc.)
│       ├── dashboard/              # Dashboard-specific (sidebar, header, main-content)
│       ├── profile/                # Profile-specific components
│       └── logo.tsx, loader.tsx, etc.
└── tests/                          # Playwright E2E tests
```

### 4.3 Import Aliases (tsconfig paths)

**Backend (`apps/api/tsconfig.json`):**
```
@domain/*       → src/domain/*
@application/*  → src/application/*
@infrastructure/* → src/infrastructure/*
@adapters/*     → src/adapters/*
```

**Frontend (`apps/webClient/vite.config.ts`):**
```
@domain/*       → src/domain/*
@application/*  → src/application/*
@infrastructure/* → src/infrastructure/*
@adapters/*     → src/adapters/*
@presentation/* → src/presentation/*
```

> **Always use these aliases** in imports. Never use relative paths like `../../domain/...`.

---

## 5. Domain Model

### 5.1 Entity Relationship Diagram

```
User (1) ──────< Transaction (N)
User (1) ──────< Budget (N) ──────< BudgetCategory (N)
User (1) ──────< Goal (N)
User (1) ──────< SavingGoal (N)
User (1) ──────< Income (N)
User (1) ──────< Overview (N)       # Monthly snapshots
User (1) ──────< ExpenseCategory (N)
User (1) ──────< UserSettings (N)
                   # note ①
```

> **Note ①:** UserSettings is `@ManyToOne` on User with no `OneToMany` inverse declared on the User entity — it exists in the database schema but is not navigable from User via TypeORM relations.

### 5.2 Entity Details

| Entity | Table | Key Fields | Notes |
|--------|-------|-----------|-------|
| **User** | `users` | id, name, surname, email, password (nullable), authProvider ('email'\|'google'), role, isPremium, refreshToken | bcrypt hashing via `@BeforeInsert`/`@BeforeUpdate` hooks. Emails are used as login identifiers. |
| **Transaction** | `transactions` | id, date, description, category, amount, status, userId FK | Core financial record. Amount uses numeric transformer. |
| **Budget** | `budgets` | id, name, period, startDate, endDate, totalAllocated, totalSpent, userId FK | One budget has many BudgetCategories (cascade). |
| **BudgetCategory** | `budget_categories` | id, name, allocated, spent, budgetId FK | Belongs to a Budget. CASCADE delete from budget. |
| **Goal** | `goals` | id, name, description, targetAmount, currentAmount, startDate, dueDate, status, type, contributionFrequency, notes, userId FK | Long-term financial goals. Status defaults to 'active'. Type defaults to 'short-term'. |
| **SavingGoal** | `saving_goals` | id, name, current, target, percentage, targetDate, category, color, userId FK | Premium feature. Visual progress tracking. |
| **Income** | `incomes` | id, date, description, amount, category, recurrence, userId FK | Recurring income tracking. |
| **Overview** | `overview` | id, balance, income, expenses, period, userId FK | Monthly financial snapshots/aggregates. |
| **ExpenseCategory** | `expense_categories` | id, name, value, userId FK | User-defined expense categorization. |
| **UserSettings** | `user_settings` | id, timezone, currency, locale, userId FK | Per-user localization preferences. |
| **PasswordReset** | `password_reset_tokens` | id, email, token, createdAt | Temporary tokens for password reset flow. |

### 5.3 Database Schema

All tables live under the **`bg_public`** PostgreSQL schema (not `public`). Entity decorators don't explicitly set schema — it's configured at the TypeORM connection level.

---

## 6. Key Patterns & Conventions

### 6.1 Authentication Flow

1. **Email/Password Login:** User sends credentials → `AuthService.login()` validates locally in dev, verifies with Firebase in production → JWT access token (1h) + refresh token (7d) issued → refresh token stored in Redis.
2. **Google OAuth:** Redirect to Google → callback → `GoogleStrategy` → `AuthService.validateOAuthUser()` (transactional upsert) → JWT tokens returned via postMessage to opener window.
3. **Firebase Login:** Frontend sends Firebase ID token → `FirebaseAuthMiddleware` verifies with Firebase Admin SDK → user attached to request.
4. **Token Refresh:** Client sends refresh token → `AuthService.refreshToken()` validates against Redis → new access token issued.
5. **Token Extraction:** JWT strategy tries cookies first (`accessToken` cookie), then `Authorization: Bearer <token>` header.
6. **Rate Limiting:** 4 requests per 10 seconds per device/client IP, stored in Redis.

### 6.2 Repository Pattern

Every domain aggregate has a **port interface** in `domain/` and an **implementation** in `adapters/`.

**Backend example:**
```typescript
// domain/auth/AuthRepository.ts — interface
export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  // ...
}

// adapters/auth/persistence/auth.repository.ts — implementation
@Injectable()
export class AuthRepositoryImpl implements AuthRepository { ... }
```

**Frontend example:**
```typescript
// domain/dashboard/budgets/budget.repository.ts — interface
export interface BudgetRepository {
  getAll(): Promise<Budget[]>;
  // ...
}

// adapters/http/budget.repository.ts — implementation using axios
export const HttpBudgetRepository: BudgetRepository = { ... }
```

### 6.3 Controller → Service → Repository Flow

```
HTTP Request → Controller (adapters/dashboard/http/*.controller.ts)
            → Service (application/dashboard/services/*.service.ts)
            → Repository (adapters/dashboard/persistence/*.repository.ts)
            → TypeORM Entity → PostgreSQL
```

Controllers handle HTTP concerns (validation, status codes). Services handle business logic. Repositories handle data access.

### 6.4 Naming Conventions

- **Files:** kebab-case (`transaction.service.ts`, `saving-goal.entity.ts`)
- **Classes/Interfaces:** PascalCase (`TransactionService`, `AuthRepository`)
- **Variables/Functions:** camelCase (`findByEmail`, `userId`)
- **Constants:** UPPER_SNAKE_CASE for environment-related only
- **Enums:** PascalCase (`RoutePaths`, `UserRole`)
- **Database tables:** snake_case (configured via TypeORM defaults)
- **Database columns:** camelCase in entities, snake_case in database (via `name` option in `@Column`)

### 6.5 Import Organization

Imports are grouped in this order (separated by blank lines):
1. Third-party libraries
2. NestJS-specific modules
3. Project internal modules (using aliases)

### 6.6 Module Registration Pattern (Backend)

All modules are registered in `app.module.ts`. New features follow this pattern:
1. Create entity in `domain/`
2. Add to TypeORM `forFeature()` in the module
3. Create repository port interface
4. Create repository implementation
5. Create service in `application/`
6. Create controller in `adapters/`
7. Register all in the module's `providers` and `controllers`
8. Import the module in `app.module.ts`

### 6.7 Route Registration Pattern (Frontend)

All routes use the `RoutePaths` enum from `presentation/utils/routes.ts`. New routes:
1. Add path to `RoutePaths` enum
2. Add route definition to `route-config.tsx`
3. Place under `ProtectedRoute` for authenticated, `PremiumRoute` for premium

### 6.8 Redux Selector + Router Guard Pitfalls (read before touching any `useSelector` or guarded `<Route>`)

Two production-blocking pitfalls surfaced during the Android APK dev audit, 2026-06. Both are subtle enough that lint cannot catch them; codification here is the only line of defense.

#### 6.8.1 react-redux combined-slice `useSelector` trap

**The bug class.** React-Redux v9 (`useSelector`) is backed by React 19's
`useSyncExternalStore`, which compares the selector's current result to the
previous one via `Object.is`. If the selector returns a fresh reference on
every call (a new object, array, or anything `!==` the prior value),
React's "getSnapshot should be cached" guard fires and the component falls
into a render loop (or renders nothing under StrictMode). This bug bit us
in `apps/webClient/src/presentation/routes/protected-route.tsx` on 2026-06
after a rewrite that combined three auth slice fields into one selector —
production symptom was that `/app/*` routes simply stopped painting on
hard refresh.

**Rule of thumb.** When you need more than one field from the same slice,
default to one leaf selector per field. Only fall back to a single object
select when you genuinely cannot split it, and in that case pass
`shallowEqual` as the second argument to `useSelector`.

```tsx
// ❌ WRONG — returns a fresh object every render; trips StrictMode.
const { isAuthenticated, user, authReady } = useSelector(
  (state: RootState) => state.auth,
);

// ❌ WRONG — inline object literal; same "new ref every render" failure.
const view = useSelector((state: RootState) => ({
  user: state.auth.user,
  locale: state.userSettings.settings.locale,
}));

// ✅ RIGHT — three leaf selectors; each is `===`-stable until its own
// field mutates, so unrelated dispatches don't trigger re-renders.
const isAuthenticated = useSelector(
  (state: RootState) => state.auth.isAuthenticated,
);
const user = useSelector((state: RootState) => state.auth.user);
const authReady = useSelector((state: RootState) => state.auth.authReady);

// ✅ ALSO RIGHT — when grouping > ~3 fields is unavoidable, opt in to
// shallow comparison so a value-equality update triggers re-render.
import { shallowEqual, useSelector } from "react-redux";
const view = useSelector(
  (state: RootState) => ({
    user: state.auth.user,
    locale: state.userSettings.settings.locale,
    currency: state.userSettings.settings.currency,
  }),
  shallowEqual,
);
```

**What is *not* a bug.** Whole-slice selectors like
`useSelector((state) => state.userSettings)` followed by a destructure
(`const { settings } = userSetting`) are safe in this codebase because
Redux Toolkit uses Immer, which preserves a slice's reference until a
mutation actually touches that path. The ~15 call sites in
`apps/webClient/src/presentation/components/**` that read
`userSettings` and pull out `.settings` (then `.currency`, `.locale`,
etc.) follow this pattern and are fine — they re-render only when
something inside that slice genuinely changes.

**Lint hook (TODO).** There is no ESLint rule yet that flags inline
object literals inside `useSelector`. Adding `react-redux/no-new-object-selectors`
(or a hand-rolled `no-restricted-syntax` AST rule) would catch this in CI
before it ships — see the open follow-up.

#### 6.8.2 React Router self-redirect in guarded `<Route>` subtrees (Android APK audit, 2026-06)

**The bug class.** When a `<Route element={Guard}>` component contains BOTH a `<Navigate>` redirect predicate AND the `<Route>` that matches the redirect target, React Router aborts the self-redirect after a small threshold and leaves the DOM empty. No console error, no Suspense fallback, no ErrorBoundary trigger — just an empty `#root`. Production symptom: `/app/onboarding` rendered a completely blank page in the Capacitor Android dev environment, with the React tree refusing to mount at all.

The trap, in the original combined-guard shape (deleted in this fix):

```tsx
// ❌ WRONG — `/app/onboarding` lives INSIDE the same guard that
// redirects to it. A fresh user hitting any /app/* route triggers
// an infinite <Navigate> to self → DOM emptied silently.
<Route path={RoutePaths.App} element={<ProtectedRoute />}>
  <Route
    path={RoutePaths.Onboarding}
    element={<OnboardingPage />}
  />
  <Route path={RoutePaths.Dashboard} element={<DashboardPage />} />
  ...
</Route>

// ProtectedRoute (deleted) internally:
//   if (settings?.hasCompletedOnboarding === false)
//     return <Navigate to={RoutePaths.Onboarding} replace />;
```

Trace of the loop, for `settings.hasCompletedOnboarding === false`:

1. User navigates to `/app/dashboard`.
2. `<Route element={<ProtectedRoute />}>` mounts. Predicate fires `=== false` → `<Navigate to="/app/onboarding" replace />`.
3. Router matches `/app/onboarding` which is INSIDE the same `<Route element={<ProtectedRoute />}>`. The guard re-mounts.
4. Same `=== false` predicate fires again → `<Navigate to="/app/onboarding" replace />`.
5. After ~3 loops, React Router aborts the cycle. `#root` stays empty.

**The rule.** Any guard that can `<Navigate>` to a target path MUST NOT also be the layout element for that target's `<Route>`. Split into two guards: an outer `AuthGuard` that owns the parent layout, and an inner **sibling** `OnboardingGuard` that EXCLUDES the target path so the wizard itself never re-enters the freshness check.

```tsx
// ✅ RIGHT — `/app/onboarding` is a direct SIBLING of the
// OnboardingGuard layout route, NOT a child. Same `=== false`
// predicate never re-evaluates against itself → no loop.
// AuthGuard owns auth; OnboardingGuard owns freshness; both
// render an <Outlet /> (or a layout component that owns its own
// internal <Outlet />) so matched child routes still mount.
<Route path={RoutePaths.App} element={<AuthGuard />}>
  {/* Direct sibling — NO OnboardingGuard around this one. */}
  <Route
    path={RoutePaths.Onboarding}
    loader={LoadingPage}
    element={<OnboardingPage />}
  />
  {/* Layout-level guard for every other /app/* route. */}
  <Route element={<OnboardingGuard />}>
    <Route path={RoutePaths.Dashboard} element={<DashboardPage />} />
    ...
  </Route>
</Route>
```

**Three pre-merge questions.** If you can answer YES to any of these before shipping a route refactor, you're at risk of re-introducing the loop:

1. Does the top-level `<Route element={...}>` of a guarded path ALSO wrap the `<Route>` for the redirect target?
2. Does the redirect predicate (e.g. `!== true` / `=== false`) re-fire on the same dataset the second time the guard evaluates?
3. Does the target page's URL equal the redirect source (e.g. both are `/app/onboarding`)?

If YES to any — split the guard. The rule generalizes beyond onboarding: any "freshness" or "first-run" gate with a redirect-to-wizard path is at risk. Other guards in this codebase (e.g. `premium-pages.tsx`) should be re-audited against this rule on next touch.

**Defense-in-depth invariants preserved by both new guards** (do not regress on future refactors):

- **§6.8.1 invariant.** Each guard uses three leaf `useSelector` calls (one per field) for the auth slice. Do NOT collapse them into a single object selector — that re-introduces the §6.8.1 trap.
- **Strict `=== false` predicate.** `OnboardingGuard` checks `settings?.hasCompletedOnboarding === false` (not `!== true`) so transient settings fetch errors / undefined / null responses never bounce an existing user back to an already-finished wizard.
- **Original `&&` predicate preserved.** `AuthGuard` keeps `if (!isAuthenticated && !user)` — the same condition the original combined `ProtectedRoute` used. Changing it to `||` would alter the half-warmed state semantics.
- **No `<MainLayout>` children prop.** `OnboardingGuard` returns `<MainLayout />` directly because `MainLayout` owns its own internal `<Outlet />` and ignores the children prop. Wrapping `<MainLayout><Outlet /></MainLayout>` creates a dead React element with no rendered children.

**Files in this fix (delete-and-create pattern, not in-place edit):**

- DELETED `apps/webClient/src/presentation/routes/protected-route.tsx` — combined auth + onboarding gate; the source of the loop.
- DELETED `apps/webClient/src/presentation/routes/OnboardingRoute.tsx` — lazy wrapper, made obsolete once `OnboardingPage` became lazy directly.
- NEW `apps/webClient/src/presentation/routes/auth-guard.tsx` — auth-only, three leaf `useSelector`s, renders `<Outlet />`.
- NEW `apps/webClient/src/presentation/routes/onboarding-guard.tsx` — settings + `=== false` redirect, renders `<MainLayout />`.
- MODIFIED `apps/webClient/src/presentation/routes/route-config.tsx` — `<Route path={RoutePaths.App} element={<AuthGuard />}>` parent; `/app/onboarding` direct sibling; rest under `<Route element={<OnboardingGuard />}>`.
- NARRATIVE CLEANUP in `apps/webClient/src/adapters/slices/user-settings/settingsSlice.ts` — swapped the `protected-route.tsx` reference for `OnboardingGuard` in the comment explaining the `hasCompletedOnboarding: false` default.

**Lint hook (TODO).** No static rule yet catches a `<Route element={Guard}>` whose guard redirects to a `<Route>` inside its own subtree. A custom ESLint rule walking React Router's JSX tree (resolve the `Route element` prop chain into a redirect-predicate AST map; flag any guard component whose return is `<Navigate to={x}>` where `x` is matched by a `<Route>` in the same parent) would catch this in CI. See the open follow-up.

---

## 7. Development Workflow

### 7.1 Quick Start

```bash
# One-command setup
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh

# Or manual:
pnpm install
cp apps/api/.env.example apps/api/.env.development
cp apps/webClient/.env.example apps/webClient/.env.development
# Fill in env vars, then:
pnpm dev    # Starts both API + Frontend via Turbo
```

### 7.2 Individual Service Development

```bash
# Backend only
cd apps/api && pnpm run dev

# Frontend only
cd apps/webClient && pnpm run dev
```

### 7.3 Docker Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# Starts: PostgreSQL, Redis, Backend (3000), Frontend (3001)
```

### 7.4 Key Commands (from root)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in dev mode |
| `pnpm build` | Build entire workspace |
| `pnpm test` | Run all tests |
| `pnpm --filter api test` | Run backend tests only |
| `pnpm --filter frontend-web test` | Run frontend Playwright tests |
| `pnpm --filter api migration:run` | Run database migrations |
| `pnpm --filter api migration:create` | Create new migration |

### 7.5 Quality Gates (per RPI Implement Phase)

Before marking any task complete:
1. **Build** must pass (no compilation errors)
2. **Lint** must pass (no lint violations)
3. **Tests** must pass (no test failures)

---

## 8. Environment Configuration

### 8.1 Required Environment Variables

**Backend (`apps/api/.env.development`):**

```env
# Database
DB_HOST=database            # 'database' for Docker, 'localhost' for local
DB_PORT=5432
DB_USER=postgres_admin_dev
DB_PASS=dev_password
DB_NAME=budgetgenius_dev
DB_URL=postgresql://...

# Server
HOST=0.0.0.0
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# JWT (REQUIRED — app won't start without it)
JWT_SECRET=<generated-secret>

# Redis
REDIS_HOST=redis            # 'redis' for Docker, 'localhost' for local
REDIS_PORT=6379

# OpenAI (for AI assistant)
OPENAI_API_KEY=sk-...

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Firebase (optional — multiple vars)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=
```

**Frontend (`apps/webClient/.env.development`):**

```env
VITE_API_URL=http://localhost:3000/api
VITE_FRONTEND_URL=http://localhost:3001

# Firebase (optional)
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

---

## 9. CI/CD & Deployment

### 9.1 GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to main, PR to main/dev | Backend tests + Docker build/push + SSH deploy; Frontend tests |
| `playwright.yml` | Push to main/dev, PR | E2E Playwright tests |
| `firebase-hosting-merge.yml` | Push to main | Deploy frontend to Firebase Hosting |
| `firebase-hosting-pull-request.yml` | PR | Preview channel on Firebase Hosting |

### 9.2 Deployment Targets

- **Frontend:** Vercel (primary) + Firebase Hosting (static files)
- **Backend:** Docker container on VPS (SSH deploy via GitHub Actions)
- **Database:** AWS RDS PostgreSQL (production) / Docker PostgreSQL (dev)
- **Cache:** Redis (Docker in dev, managed in prod)

### 9.3 Docker Services

| Service | Container Name (dev) | Port Mapping | Purpose |
|---------|---------------------|-------------|---------|
| backend | bg-backend-dev | 3000:5000 | NestJS API |
| frontend | bg-frontend-dev | 3001:80 | React SPA (nginx) |
| database | bg-db-dev | 5432:5432 | PostgreSQL 15 |
| redis | bg-redis-dev | 6379:6379 | Redis 7.2 |

---

## 10. Testing Strategy

### 10.1 Backend Tests (Jest)

- **Location:** `apps/api/test/`
- **Types:** Unit tests for services, E2E tests for API endpoints
- **Config:** `jest.config.ts` (unit), `test/jest-e2e.json` (e2e)
- **Status:** ✅ **15 tests passing** — all service tests pass, including `auth-service.spec.ts`, `user-service.spec.ts`, and `transaction.service.spec.ts`
- **Key test files:**
  - `user-service.spec.ts`
  - `auth-service.spec.ts`
  - `transaction.service.spec.ts`
  - `user.e2e-spec.ts`
  - `app.e2e-spec.ts`

### 10.2 Frontend Tests (Playwright)

- **Location:** `apps/webClient/tests/`
- **Types:** E2E browser tests
- **Config:** `playwright.config.ts` (baseURL: `http://localhost:5173` — Vite dev server)
- **Status:** ✅ **15 tests passing** — all `home.spec.ts` and `auth.spec.ts` tests pass in ~11s
- **Key test files:**
  - `home.spec.ts` — Landing page, theme toggle, and how-it-works navigation
  - `auth.spec.ts` — Login validation, successful authentication flow
  - `i18n.spec.ts` — Bilingual support (English/Spanish locale switching)
- **Mocks:** `tests/mocks/` directory

### 10.3 Running Tests

```bash
# All tests
pnpm test

# Backend only
pnpm --filter api test

# Frontend E2E only
pnpm --filter frontend-web test

# Frontend with UI
pnpm --filter frontend-web test:ui
```

---

## 11. RPI Framework Integration

This project integrates the **RPI (Research, Plan, Implement)** framework for structured, AI-assisted development. The framework is documented in `docs/rpi/`.

### 11.1 When to Use RPI

Use RPI for any non-trivial feature or change request. Do NOT use RPI for:
- Single-line bug fixes
- Typo corrections
- Trivially obvious changes

### 11.2 Phase Flow

```
Ambiguity → [Research] → [Plan] → [Implement] → Outcome
                ↓            ↓          ↓
             FAR Scale    FACTS Scale  Quality Gates
             (Mean≥4.00)  (Mean≥3.00)  (Build→Lint→Test)
```

### 11.3 Creating a New RPI Task

1. Create a subdirectory: `rpi/<task-name>/`
2. Run Research phase → output `research.md` with FAR score ≥ 4.00
3. Run Plan phase → output `plan.md` with FACTS score ≥ 3.00
4. Run Implement phase → execute checkboxes sequentially with quality gates
5. Each task checkbox marked `[x]` only after Build → Lint → Test all pass

### 11.4 Artifacts

- `rpi/<task-name>/research.md` — Problem context, affected files, code examples, FAR score
- `rpi/<task-name>/plan.md` — Implementation overview, atomic tasks, FACTS score
- `rpi/<task-name>/implement-postmortem.md` — Only if catastrophic failure (3+ consecutive failures)

---

## 12. Anti-Patterns & Pitfalls

### 12.1 Do NOT:

- ❌ Skip the RPI framework for complex changes
- ❌ Mix layer concerns (e.g., put business logic in controllers)
- ❌ Use relative imports — always use `@domain/`, `@application/`, etc.
- ❌ Cast variables as `any` (TypeScript)
- ❌ Modify TypeORM entities without creating a migration
- ❌ Store secrets in code — use environment variables
- ❌ Proceed with failing tests to "make progress"
- ❌ Modify the `plan.md` task list except for checking completed tasks
- ❌ Write code before the Research phase is validated

### 12.2 Common Pitfalls:

- **SSL confusion:** Docker PostgreSQL does NOT use TLS. SSL must be `false` in TypeORM config for Docker. Only enable for external services like AWS RDS.
- **Redis host:** Uses `redis` in Docker (container name), `localhost` for local dev.
- **Database schema:** Always `bg_public`, not `public`.
- **Password hashing:** User entity has `@BeforeInsert`/`@BeforeUpdate` hooks that auto-hash passwords — do not hash manually.
- **Firebase initialization:** In dev mode (`NODE_ENV=development`), Firebase validation is skipped entirely.
- **Token extraction order:** JWT strategy checks cookies FIRST, then Authorization header.
- **Premium gating:** Reports, Savings, and Investments pages are behind `<PremiumRoute>` wrapper.

---

## 13. Current State & Architecture Decisions

### 13.1 What Exists

- ✅ Full authentication system (email/password, Google OAuth, Firebase)
- ✅ JWT with refresh token rotation (Redis-backed)
- ✅ Rate limiting (Redis-backed)
- ✅ Dashboard with transaction tracking
- ✅ Budget management with categories
- ✅ Financial goals (short-term & long-term)
- ✅ Savings goals with progress tracking
- ✅ Income tracking with recurrence
- ✅ Monthly financial overviews
- ✅ AI financial assistant ("Finny" via OpenAI)
- ✅ User settings (timezone, currency, locale)
- ✅ Password reset flow
- ✅ Bilingual support (EN/ES) in AI assistant
- ✅ Premium feature gating
- ✅ Landing page with testimonials
- ✅ CI/CD with Docker deployment

### 13.2 Architecture Choices & Rationale

- **Clean Architecture layers** enforced by `eslint` import boundaries
- **TypeORM** chosen over Prisma for its decorator-based approach matching NestJS patterns
- **Redis** used for refresh tokens, rate limiting, and AI conversation history (not just cache)
- **React Query** for server state, Redux Toolkit for client state (auth, settings)
- **Playwright** over Cypress for cross-browser E2E testing
- **pnpm** over npm/yarn for strict dependency resolution and workspace support
- **Turbo** for parallel task orchestration in monorepo

### 13.3 Known Technical Debt / Improvement Areas

- Some files are large (e.g., `cta.tsx` landing page is ~300 lines of hardcoded preview UI)
- `auth.service.ts` has a `duummy()` method (typo) that should be removed
- Firebase config in `auth.service.ts` duplicates env vars already available via `ConfigService`
- `user.service.ts` has an artificial 1-second delay (`setTimeout`) in `createUser`
- `finance.entity.ts` is referenced in the project tree but no longer exists
- Test coverage is limited (3 backend unit spec files + 3 frontend E2E spec files, 30 total tests) — all existing tests pass
- No database seed data for development (only a `UserSeederService` placeholder)
- **Protected-route infinite-render outage (2026-06):** a rewrite of `apps/webClient/src/presentation/routes/protected-route.tsx` collapsed three auth slice fields into a single `useSelector((s) => s.auth)` and React 19 + StrictMode tripped React's `getSnapshot should be cached` guard, leaving `/app/*` routes blank on hard refresh. Fixed by splitting into three leaf selectors; codified as §6.8 so the next combined-slice selector gets caught pre-merge.
- **Capacitor Android APK third-party cookie outage (2026-06, fixed in v1.3.0):** Android System WebView silently drops `Set-Cookie` from cross-origin responses, so the entire Capacitor mobile auth path — `/auth/firebase-login` → `/api/...` round-trip → `/auth/refresh` — was broken on real devices (cookies never reached the WebView's cookie jar; the backend's `req.cookies.refreshToken` reads returned undefined; users got 401s and were bounced back to `/auth/login`). The RPI-install path for `@capacitor-community/cookies` (`rpi/mobile-cookies-persistence/`) was not available on the npm registry at install time (E404 on both `@capacitor-community/cookies@^6.0.0` and `@capacitor-community/cookies@^7.0.0`), so the v1.3.0 fix shipped **without a native cookies plugin** and instead relied on the body-token + Authorization-header defense-in-depth: backend `/auth/{login,signup,firebase-login,refresh}` now returns `{accessToken, refreshToken, user, ...}` in the response body; `/auth/refresh` also reads the refresh token from `req.body.refreshToken` or `Authorization: Bearer ...`; webClient's `apps/webClient/src/infrastructure/api.config.ts` request interceptor attaches `Authorization: Bearer ${localStorage.accessToken}` and `X-Device-Id` on every request, and the response interceptor persists tokens to localStorage + `document.cookie` on every successful auth response. Backend also gained `@SkipThrottle()` on `/auth/refresh`, `cookieOptions.maxAge` bumped 15 → 30 minutes, and the cross-cutting watchdog spec `apps/api/test/auth-cookie-bridge.spec.ts` covers cookie+body+header input/output across all four auth routes. Full RPI artifacts + research + plan + FAR (4.67) / FACTS (4.80) scores at `rpi/mobile-cookies-persistence/`.
- **Budget cross-currency aggregation (Phase: Option B shipped in v1.4.1, see `rpi/budget-currency-coercion/`):** `Budget.totalAllocated` / `Budget.totalSpent` now FX-coerce at both read-time (`getBudgets` in-memory loop) and write-time (`recalculateBudgetTotalSpent` loop) via `CurrencyService.convert`. The persisted columns remain for backwards compatibility but are vestigial: `getBudget(id)` (single-budget fetch) still reads them without recompute, while `getBudgets` (list) updates in-memory on each request. Identity fast-path skips `CurrencyService` entirely when `from === target` (single-currency users pay zero latency penalty). Vestigial-column deletion is a follow-up migration — the column shape is part of the schema contract exported via Swagger, historical budget snapshots reference it via `overview` aggregations, and a clean drop needs an `overview`-consumer audit. The 31-test budget-service spec pins the cross-currency behavior (mixed USD+COP math correctness, identity fast-path zero-call assertion, `ServiceUnavailableException` graceful degradation, persisted-coercion correctness).

---

## 14. Quick Reference: Key Files

| When you need to... | Look at... |
|---------------------|-----------|
| Add a new page | `apps/webClient/src/presentation/routes/route-config.tsx` |
| Add a new route path | `apps/webClient/src/presentation/utils/routes.ts` |
| Add a new API endpoint | `apps/api/src/infrastructure/dashboard/dashboard.module.ts` |
| Add a new entity/table | `apps/api/src/domain/` → then add to module's TypeORM `forFeature()` → create migration |
| Change authentication | `apps/api/src/application/auth/auth.service.ts` |
| Change JWT behavior | `apps/api/src/infrastructure/config/strategy/jwt.strategy.ts` |
| Add env vars | Backend: `app.module.ts` ConfigModule validation; Frontend: `vite.config.ts` |
| Create a migration | `pnpm --filter api migration:create` |
| Deploy | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |

---

## 15. RPI Quick Start

To start a new feature using RPI:

```
Prompt for AI Agent:
"I need to work on a new requirement: [DESCRIBE].
We use the RPI (Research, Plan, Implement) framework. Please read `knowledge.md` and `docs/rpi/README.md` to understand our process.
Your first task is ONLY the Research phase. Analyze the codebase to clarify scope and map affected code. Generate the artifact at `rpi/[ticket-id]/research.md`. Include the FAR Scale output. Do not write any production code yet."
```

---

---

## 16. Release Workflow — Versioning & Changelog

> **Mandatory steps after every push to `main`** (or when a set of changes is ready for release).

### 16.1 When to bump the version

| Change type | Version bump | Example |
|-------------|-------------|---------|
| Bug fix / small tweak | Patch (`1.1.0` → `1.1.1`) | Hotfix, typo, CSS fix |
| New feature / refactor | Minor (`1.1.0` → `1.2.0`) | New page, new API endpoint, UI overhaul |
| Breaking API change / big rewrite | Major (`1.0.0` → `2.0.0`) | Database schema change, auth flow redesign |

The version lives in the **root `package.json`** (`"version": "1.1.0"`). Update only that field — the individual workspace `package.json` files are not consumed by the build pipeline.

### 16.2 Update `docs/changelog.md`

Every release must add a changelog entry **above** the previous entries (reverse chronological).

#### Template

```markdown
---

## [vX.Y.Z] — YYYY-MM-DD

### Added
- New feature X

### Fixed
- Bug Y

### Changed
- Refactor Z
```

#### Rules

1. **One entry per release.** If multiple changes shipped together, group them under one version header.
2. **Link to the git tag.** Use `[vX.Y.Z]` matching the tag name (e.g. `[v1.1.0]`).
3. **Date format:** `YYYY-MM-DD`.
4. **Categorise changes** under `### Added`, `### Fixed`, `### Changed`, `### Removed`.
5. **Reference files** when the change is in a specific module: `\`apps/webClient/src/…\`.`

### 16.3 Create and push the git tag

```bash
# Bump version in root package.json first, then:
git add package.json docs/changelog.md
git commit -m "chore: bump version to vX.Y.Z"

# Create an annotated tag (matches the version header in changelog)
git tag -a vX.Y.Z -m "vX.Y.Z — Brief description"

# Push everything (including the tag)
git push origin main --tags
```

> **Why annotated tags (`-a`)?** `git describe` ignores lightweight tags by default in some configurations. Annotated tags also carry a message for the release log.

### 16.4 CI auto-versioning reminder

The CI workflows (`firebase-hosting-merge.yml`, `build-apk.yml`, `firebase-pull-request.yml`) already inject `VITE_APP_VERSION` from `git describe --tags --always --dirty`. Once the tag exists, the version badge in the web UI and APK will display the correct version automatically.

### 16.5 Full release checklist

```markdown
- [ ] Bump version in root `package.json`
- [ ] Update `docs/changelog.md` with release notes
- [ ] Commit: `chore: bump version to vX.Y.Z`
- [ ] Create annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z — ..."`
- [ ] Push: `git push origin main --tags`
- [ ] Verify CI/CD completes successfully
- [ ] Confirm version badge in web UI shows the new version
```

---

*Last updated: 2026-06-25*
*Maintainers: Alkiory, Sergio Campbell*
