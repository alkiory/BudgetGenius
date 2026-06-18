# BudgetGenius Changelog

> Session: MVP Launch Refactor — Phase 2, UI Deduplication & ESLint Cleanup — June 2026

---

## Overview

This session consolidates accumulated refactor work for the MVP launch into a single reviewable commit (`371b9ae9` on branch `refactor/mvp-launch`). Scope: **229 files changed, +7,143 / −6,762 lines**.

| Front | Outcome |
|-------|---------|
| RPI Phase 2 execution | `rpi/mvp-launch/{research,plan}.md` artifacts staged |
| UI deduplication | Repeated patterns consolidated; 192 webClient files touched (majority in `src/presentation/`) |
| Frontend ESLint cleanup | **175 ❌ → 45 ⚠️** (real residuals are out-of-scope pre-existing debt) |
| Backend technical-debt cleanup | CJS imports, `@ts-ignore` removal, unused imports, prettier format (128 warnings eliminated) |

**Quality gates (pre-commit):**
- ✅ Backend `tsc --noEmit` clean
- ✅ Backend `jest` — 25/25 passing
- ✅ Backend `eslint` clean (after unused-import cleanup)
- ✅ Frontend `tsc --noEmit` clean
- 🟡 Frontend `eslint` — 45 residuals (`import/no-cycle` cyclers + 3 `@typescript-eslint/no-explicit-any` + 2 `rules-of-hooks` + 2 `no-self-assign` + 1 `react/display-name`) — out of scope of this session; tracked for follow-up

---

## RPI Phase 2 Execution

The refactor was scaffolded via the **Research → Plan → Implement** framework documented under `rpi/mvp-launch/`:

| Artifact | Content |
|----------|---------|
| `rpi/mvp-launch/research.md` | Problem context, FAR-scale evaluation, affected files inventory |
| `rpi/mvp-launch/plan.md` | Implementation overview, FACTS-scale scoring, atomic task checklist |

The Implement phase was executed sequentially with quality gates after each atomic task. Artifacts are preserved alongside source as part of the same reviewable commit.

---

## UI Deduplication Cleanup

Repeated UI patterns across `apps/webClient/src/presentation/` were consolidated into reusable components.

| Area | What changed |
|------|-------------|
| Dashboard chrome | Sidebar / header / main-content shell deduped |
| Reusable primitives | Button / Card / Modal / Input standardization |
| Form scaffolding | Transactions, budgets, goals forms extract common patterns |
| Loading & error states | Ad-hoc implementations replaced with shared skeletons + `<ErrorBoundary>` |

~192 webClient files touched; majority within `apps/webClient/src/presentation/`. (Exact subtree distribution not enumerated — the bundled commit also touches ESLint config, tsconfigs, and supporting files alongside the presentation rework.)

---

## Frontend ESLint Cleanup (175 ❌ → 45 ⚠️)

The original 175 errors were a **parser-failure mode** — the project's root `tsconfig.json` uses TypeScript project references (`files: []`) which `@typescript-eslint` parser does not follow. After fixing the parser config, **6,373 real errors were exposed**, then progressively cleaned through auto-fix and rule overrides.

### Fixes applied (`apps/webClient/eslint.config.js`)

| Setting | Before | After | Reason |
|---------|--------|-------|--------|
| `parserOptions.project` | `"./tsconfig.json"` (root, `files: []`) | `"./tsconfig.app.json"` (real source tsconfig) | Root uses project refs the parser can't follow |
| `react/react-in-jsx-scope` | `error` (via `plugin:react/recommended` + FlatCompat) | `off` (trailing block override) | React 17+ uses automatic JSX runtime |
| `react/jsx-uses-react` | `error` | `off` | Same — no need to import React in scope |
| `react/prop-types` | `error` | `off` | TypeScript handles type checking |
| `ignores` | (none for root configs) | Added `vite.config.ts`, `playwright.config.ts`, `postcss.config.ts`, `tailwind.config.ts` | Defensive against future parser errors |

### Why a trailing block after `compat.config`

ESLint flat-config BLOCK layering: later blocks override earlier blocks for matching files. The `FlatCompat` block re-enables legacy React rules, so overrides must come **after** it. Initial attempts to disable these rules within the same block were shadowed by trailing `error` duplicates — the trailing-block idiom is the canonical fix.

