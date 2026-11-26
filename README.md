# BudgetGenius

<img width="1267" height="819" alt="image" src="https://github.com/user-attachments/assets/be56e660-951f-4049-86dd-edd547757f1b" />

<p align="center">
  <strong>Smart personal finance management — track expenses, set budgets, and achieve your financial goals with AI-powered insights.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-UNLICENSED-blue" alt="License" />
  <img src="https://img.shields.io/badge/version-v1.12.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node" />
  <a href="https://paypal.me/SergioCampbelldev" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
</p>

## ✨ What's New in v1.12.0

- **Guided catalogue** — step-by-step modules such as the **Emergency fund**, with its 4-week plan, checklist and FAQ.
- **A calculator with your real numbers** — the emergency fund reads your last six months of expenses and turns the 3–6 month target into a real savings goal.
- **Every contribution is a dated transaction** — choose the day you put the money aside and it appears in Transactions as a savings movement.
- **Goals stay in sync** — edit or delete a contribution and the goal follows; savings never count as spending in reports.
- **Backoffice page editor** — write the module pages, reorder tabs, add blocks and upload images without a deploy.

Full history in [`docs/changelog.md`](docs/changelog.md).
---

## 📖 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Getting Started](#-getting-started)
- [Web Development Workflow](#-web-development-workflow)
- [Mobile Development](#-mobile-development)
- [CI/CD & Deployment](#-cicd--deployment)
- [Testing](#-testing)
- [RPI Development Framework](#-rpi-development-framework)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Web Surfaces & Password Recovery](#-web-surfaces--password-recovery)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## 📋 Overview

BudgetGenius is a full-stack web application that helps users manage their personal finances through an intuitive budgeting tool. Users can track income and expenses, create custom budgets with categories, set savings goals, monitor progress with visual dashboards, and receive AI-powered financial insights from "Finny", our bilingual financial assistant.

The application follows a **Clean Architecture** pattern across both its frontend and backend, with strict layer separation ensuring maintainable, testable code.

### Core Capabilities

- **Expense & Income Tracking** — Log, categorize, and monitor all financial transactions
- **Budget Planning** — Create custom budgets with categorized allocations and real-time spending tracking
- **Financial Goals** — Set short-term and long-term goals with progress visualization
- **Savings Goals** — Track saving progress with target dates and percentage completion *(Premium)*
- **Guided Catalogue** — Practical modules with their own pages, calculators and checklists
- **Investment Tracking** — Monitor investment portfolio performance *(Premium)*
- **Reports & Analytics** — Generate detailed financial reports with charts *(Premium)*
- **AI Financial Assistant ("Finny")** — Get personalized insights and advice powered by OpenAI
- **Multi-Authentication** — Email/password, Google OAuth 2.0, and Firebase authentication
- **Bilingual Support** — Full English & Spanish support across the AI assistant

---

## 🏗 Architecture

![alt text](image.png)

```
                        ┌──────────────────────┐
                        │     webClient         │
                        │   React 19 + Vite 6   │
                        │   Tailwind + Recharts │
                        │      Port 3001        │
                        └───────────┬───────────┘
                                    │ HTTP (axios)
                                    │
                        ┌───────────▼───────────┐
                        │         api           │
                        │      NestJS 11        │
                        │  TypeORM + Passport   │
                        │      Port 5000        │
                        └───┬───────┬───────┬───┘
                            │       │       │
                    ┌───────▼──┐ ┌──▼───┐ ┌▼──────┐
                    │PostgreSQL│ │Redis │ │OpenAI │
                    │   15     │ │ 7.2  │ │  GPT  │
                    └──────────┘ └──────┘ └───────┘
```

### Layered Architecture (Clean Architecture)

Both apps follow the same layered architecture with strict dependency rules:

| Layer | Responsibility | Backend Path | Frontend Path |
|-------|---------------|-------------|--------------|
| **Domain** | Entities, repository interfaces, value objects | `src/domain/` | `src/domain/` |
| **Application** | Business logic, service orchestration | `src/application/` | `src/application/` |
| **Infrastructure** | Technical details: config, modules, middleware | `src/infrastructure/` | `src/infrastructure/` |
| **Adapters** | External interfaces: controllers, HTTP repositories | `src/adapters/` | `src/adapters/` |
| **Presentation** | UI components, pages, layouts, routes | — | `src/presentation/` |

*Dependencies always point inward — Domain never imports from outer layers.*

### Monorepo Structure

This project uses a **pnpm workspace monorepo** with **Turbo** for build orchestration:

```
BudgetGenius/
├── apps/
│   ├── api/              # NestJS backend (TypeScript)
│   ├── webClient/        # React app / SPA, served under /app/ (Vite)
│   ├── landing/          # Static marketing site, served at / (Astro 7.4)
│   └── mobile/           # Capacitor native wrapper (Android APK)
├── docs/
│   └── rpi/              # RPI Development Framework docs
├── scripts/
│   └── bootstrap.sh      # One-command setup
├── docker-compose.yml     # Base Docker services
├── docker-compose.dev.yml # Development overrides
├── docker-compose.prod.yml# Production overrides
└── turbo.json             # Turbo pipeline config
```

---

## 🛠 Tech Stack

### Backend (`apps/api`)
| Technology | Purpose |
|-----------|---------|
| **NestJS 11** | Server-side framework with modular architecture |
| **TypeScript 5.7** | Type-safe development |
| **TypeORM 0.3** | Object-Relational Mapping for PostgreSQL |
| **PostgreSQL 15** | Primary relational database |
| **Redis 7.2** | Caching, session store, rate limiting, AI history |
| **Passport.js** | Authentication middleware (JWT + Google OAuth) |
| **Firebase Admin SDK** | Firebase token verification |
| **OpenAI SDK** | AI financial assistant integration |
| **Swagger/OpenAPI** | Auto-generated API documentation |
| **Winston + Morgan** | Structured logging and HTTP request logging |

### Frontend (`apps/webClient`)

> The marketing landing moved to [`apps/landing`](apps/landing) (Astro 7.4,
> static). The SPA keeps the authenticated app, auth screens and public legal
> pages. The changelog is now a static Astro page. See
> [Web Surfaces](#-web-surfaces--password-recovery).
| Technology | Purpose |
|-----------|---------|
| **React 19** | UI library with functional components |
| **Vite 6** | Fast development server and build tool |
| **TypeScript 5.7** | Type-safe development |
| **Tailwind CSS 3** | Utility-first CSS framework |
| **Astro 7.4** | Static landing in `apps/landing` (EN/ES, responsive WebP) |
| **Redux Toolkit** | Client-side state management (auth, settings) |
| **React Query (TanStack)** | Server state management and caching |
| **React Router 7** | Client-side routing with lazy loading |
| **Recharts** | Composable charting library |
| **@animateicons/react** | Animated Lucide icons in the SPA |
| **@animateicons/vanilla** | Animated Lucide icons in the Astro landing |
| **Axios** | HTTP client with interceptors |

### Mobile (`apps/mobile`)
| Technology | Purpose |
|-----------|---------|
| **Capacitor 7** | Native wrapper for Android (and iOS) — wraps the Vite build output |
| **@capgo/capacitor-social-login** | Native Android Credential Manager plugin (replaces the older `@capacitor-firebase/authentication` flow which opened Chrome Custom Tabs — see `docs/changelog.md` v1.2.0) |
| **Android Gradle** | Build system for Android APK generation |

### DevOps & Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Docker + Docker Compose** | Containerized development and deployment |
| **GitHub Actions** | CI/CD pipeline (test, build, deploy) |
| **Turbo** | Monorepo task orchestration |
| **pnpm** | Fast, disk-efficient package manager |
| **Vercel** | Frontend hosting |
| **Firebase Hosting** | Static asset hosting |
| **AWS RDS** | Managed PostgreSQL (production) |
| **Playwright** | End-to-end browser testing |
| **Jest** | Backend unit and e2e testing |

---

## ✨ Features

### 🔐 Authentication & Authorization
- Multi-provider auth: Email/Password, Google OAuth 2.0, Firebase
- JWT access tokens (1h) with refresh token rotation (7d in Redis)
- Rate limiting: 4 requests per 10 seconds per device
- Role-based access control (User/Admin)
- Premium feature gating

### 💰 Transaction Management
- Full CRUD operations on transactions
- Categorization and status tracking
- Date-based filtering and sorting
- Paginated transaction lists

### 📊 Budget Planning
- Create budgets with custom date ranges
- Category-based allocation tracking
- Real-time spending vs. allocated comparison
- Visual progress indicators

### 🎯 Financial Goals
- Short-term and long-term goal tracking
- Target amounts with current progress
- Contribution frequency settings
- Visual percentage completion

### 💎 Premium Features
- Savings goals with color-coded progress
- Detailed financial reports and analytics
- Investment portfolio tracking

### 🤖 AI Financial Assistant ("Finny")
- Context-aware financial advice
- Bilingual (English/Spanish) interaction
- Conversation history stored in Redis
- System prompt tailored to user's financial data

### 🌐 Localization
- Currency, timezone, and locale preferences per user
- Bilingual AI responses

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v22.22 or higher (Astro 7.4 minimum; the API and SPA also run on it)
- **pnpm** v12.23.0 (install: `npm install -g pnpm@12.23.0`; the exact version is pinned by `packageManager` in the root `package.json`)
- **Docker** & **Docker Compose** (for PostgreSQL and Redis)

---

### First-Time Setup

#### Option A: Quick Start with Bootstrap (Recommended)

This single command handles everything:

```bash
git clone <repository-url>
cd BudgetGenius
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

The bootstrap script automates:
1. ✅ Checks prerequisites (Node.js, pnpm)
2. ✅ Installs all workspace dependencies via `pnpm install`
3. ✅ Creates `.env.development` from templates with generated JWT secret
4. ✅ Starts Docker services (PostgreSQL + Redis) via `docker compose`
5. ✅ Builds backend and frontend container images

#### Option B: Manual Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create environment files
cp apps/api/.env.example apps/api/.env.development
cp apps/webClient/.env.example apps/webClient/.env.development

# 3. Edit apps/api/.env.development with your values:
#    - Set JWT_SECRET (generate: openssl rand -hex 32)
#    - DB_HOST=localhost, DB_USER=postgres_admin_dev
#    - DB_PASS=dev_password, DB_NAME=budgetgenius_dev
#    - REDIS_HOST=localhost, REDIS_PORT=6379

# 4. Start Docker services (PostgreSQL + Redis only)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis
```

---

### After Bootstrap — What's Next?

Once the bootstrap script finishes (or you start Docker manually), follow these steps in order:

#### 1. Verify Services are Running

```bash
# Check that PostgreSQL and Redis are healthy
docker ps --filter name='bg-'

# Expected output:
# bg-db-dev     ... (healthy)    ports: 5432
# bg-redis-dev  ... (healthy)    ports: 6379
```

#### 2. Run Database Migrations

Migrations create the required tables in the `bg_public` schema:

```bash
pnpm --filter api migration:run
```

> **Note:** If you used the full bootstrap (which starts all Docker containers), the Docker backend auto-runs migrations on startup — so they're already applied. Running this again locally is safe; it will simply report "no pending migrations." If you only started `database` and `redis` containers (without the backend), you'll need to run migrations manually here.
>
> ❗ **If this command fails with `EAI_AGAIN database` or `password authentication failed`**, your shell may have stale environment variables from an old root `.env` file. See the [Stale Environment Variables](#️-common-pitfall-stale-environment-variables) section below to fix it.

#### 3. Start the Development Servers

```bash
pnpm dev
```

This starts both the **NestJS backend** and the **Vite frontend** with hot reload via Turbo.

#### 4. Access the Application

| Service | URL (Mode A — local dev) | URL (Mode B — Docker) | Description |
|---------|--------------------------|----------------------|-------------|
| 🌐 **Frontend** | http://localhost:5173 (Vite) | http://localhost:3001 (nginx) | React SPA |
| 🚂 **Backend API** | http://localhost:5000 | http://localhost:3000 → container `5000` | NestJS REST API. The process always listens on **5000**; `docker-compose.dev.yml` publishes `3000:5000` |
| 📚 **Swagger Docs** | http://localhost:5000/docs | http://localhost:3000/docs → container `5000` | Interactive API documentation (development only) |
| 🐘 **PostgreSQL** | localhost:5432 | localhost:5432 (via Docker port mapping) | Schema `bg_public` (`user: postgres_admin_dev`, `pass: dev_password`, `db: budgetgenius_dev`) |
| 🔴 **Redis** | localhost:6379 | localhost:6379 (via Docker port mapping) | Cache, refresh tokens, throttle buckets |

> **Wave 1 [T1.6] reconciliation note:** the architecture diagram and this table show **both Mode A and Mode B** ports side-by-side. Mode A = `pnpm dev` (Vite + `nest start`, hot reload). Mode B = `docker compose up` (nginx + image-baked NestJS). The `.env.development` files always keep *Mode A* defaults (`localhost:5000` for backend); Docker overrides them to `redis`/`database` hostnames via `docker-compose.dev.yml`.

#### 5. Default Users (Auto-Seeded)

On first startup, the backend automatically creates two test users:

| Role | Email | Password | Premium? |
|------|-------|----------|----------|
| 👑 **Admin** | `admin@admin.com` | `#Password123` | ✅ Yes |
| 👤 **User** | `normal@normal.com` | `#Password123` | ❌ No |

You can log in with either account immediately.

#### 6. Optional: Load Demo Data

To populate the dev database with realistic data for the dashboard, charts, transaction list and budget progress bars:

```bash
pnpm seed
```

This creates (or resets) a demo account with the last three months of income/expense transactions plus a spending budget (€2,000 limit) and a savings goal (€1,000). It is safe to re-run: the existing demo data is replaced, not duplicated.

| Role | Email | Password |
|------|-------|----------|
| 🧪 **Demo** | `admin@budgetgenius.com` | `password123` |

---

## 💻 Web Development Workflow

### Daily Development Cycle

Each time you come back to work on the project:

```bash
# 1. Start Docker services (if not already running)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis

# 2. Run any new migrations (if entities were changed)
pnpm --filter api migration:run

# 3. Start the dev servers
pnpm dev
```

### 🐳 Two Development Modes

The project supports two complementary workflows. Choose based on what you need:

#### Mode A: Docker for Data Services + Local Dev Servers (Recommended)

```bash
# Terminal 1 — Start only PostgreSQL and Redis in Docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis

# Terminal 2 — Start backend and frontend with hot reload
pnpm dev
```

> **⚠️ Important:** In this mode, the backend runs on port **5000** (not 3000). Make sure your frontend `.env.development` has `VITE_API_URL=http://localhost:5000/api`. If you ran `pnpm bootstrap` and chose "Y" for Docker, it set `VITE_API_URL=http://localhost:3000/api` — edit it to port 5000 for Mode A.

**Why choose this?**
- ✅ Hot reload on code changes (NestJS watches for file changes)
- ✅ Faster iteration — no need to rebuild Docker images
- ✅ Full TypeScript debugging support
- ✅ Frontend served by Vite dev server on port 5173 or by nginx on port 3001

#### Mode B: Everything in Docker (CI/Production-like)

```bash
# Build and start all containers
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# View logs
docker compose logs -f
```

**Why choose this?**
- ✅ Exact replica of production environment
- ✅ Migrations run automatically on container start
- ✅ Useful for testing Docker-specific issues
- ❌ No hot reload — you must rebuild the image for each code change

---

### Stopping Everything

```bash
# Stop dev servers — press Ctrl+C in the terminal running pnpm dev

# Stop Docker services (data persists in named volumes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Stop Docker services AND delete all data (reset database)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

---

### ⚠️ Common Pitfall: Stale Environment Variables

Docker Compose reads a `.env` file from the project root and injects its variables into your shell environment. If you previously had a root `.env` file with values like `DB_HOST=database`, `DB_USER=postgres_admin_prod`, or `DB_PASSWORD=<production-password>`, these will persist in your shell session and **override** the local `localhost` values in `apps/api/.env.development`.

**Symptoms:**
- `pnpm --filter api migration:run` fails with `EAI_AGAIN database` (can't resolve Docker hostname)
- Backend connects to wrong database or uses wrong credentials
- `password authentication failed` errors despite correct `.env.development`

**Fix:**

```bash
# 1. Remove the root .env file if it has conflicting vars
mv .env .env.bak

# 2. Clear the stale variables from your current shell (important!)
unset DB_HOST DB_PORT DB_USER DB_PASSWORD DB_PASS DB_NAME DB_URL
unset REDIS_HOST REDIS_PORT REDIS_URL REDIS_PASSWORD

# 3. Verify they're gone — all should be empty
echo $DB_HOST $DB_USER $DB_PASSWORD $REDIS_HOST
```

> **The bootstrap script no longer creates a root `.env` file** to avoid this issue.

---

### ⚠️ Common Pitfall: Root-Owned Build Artifacts (`EACCES` on `dist` / `.vite`)

Containers run as **root** by default. When a one-off container or a Compose service builds or starts the app over the bind-mounted checkout, it leaves files owned by `root` in your working tree. Your host user cannot replace or unlink them, and the next local run fails with:

```text
Error: EACCES: permission denied, unlink '.../apps/api/dist/jest.config.d.ts'
Error: EACCES: permission denied, unlink '.../apps/webClient/node_modules/.vite/deps/<hash>.js'
```

The usual offenders are `apps/api/dist` (written by `nest build` / `nest start`) and `apps/webClient/node_modules/.vite` (Vite's dependency cache).

**Fix (no sudo needed)** — remove or re-own the artifacts from a container:

```bash
# Delete the regenerable artifacts; the next build/dev run recreates them
docker run --rm -v "$PWD:/app" -w /app node:20-alpine \
  rm -rf apps/api/dist apps/webClient/node_modules/.vite

# ...or keep them and give them back to your host user
docker run --rm -v "$PWD:/app" -w /app node:20-alpine \
  chown -R "$(id -u):$(id -g)" apps/api/dist apps/webClient/node_modules/.vite
```

**Prevention:** avoid alternating root containers and host-side `pnpm dev` over the same working tree. If you need both, run the helper container as your user (`--user "$(id -u):$(id -g)"`), or clean the artifacts *before* switching back to the host. `dist` and `.vite` are build outputs, never source, so deleting them is always safe.

---

### Common Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm bootstrap` | One-command first-time setup (deps + env + Docker) |
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build entire workspace |
| `pnpm test` | Run all test suites |
| `pnpm --filter api dev` | Start backend only |
| `pnpm --filter frontend-web dev` | Start frontend only |
| `pnpm --filter mobile dev:android` | Sync Capacitor config for dev mode (hot reload) |
| `pnpm --filter mobile build` | Build webClient + sync APK assets |
| `pnpm --filter mobile build:android` | Sync + open Android Studio |
| `pnpm --filter mobile sync` | Sync Capacitor config only |
| `pnpm --filter api test` | Run backend tests (Jest) |
| `pnpm --filter frontend-web test` | Run frontend E2E tests (Playwright) |
| `pnpm --filter api lint` | Lint backend code |
| `pnpm --filter frontend-web lint` | Lint frontend code |
| `pnpm --filter api migration:run` | Run pending migrations |
| `pnpm --filter api migration:create` | Create new DB migration |
| `pnpm --filter api migration:revert` | Revert last migration |
| `pnpm seed` | Load demo data (test user, 3 months of transactions, budgets) |

### Database Migrations

When running in Docker (Mode B), migrations run automatically on container start.

When developing locally (Mode A), run migrations manually:

```bash
cd apps/api

pnpm run migration:show      # Show migration status
pnpm run migration:generate  # Auto-generate migration from entity changes
pnpm run migration:create    # Create empty migration file
pnpm run migration:run       # Apply pending migrations
pnpm run migration:revert    # Revert the last migration
```

### Docker Service Management

```bash
# Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start only data services (for local dev)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis

# View logs
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Rebuild a single service
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build backend

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Reset all data (deletes volumes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

---

---

## 📱 Mobile Development

BudgetGenius runs as a **native Android APK** via [Capacitor 7](https://capacitorjs.com/), which wraps the existing Vite/React web app in a native WebView. This means **100% code reuse** — no rewrite needed.

### How It Works

```
[React App] → [Vite Build (dist/)] → [Capacitor] → [WebView Nativo] → [APK]
                    ↓
              Sin cambios en el código
```

- The Vite build is output to `apps/webClient/dist/`
- Capacitor serves these files from the native Android WebView
- In dev mode (`CAP_DEV=true`), the WebView loads directly from the Vite dev server at `http://10.0.2.2:5173` for **hot reload**
- Google Login uses a **Strategy Pattern**: `signInWithPopup` / `signInWithRedirect` in web, `@capgo/capacitor-social-login` plugin (Android Credential Manager bottom sheet) in native

### Prerequisites

In addition to the [base prerequisites](#-getting-started):

- **Java JDK 21** — Required for Android builds ([Adoptium Temurin](https://adoptium.net/temurin/releases/?version=21))
- **Android Studio** — For the Android SDK, emulator, and APK generation
- **ANDROID_HOME** env var pointing to your Android SDK (e.g., `/mnt/c/Users/User/AppData/Local/Android/Sdk` for WSL)

### 📱 Mobile App Structure

```
apps/mobile/
├── package.json           # Capacitor dependencies + build scripts
├── capacitor.config.ts    # Capacitor configuration (webDir, plugins, server.url)
├── tsconfig.json          # TypeScript config
└── android/               # Native Android project (generated by npx cap add android)
    ├── app/
    │   └── src/main/assets/  # ← Web assets copied here by cap sync
    ├── build.gradle
    └── gradlew            # Gradle wrapper for APK builds
```

### 🚀 Quick Start: Build & Run on Emulator

#### Step 1 — Start the Dev Servers

```bash
# Terminal 1 — Start PostgreSQL + Redis (Docker)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis

# Terminal 2 — Start Vite + NestJS with hot reload
pnpm dev
```

Verify both are running:
| Service | Expected URL |
|---------|-------------|
| Vite dev server | `http://localhost:5173/` |
| NestJS API | `http://127.0.0.1:5000` (HTTP 200 on `/api`) |

#### Step 2 — Sync Capacitor Config for Dev Mode

```bash
cd apps/mobile
pnpm dev:android  # Sets CAP_DEV=true and runs npx cap sync
```

This writes the dev config (`server.url: http://10.0.2.2:5173`) to the Android project so the WebView loads from the Vite dev server.

#### Step 3 — Build & Install APK

```bash
cd apps/mobile/android
export JAVA_HOME=~/jdk-21.0.5+11   # Or your JDK 21 path
export ANDROID_HOME=/path/to/Android/Sdk
./gradlew assembleDebug

# Install on emulator
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> **💡 Tip:** The first build takes ~3-4 min (Gradle downloads dependencies). Subsequent builds with no dependency changes take ~8s.

#### Step 4 — Open on Emulator

Open the **BudgetGenius** app in your Android emulator. The app loads from the Vite dev server with **hot reload** — any code change reflects instantly.

### 🔁 Development Cycle (Two Modes)

#### Dev Mode: Hot Reload (Recommended)

| Step | Command | Note |
|------|---------|------|
| 1 | `pnpm dev` | Start Vite + NestJS |
| 2 | `pnpm dev:android` | Sync config (needed once or after config changes) |
| 3 | Open app on emulator | Hot reload works automatically |

> **One-time setup only:** After `pnpm dev:android` + `adb install`, you only need `pnpm dev` and the emulator. Re-sync is only needed if you change `capacitor.config.ts`.

#### Production Mode: Static APK

```bash
# Build web assets with production API URL
export VITE_API_URL=https://api-budgetgenius.alkiory.com/api
pnpm --filter frontend-web build

# Sync + build APK (CAP_DEV is not set → uses local assets)
cd apps/mobile
pnpm build && cd android
./gradlew assembleDebug
```

This produces a self-contained APK that loads from local assets (no dev server needed).

### 🔌 Google Login Strategy

The app uses a **Strategy Pattern** that automatically selects the right auth method:

```
googleLogin()
  → Capacitor.isNativePlatform() = true  →  NativeGoogleLoginStrategy
  │     → @capgo/capacitor-social-login → signInWithGoogle()
  │     → idToken → POST /auth/firebase-login
  │
  → Capacitor.isNativePlatform() = false →  WebGoogleLoginStrategy
        → Firebase JS SDK → signInWithPopup()
        → idToken → POST /auth/firebase-login
```

- **Web:** Uses `signInWithPopup` / `signInWithRedirect` (Firebase JS SDK) — unchanged from the original behavior
- **Native:** Uses `@capgo/capacitor-social-login@7` plugin which delegates to Android's Credential Manager — shows an in-app bottom sheet (no Chrome Custom Tab, no deeplink round-trip). The selected Google account's signed `idToken` flows directly to `POST /auth/firebase-login` like the Web SDK path. See `docs/changelog.md` v1.2.0 for the incident postmortem that motivated the swap.

### 🔧 Troubleshooting

#### API calls fail on emulator

Ensure Vite dev server is running on **port 5173**. The APK's Capacitor config points to `http://10.0.2.2:5173` (the emulator's alias for the host). Vite proxies `/api` to `http://localhost:5000/api`.

If Vite is on a different port, update `capacitor.config.ts`:
```ts
server: { url: 'http://10.0.2.2:<NEW_PORT>', cleartext: true }
```
Then re-sync: `pnpm --filter mobile dev:android && adb install -r ...`

#### Gradle build fails (JAVA_HOME)

Ensure `JAVA_HOME` points to JDK 21 (not 17, not 11):
```bash
java -version  # Must show 21.x
```

#### Redis not available

If Redis isn't running, the API starts with a warning and operates without Redis — rate limiting and refresh tokens use safe defaults. To run Redis:
- **Docker:** `docker compose up -d redis`
- **Local:** Install Redis and run `redis-server`

#### CORS errors

If you see CORS errors in the emulator's WebView, make sure the backend's CORS allow-list includes the Capacitor dev server origin. The default dev origins already include `http://10.0.2.2:5173` in `apps/api/src/main.ts`.

---

### GitHub Actions Workflows

| Workflow | Trigger | Actions |
|----------|---------|---------|
| **CI** (`.github/workflows/ci.yml`) | Push to `main`/`dev`/`feature*`, PR to `main`/`dev`, manual | API: migrations → tests → build. Web: typecheck → unit tests → landing + SPA build |
| **Deploy** (`.github/workflows/deploy.yml`) | Push to `main`, manual | Verify → API image to DockerHub → pull/restart on GCE; landing + SPA → Firebase Hosting |
| **Build Android APK** | Push/PR to `main`/`dev` | Debug APK artifact |
| **Release Android** | Version tag | Signed APK on the GitHub Release |

### Deployment Architecture

- **Frontend:** Firebase Hosting (primary); Vercel can serve the same `dist/`
- **Backend:** Docker container on GCE, image pulled from DockerHub
- **Database:** PostgreSQL on the VM (compose) / Docker PostgreSQL (development)
- **Cache:** Redis on the VM (compose, password-protected) / Docker Redis (development)

#### Required GitHub secrets and variables

The **Deploy** workflow fails fast if a required secret is missing:

| Scope | Secrets / variables |
|-------|--------------------|
| API + GCE | `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `GCE_HOST`, `GCE_USER`, `GCE_SSH_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` |
| API runtime | `OPENAI_API_KEY`, `FRONTEND_URL`, `COOKIE_DOMAIN`, `RESEND_API_KEY`, `MAIL_FROM`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `PROVIDER_KEYS_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Web build | `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `FIREBASE_SERVICE_ACCOUNT_BUDGETGENIUSIA` |
| Variables | `PUBLIC_APP_URL`, `PUBLIC_APK_URL` (optional) |

Push to `main` deploys automatically. To deploy the current branch without
merging, run **Actions → Deploy → Run workflow** and pick the ref.

```bash
# Local production build (same artifact the deploy publishes)
pnpm --filter api build   # apps/api/dist
pnpm build:web             # dist/ → landing at /, SPA at /app/
```

#### Production environment file

`docker-compose.prod.yml` reads the secrets it interpolates (`DB_PASSWORD` and `REDIS_PASSWORD`) from the root `.env` on the server; the backend-specific settings still come from `apps/api/.env.production`. The stack refuses to start if `REDIS_PASSWORD` is missing, because Redis runs with `--requirepass`:

```bash
# Generate once, keep it: the same password must survive every redeploy.
grep -q '^REDIS_PASSWORD=' .env || printf 'REDIS_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> .env
docker compose -f docker-compose.prod.yml up -d
```

---

## 🧪 Testing

### Backend Tests (Jest)

```bash
# Unit and integration tests
pnpm --filter api test

# E2E tests
pnpm --filter api test:e2e

# Coverage report
pnpm --filter api test:cov
```

### Frontend Tests (Playwright)

```bash
# Run all E2E tests
pnpm --filter frontend-web test

# Run with UI mode
pnpm --filter frontend-web test:ui

# Generate tests via codegen
pnpm --filter frontend-web test:codegen

# CI mode
pnpm --filter frontend-web test:ci
```

---

## 📐 RPI Development Framework

BudgetGenius integrates the **RPI (Research → Plan → Implement)** framework for structured, AI-assisted development. This framework ensures that all non-trivial changes are properly researched, planned with atomic tasks, and executed with quality gates at every step.

### How It Works

1. **Research Phase** — Analyze the problem, map affected code, gather context → validated with **FAR Scale** (Factual, Actionable, Relevant ≥ 4.00)
2. **Plan Phase** — Break solution into atomic, single-responsibility tasks → validated with **FACTS Scale** (Feasibility, Atomicity, Clarity, Testability, Size ≥ 3.00)
3. **Implement Phase** — Execute tasks sequentially with quality gates (Build → Lint → Test) before marking complete

Complete framework documentation is in [`docs/rpi/`](docs/rpi/README.md).

### Quick Start with RPI

To begin a new feature using RPI, create a directory `rpi/<task-name>/` and follow the templates in `docs/rpi/`. See [`docs/rpi_instructions.md`](docs/rpi_instructions.md) for exact AI agent prompts.

---

## 📂 Project Structure

```
BudgetGenius/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── domain/               # Entities & Repository Ports
│   │   │   │   ├── auth/             # Auth entities, repository interface
│   │   │   │   ├── user/             # User, UserSettings entities
│   │   │   │   └── dashboard/        # Transaction, Budget, Goal entities
│   │   │   ├── application/          # Business Logic Services
│   │   │   │   ├── auth/             # Auth service, DTOs
│   │   │   │   ├── user/             # User service, seeder
│   │   │   │   ├── ai/               # OpenAI assistant service
│   │   │   │   └── dashboard/        # Budget, Goal, Transaction services
│   │   │   ├── infrastructure/       # Technical Implementation
│   │   │   │   ├── config/           # Redis, Cookie, JWT strategy, throttling
│   │   │   │   ├── auth/             # Google OAuth, Firebase middleware
│   │   │   │   ├── dashboard/        # Dashboard module
│   │   │   │   ├── user/             # User modules
│   │   │   │   └── log/              # Winston logger
│   │   │   ├── adapters/             # Controller & Repository Implementations
│   │   │   ├── migrations/           # TypeORM migrations
│   │   │   └── main.ts               # Application bootstrap
│   │   ├── test/                     # Jest test files
│   │   └── Dockerfile
│   ├── webClient/                    # React Frontend
│   │   ├── src/
│   │   │   ├── domain/               # Entity types & Repository interfaces
│   │   │   ├── application/          # Auth & User services
│   │   │   ├── infrastructure/       # API config, Error boundary, Firebase
│   │   │   ├── adapters/             # HTTP repositories, Redux store, hooks
│   │   │   ├── presentation/
│   │   │   │   ├── pages/            # Page components
│   │   │   │   ├── components/       # Reusable UI components
│   │   │   │   ├── layouts/          # Layout components
│   │   │   │   ├── routes/           # Route config, auth guards
│   │   │   │   └── utils/            # Routes enum, colors, currency
│   │   │   └── main.tsx              # Entry point
│   │   ├── tests/                    # Playwright E2E tests
│   │   └── dockerfile
│   └── mobile/                       # Capacitor Native Wrapper
│       ├── package.json              # Capacitor deps & scripts
│       ├── capacitor.config.ts       # Config (webDir, plugins, server.url)
│       └── android/                  # Native Android project
├── docs/
│   ├── rpi/                          # RPI Framework docs
│   └── rpi_instructions.md           # AI agent prompt guide
├── scripts/
│   └── bootstrap.sh                  # Automated setup script
├── .github/workflows/                # CI/CD pipelines
├── docker-compose.yml                # Base Docker services
├── docker-compose.dev.yml            # Development config
├── docker-compose.prod.yml           # Production config
├── pnpm-workspace.yaml               # Workspace definition
└── turbo.json                         # Turbo pipeline
```

---

## 🔧 Environment Variables

### Backend (`apps/api/.env.development`)

```env
# Database (localhost for local dev; Docker overrides to 'database' via compose)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres_admin_dev
DB_PASS=dev_password
DB_NAME=budgetgenius_dev
DB_URL=postgresql://postgres_admin_dev:dev_password@localhost:5432/budgetgenius_dev

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# JWT (REQUIRED — app won't start without it)
JWT_SECRET=<generate-with-openssl-rand-hex-32>

# Password recovery email (Resend)
# Required for the API to boot; the sandbox sender only reaches the account owner.
RESEND_API_KEY=re_xxxxxxxxx
MAIL_FROM="BudgetGenius <no-reply@your-verified-domain>"

# Redis (localhost for local dev; Docker overrides to 'redis' via compose)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# OpenAI (optional — legacy report insights only; Finny keys live in the backoffice)
OPENAI_API_KEY=sk-...

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Firebase (optional)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
```

> **Note:** When running the backend inside Docker (`docker compose`), `DB_HOST`, `REDIS_HOST`, and `REDIS_URL` are automatically overridden to Docker service names (`database`, `redis`, `redis://redis:6379`) via `docker-compose.dev.yml`. The `.env.development` file always keeps `localhost` values for local `pnpm dev` usage.

### Frontend (`apps/webClient/.env.development`)

```env
# Mode A (pnpm dev): the API listens on 5000. Docker/Mode B publishes it on 3000.
VITE_API_URL=http://localhost:5000/api
VITE_FRONTEND_URL=http://localhost:3001

# Firebase (optional)
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_MEASUREMENT_ID=
```

> **Wave 1 [T1.4] alias note.** Operators who set this var under the older
> name `VITE_FIREBASE_MEASURENT_ID` (the typo'd spelling historically
> propagated through this README, `.env.example` and 3 GitHub Actions
> workflows) — ensure your GitHub Secret is renamed too, otherwise the
> `firebaseConfig.ts` `measurementId` reads as `undefined` and Analytics
> silently fails to initialize.

### Complete Reference

See `.env.example` files in each app directory for the full list of available variables:
- [`apps/api/.env.example`](apps/api/.env.example)
- [`apps/webClient/.env.example`](apps/webClient/.env.example)
- [`apps/landing/.env.example`](apps/landing/.env.example)

---

## 🛡️ Superadmin backoffice

The app has an operator surface for running the product itself — not for
browsing accounts. It is gated by the `superadmin` role (`user` and `admin`
are both rejected by the API).

**Operator account.** Set `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`; on boot
the seeder creates that account, or promotes an existing one with that email.
In development a local fallback is used (`superadmin@admin.com` /
`#Password123`). Nothing is seeded when both variables are empty.

**Schema.** The backoffice tables (`app_modules`, `app_api_keys`,
`app_notifications`) are created by migration `1800000000015`; migration
`1800000000016` stores the announcement windows as `timestamptz` so
"publish now" is timezone-safe:

```bash
pnpm --filter api migration:run
```

**Routes** (all `GET/POST/PUT/DELETE /api/superadmin/*`, JWT + role guard):

| Route | Purpose |
|---|---|
| `/superadmin/overview` | Aggregate usage: users, transactions, data volumes, 6-month activity |
| `/superadmin/modules` | Product module inventory (status, version, core flag) |
| `/superadmin/api-keys` | Issue keys (secret shown once, only its SHA-256 hash is stored), revoke, delete |
| `/superadmin/provider-keys` | Finny provider keys: create, reveal, reorder, disable, delete; used with failover |
| `/superadmin/notifications` | Announcements with level, audience, publish and expiry |

**In the app.** The sidebar shows a *Backoffice* entry for a superadmin at
`/app/superadmin`; the same role check protects the route client-side, but the
API is the real boundary.

### What each backoffice area actually does

- **Módulos** is the product catalogue. A row is `key` (stable machine id),
  `name`, `kind` (`module` = whole feature, `component` = reusable UI piece,
  `integration` = external service), `category`, `status`, `version` and
  `isCore` (cannot be disabled or deleted). Active and beta rows are served by
  `GET /api/modules` and shown to every user under **Módulos** in the sidebar;
  disabling a row removes it from that page on the next sync, and beta entries
  carry a badge. `isCore` blocks disabling/deleting on the write side.
- **API keys** issues machine credentials (`bg_live_…`). Only the SHA-256 hash
  is stored, so the secret is shown once. These are for machine clients, not
  Finny, and are not validated by any endpoint yet — they are the registry for
  future machine-to-machine access.
- **Claves de Finny** (inside the API keys tab) stores the provider
  credentials the assistant uses. They are sealed with AES-256-GCM at rest and
  the superadmin can reveal them again. Enabled keys are tried in `priority`
  order: when one is rejected, rate-limited or unreachable, the API records
  `lastError` on that row and retries with the next key. That table is the
  only source of credentials — the server environment is no longer read — so
  rotating a key never needs a deploy.
- **Avisos** publishes announcements to users. Leaving the schedule empty saves
  a draft; setting a date publishes it with that `publishedAt`, and the app
  reveals it on the first poll after that moment (no cron). `expiresAt` retires
  it automatically. Levels are presentational: `info` (neutral), `success`
  (positive/confirmation), `warning` (attention, app still healthy) and
  `critical` (something is broken or urgent). Audience filters by plan
  (`all`, `free`, `premium`).

### Finny's provider key

`FINNY_INVALID_KEY` means every configured credential was rejected by the
model provider. Keys are managed in **Backoffice → API keys → Claves de
Finny**, so rotating or adding contingency does not require a server change:

1. Add the new provider key with a label and a priority (lower runs first).
2. Optionally disable the old one; the next prompt already uses the new list.
3. The list shows the last provider error per key, which is what `FINNY_INVALID_KEY`
   was reporting.

Selection happens on every prompt, in `AiService.resolveKeys()`: active
backoffice rows ordered by `priority` then `createdAt`. Each candidate is tried
in turn and the first answer wins; a rejection or provider failure records
`lastFailedAt`/`lastError` on the row and moves on inside the same request —
there is no cron and no separate rotation job. A success clears that failure,
so a key that recovers returns to the front of the chain by itself.

Expiry cannot be predicted: an API key carries no expiry date the API can read,
so an expiring key is only noticed when the provider starts rejecting it, and
the next key answers that same prompt. A key that failed stays out of the
healthy set for 15 minutes, which is what keeps Finny visibly asleep until a
different key answers.

`GET /api/ai/status` reports the resolved chain without calling the provider:
`{ available, reason, activeKeys, firstKey }`, where `reason` is
`FINNY_NOT_CONFIGURED`, `FINNY_INVALID_KEY` (every failure was an auth
rejection) or `FINNY_PROVIDER_ERROR`. The Finny rail reads it on open, so the
launcher shows Finny asleep (closed eyes, pink glow) instead of waiting for a
failed prompt, and the API keys tab shows the same snapshot above the list.

The key is stored encrypted with `PROVIDER_KEYS_SECRET` (falling back to
`JWT_SECRET`). If that secret is rotated, existing rows become undecryptable
and must be re-entered. With no active key in the backoffice, Finny reports
`FINNY_NOT_CONFIGURED`; `AGENT_API_KEY` and `OPENAI_API_KEY` in the API
environment are ignored by the assistant.

A non-OpenAI key (for example a free-tier gateway key) is rejected by
`api.openai.com` with `FINNY_INVALID_KEY`. Add a valid OpenAI key in the
backoffice instead of editing the server.

### Cross-device sync and announcements

- `GET /api/modules` returns the active/beta catalogue (modules, components,
  integrations) rendered on the app's **Módulos** page.
- `GET /api/sync/revision` returns a small revision string derived from the
  user's transactions, budgets, categories, settings, modules and live announcements.
  The SPA and the APK poll it (15 s, paused in background), and when it changes
  they invalidate the dashboard/report queries. That is what makes a
  transaction created on the phone appear on the desktop without a refresh.
- `GET /api/notifications` returns the live announcements for the signed-in
  user (audience + publish/expiry window). The app renders the newest one as a
dismissible banner.

Sessions last **7 days**: the access token, the refresh token and the cookie
max-age all use `7d`, so returning after more than an hour no longer forces a
re-login.

The overview's **Transacciones por mes** panel is the global count of ledger
rows per month for the last six months, scaled against the busiest month; the
`/superadmin/overview` response also exposes `activity[].amount` (sum of the
month's amounts) for future reporting. The module card breaks its count down by
kind instead of counting components as modules.

## 🌐 Web Surfaces & Password Recovery

Since 1.10 the web deploy is a **single tree with two surfaces**:

| Path | Served by | Notes |
|---|---|---|
| `/`, `/es/` | Astro landing (`apps/landing`) | Static HTML, no client framework |
| `/app/**` | React SPA (`apps/webClient`) | Built with `base: '/app/'`; deep links rewrite to `/app/index.html` |
| `/auth/**` | React SPA | Reset links point here, so they survive the split |
| `/privacy-policy`, `/terms-and-conditions`, `/contact-sales` | React SPA | Rewritten to `/app/index.html` |
| `/changelog`, `/es/changelog` | Astro landing | Static; exact rewrite to `changelog/index.html` |

Commands:

```bash
pnpm --filter landing dev     # Astro on :4321
pnpm --filter frontend-web dev # SPA on :5173 (base "/" locally)
pnpm build:web                 # landing + SPA → dist/ (landing at /, SPA at /app/)
```

`pnpm dev` (Turbo) starts both. `firebase.json` and
`apps/webClient/nginx.conf` carry the same rewrite map; the Capacitor build
still uses `base: './'` and is not assembled into `dist/`.

### Password recovery with Resend

The reset flow is `POST /auth/forgot-password` → token (1 h TTL) → email with
`${FRONTEND_URL}/auth/reset-password?token=…` → `POST /auth/reset-password`.
Delivery goes through `ResendMailerService` ([Resend Node SDK docs](https://resend.com/docs/send-with-nodejs)):

1. **Verify a domain** at <https://resend.com/domains> (add the DKIM/SPF DNS
   records Resend shows). Without a verified domain, Resend only accepts
   `onboarding@resend.dev`.
2. **Create an API key** at <https://resend.com/api-keys> with *Sending access*
   and set `RESEND_API_KEY` in `apps/api/.env.*`.
3. **Set `MAIL_FROM`** to a sender on the verified domain, e.g.
   `MAIL_FROM="BudgetGenius <no-reply@budgetgenius.com>"`.
4. Keep `FRONTEND_URL` pointing at the origin users open (comma-separated
   origins are accepted; the first one builds the link).

> ⚠️ **Sandbox sender limitation:** mail sent from `onboarding@resend.dev` is
> delivered **only to the Resend account owner's own address**. Real users
> cannot receive a reset link until step 1 is done. The mailer logs a loud
> warning (error level in production) when it boots with a `@resend.dev`
> sender, and refuses to start at all without `RESEND_API_KEY`.

---

## 📚 API Documentation

When the backend is running, Swagger API documentation is available at:

- **Development (Mode A):** http://localhost:5000/docs
- **Docker (Mode B):** http://localhost:3000/docs (host `3000` → container `5000`)
- **Production:** not served. Since v1.10.0 `SwaggerModule` is registered only when `NODE_ENV !== 'production'`, so `/api/docs` returns 404 on the deployed API.

---

## 🤝 Contributing

### Development Process

1. All non-trivial changes follow the [RPI Framework](#-rpi-development-framework)
2. Create a feature branch from `dev`
3. Implement changes with quality gates (Build → Lint → Test)
4. Submit a PR to `dev`
5. Use the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md)

### Code Conventions

- **Imports:** Use path aliases (`@domain/`, `@application/`, etc.) — never relative paths
- **Architecture:** Respect layer boundaries — Domain never imports from outer layers
- **Naming:** kebab-case files, PascalCase classes, camelCase variables
- **Database:** All tables under `bg_public` schema; always create migrations for schema changes

### For AI Agents

If you're an AI coding agent working on this project, read the comprehensive [`knowledge.md`](knowledge.md) guide first. It provides the complete context needed to navigate and extend this codebase effectively.

---

## 📄 License

This project is proprietary and unlicensed. All rights reserved.

---

<p align="center">
  <strong>BudgetGenius</strong> — Smart money management, powered by AI.<br>
  Built with ❤️ by <a href="https://github.com/Alkiory">Alkiory</a>
</p>
