# BudgetGenius

<p align="center">
  <strong>Smart personal finance management — track expenses, set budgets, and achieve your financial goals with AI-powered insights.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-UNLICENSED-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node" />
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [CI/CD & Deployment](#-cicd--deployment)
- [Testing](#-testing)
- [RPI Development Framework](#-rpi-development-framework)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
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
                        │      NestJS 10        │
                        │  TypeORM + Passport   │
                        │      Port 3000        │
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
│   └── webClient/        # React frontend (TypeScript + Vite)
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
| **NestJS 10** | Server-side framework with modular architecture |
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
| Technology | Purpose |
|-----------|---------|
| **React 19** | UI library with functional components |
| **Vite 6** | Fast development server and build tool |
| **TypeScript 5.7** | Type-safe development |
| **Tailwind CSS 3** | Utility-first CSS framework |
| **Redux Toolkit** | Client-side state management (auth, settings) |
| **React Query (TanStack)** | Server state management and caching |
| **React Router 7** | Client-side routing with lazy loading |
| **Recharts** | Composable charting library |
| **Lucide React** | Icon library |
| **Axios** | HTTP client with interceptors |

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

- **Node.js** v18 or higher
- **pnpm** v10.x (install: `npm install -g pnpm`)
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

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **Frontend** | http://localhost:3001 | React SPA served by nginx (Docker) or Vite dev server (local) |
| 🚂 **Backend API** | http://localhost:3000 | NestJS REST API |
| 📚 **Swagger Docs** | http://localhost:3000/docs | Interactive API documentation |
| 🐘 **PostgreSQL** | localhost:5432 | Database (`user: postgres_admin_dev`, `pass: dev_password`, `db: budgetgenius_dev`) |
| 🔴 **Redis** | localhost:6379 | Cache and session store |

#### 5. Default Users (Auto-Seeded)

On first startup, the backend automatically creates two test users:

| Role | Email | Password | Premium? |
|------|-------|----------|----------|
| 👑 **Admin** | `admin@admin.com` | `#Password123` | ✅ Yes |
| 👤 **User** | `normal@normal.com` | `#Password123` | ❌ No |

You can log in with either account immediately.

---

## 💻 Development Workflow

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

### Common Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm bootstrap` | One-command first-time setup (deps + env + Docker) |
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build entire workspace |
| `pnpm test` | Run all test suites |
| `pnpm --filter api dev` | Start backend only |
| `pnpm --filter frontend-web dev` | Start frontend only |
| `pnpm --filter api test` | Run backend tests (Jest) |
| `pnpm --filter frontend-web test` | Run frontend E2E tests (Playwright) |
| `pnpm --filter api lint` | Lint backend code |
| `pnpm --filter frontend-web lint` | Lint frontend code |
| `pnpm --filter api migration:run` | Run pending migrations |
| `pnpm --filter api migration:create` | Create new DB migration |
| `pnpm --filter api migration:revert` | Revert last migration |

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

## 🔄 CI/CD & Deployment

### GitHub Actions Workflows

| Workflow | Trigger | Actions |
|----------|---------|---------|
| **CI/CD** | Push to `main`, PR to `main`/`dev` | Backend: test → build Docker → push to registry → deploy via SSH; Frontend: test |
| **Playwright** | Push/PR to `main`/`dev` | E2E browser tests |
| **Firebase Merge** | Push to `main` | Deploy frontend to Firebase Hosting |
| **Firebase PR** | Pull request | Preview channel deployment |

### Deployment Architecture

- **Frontend:** Vercel (primary) + Firebase Hosting (static assets)
- **Backend:** Docker container deployed via SSH to VPS
- **Database:** AWS RDS PostgreSQL (production) / Docker PostgreSQL (development)
- **Cache:** Redis (Docker in development, managed service in production)

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
│   └── webClient/                    # React Frontend
│       ├── src/
│       │   ├── domain/               # Entity types & Repository interfaces
│       │   ├── application/          # Auth & User services
│       │   ├── infrastructure/       # API config, Error boundary, Firebase
│       │   ├── adapters/             # HTTP repositories, Redux store, hooks
│       │   ├── presentation/
│       │   │   ├── pages/            # Page components
│       │   │   ├── components/       # Reusable UI components
│       │   │   ├── layouts/          # Layout components
│       │   │   ├── routes/           # Route config, auth guards
│       │   │   └── utils/            # Routes enum, colors, currency
│       │   └── main.tsx              # Entry point
│       ├── tests/                    # Playwright E2E tests
│       └── dockerfile
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

# Redis (localhost for local dev; Docker overrides to 'redis' via compose)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# OpenAI (optional — for AI assistant "Finny")
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
VITE_API_URL=http://localhost:3000/api
VITE_FRONTEND_URL=http://localhost:3001

# Firebase (optional)
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
```

### Complete Reference

See `.env.example` files in each app directory for the full list of available variables:
- [`apps/api/.env.example`](apps/api/.env.example)
- [`apps/webClient/.env.example`](apps/webClient/.env.example)

---

## 📚 API Documentation

When the backend is running, Swagger API documentation is available at:

- **Development:** http://localhost:3000/docs
- **Production:** https://your-domain.com/docs

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