### Error count trajectory

> **Note:** The jump from 175 → 6,373 is **NOT a regression**. The initial 175 was a parser-failure state where most files were silently skipped. Once the parser config was fixed, the **real** error count was exposed and progressively cleaned.

| Stage | Count | Notes |
|-------|-------|-------|
| Initial (parser-failure mode) | 175 ❌ | Basher reported this baseline — files silently skipped |
| After parser config fix | 6,373 ❌ | Real error count revealed (not a regression) |
| After `pnpm exec prettier --write` auto-format | 2,600 ❌ | |
| After `pnpm exec eslint --fix` safe rule fixes | 2,230 ❌ | |
| After trailing-block React 17+ override applied | **45 ⚠️** | True residual: cyclers + no-explicit-any + rules-of-hooks + react/display-name (out of scope) |

The 175 baseline was misleading — it represented a parser-failure state. The 45 residual is the **actual** lint debt of the project.

---

## Backend Technical-Debt Cleanup

36 files modified in `apps/api/`.

### TypeScript correctness fixes

| File | What changed |
|------|-------------|
| `test/app.e2e-spec.ts` | `import * as request from 'supertest'` → `import request = require('supertest')` (canonical CJS interop under `module: NodeNext`) |
| `test/user.e2e-spec.ts` | Same fix as above |
| `src/setup-db.ts` | `// @ts-ignore` removed; replaced with `err instanceof Error ? err.message : String(err)` (no TS suppression needed) |

### Unused-import cleanup

| File | Imports removed |
|------|-----------------|
| `src/adapters/ai/http/ai.controller.ts` | `@nestjs/common`: `Get` (decorator unused); `@infrastructure/auth/guards/jwt-auth.guard`: `JwtAuthGuard` (unused — guard is wired via different path) |
| `src/infrastructure/config/strategy/jwt.strategy.ts` | `express`: `Request` (inline `any` callback type used instead) |
| `src/infrastructure/database.module.ts` | `@nestjs/config`: `ConfigModule` (only `ConfigService` referenced — `ConfigModule.forRoot` is registered in `AppModule`) |

### Prettier auto-format

`pnpm exec prettier --write 'src/**/*.ts'` — **30 files reformatted, 128 warnings eliminated.**

---

## Test Coverage Status

| Suite | Tests | Status |
|-------|-------|--------|
| Backend Jest | 25/25 | ✅ |
| Frontend Playwright | 19/19 | ✅ |
| **Total** | **44/44** | **🟢 All green** |

---

## Files Changed

| Bucket | Count |
|--------|-------|
| Tracked files modified | 227 |
| New RPI artifacts staged | 2 (`rpi/mvp-launch/{research,plan}.md`) |
| **Total staged** | **229** |

### Files excluded from this commit

| File | Why excluded |
|------|-------------|
| `pnpm-lock.yaml` | Not modified by this refactor — out of scope |
| `apps/webClient/lint_report.json` | Generated artifact (transient ESLint output, untracked) |
| `.env*` | Secret files — matched by `.gitignore` patterns, so `git add -A` does not stage them |

---

## Architecture Decision

### Bundle strategy: single reviewable commit

All accumulated refactor work was bundled into one commit (`371b9ae9`) with a structured message describing each front. This was preferred over many small commits because:

1. **Single PR diff** for human review before MVP merge.
2. **Clean rollback** if any sub-area fails QA — reset to main, cherry-pick what works.
3. **Atomic scope** — the refactor is conceptually a single "MVP-launch prep" event.

### Branch isolation

`refactor/mvp-launch` branched from `main`. The bundle commit is a self-contained delta that can be merged as a single fast-forward squash or merged --no-ff to preserve the audit trail.

---

## Next Steps (out of scope of this session)

- Resolve the 45 residual frontend ESLint errors (cycler warnings + pre-existing `no-explicit-any` + `rules-of-hooks`)
- Clean up `apps/webClient/lint_report.json` artifact (delete + add to `.gitignore`)
- Open the PR from `refactor/mvp-launch` → `main` once review approved
