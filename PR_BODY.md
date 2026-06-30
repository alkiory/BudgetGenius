## Summary

Closes the v1.6.0 Android release cycle by adding the production tag-triggered
release pipeline + a one-shot operator orchestrator. Together these two files
wire the chain **tag → green release → live download URL → active Download-for-Android
CTA** without any per-version Firebase env edits or manual APK juggling.

## What this PR adds

| File | Lines | Purpose |
|------|-------|---------|
| `.github/workflows/release-android.yml` | 318 | Tag-triggered CI: build APK → publish as GitHub Release asset |
| `scripts/release-android.sh` | 412 | Operator script: tag → poll Actions → RANGE-GET verify → set Secret → empty-commit retrigger Firebase → live CTA verify |

## Design decisions (already settled in prior turns)

- **Path Y (coexistence)**: `.github/workflows/build-apk.yml` continues to run on
  `push: branches: [main]` + `pull_request` as the PR-smoke CI. The new workflow
  fires **only** on `push: tags: ['v*']`. Both produce debug APKs; only the new
  one publishes assets to GitHub Releases. **No CI behavior change** for normal
  PR flow.
- **Java 21** (matches `build-apk.yml`; AGP 8.7.2 accepts both 17 and 21).
- **`pnpm --filter mobile exec cap sync android`** (Android-precise, no iOS-side
  regeneration noise).
- **Post-sync Capacitor Cordova shim cleanup**: `rm -rf` + `sed` strip of the
  dead `apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"`
  line in the auto-generated `capacitor.build.gradle`. Same exact character
  pattern as `build-apk.yml` because the upstream bug is the same one.
- **`assembleDebug` only** for v1.6.x: the project has no `signingConfigs {}`
  block yet (verified `apps/mobile/android/app/build.gradle` has no keystore
  config), so `assembleRelease` would fail at the signing stage. Release-signed
  builds are an explicit v1.7 follow-up — the `download-app.tsx` warning panel
  already explains the debug-keystore provenance to end users.
- **Conditional Firebase `google-services.json` injection**: gated on
  `env.HAS_FIREBASE_SECRET != ''`. Without that file, `app/build.gradle`'s
  `if (servicesJSON.text) { apply plugin: 'com.google.gms.google-services' }`
  block is skipped and Google Login throws on first Android device sign-in.
- **Top-level `concurrency:` block** (group = `github.workflow + github.ref`,
  `cancel-in-progress: false`) so a re-pushed tag doesn't try to overlap an
  in-flight release.
- **`python3 json.load` validation** on the decoded Firebase secret — if the
  operator stored a malformed Base64, we fail fast with `::error::` instead of
  bubbling a misleading Gradle error several minutes later.
- **`${{ github.ref_name }}`** is the upstream-of the GitHub Release asset name
  slug (`BudgetGenius-${GITHUB_REF_NAME}.apk`) and the `VITE_APP_VERSION` source,
  substituting the previous client-side suffix-strip on the landing page.

## Operator flow

Run **once after this PR merges** to fire the first v1.6.x release:

```bash
VERSION=v1.6.1 ./scripts/release-android.sh
```

The script:

1. Tags + pushes `v1.6.1` to origin (annotated, per `knowledge.md` §16.5).
2. Polls the Actions run filtered by `headRef == "v1.6.1"` until terminal.
3. Pulls the canonical asset URL via `gh release view --json assets --jq`.
4. RANGE-GETs the first 1024 bytes of the APK (catches HTML error pages that
   HEAD alone misses); asserts the first 2 bytes equal `504b` (PK zip-magic) so
   a 200-with-1MB-HTML-body error path is impossible.
5. Sets the `VITE_APK_DOWNLOAD_URL` GitHub Secret to that URL via
   `gh secret set` (with `--body`/`--value` compat fallback for `gh < 2.45`).
6. Optional Vercel env update (gated on `INTERACTIVE=1`).
7. Optional local gitignored `.env.production` / `.env.development` update.
8. Empty-commit retriggers `firebase-hosting-merge.yml` so the live site reads
   the freshly-set Secret at build time.
9. Curl-verifies the live `/` page to confirm the CTA flipped from
   "Coming soon" / "Próximamente" (disabled state) to "Download for Android" /
   "Descargar para Android" (active state). Bilingual EN **and** ES markers
   both verified.

`set -euo pipefail` + cleanup-on-abort trap (drops accidental local-only tags
created within the last 60s) + loud-fail `die()` paths everywhere.

## Pre-conditions on the operator workstation

- `gh` CLI authenticated with `repo` + `workflow` scopes.
- `jq` (for `--jq` filter syntax).
- `git` with push access to `git@github.com:alkiory/BudgetGenius.git`.
- (Optional) `vercel` CLI authenticated IF `knowledge.md` §9.2 has Vercel as
  the primary host alongside Firebase Hosting — the script auto-detects.

## Future work (NOT in this PR; tracked separately)

- **Composite-action extraction** (`@.github/actions/build-android-base/action.yml`):
  pull the ~80% duplicated setup steps (java, android-sdk, gradle cache, node,
  pnpm install) out of both `build-apk.yml` and `release-android.yml`. Premature
  until a flawless v1.6.x release validates current step ordering.
- **Release-signed builds**: needs `KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` +
  `KEY_ALIAS` + `KEY_PASSWORD` GitHub Secrets (none currently exist) + a
  `signingConfigs {}` block in `apps/mobile/android/app/build.gradle`.
- **Vestigial `Budget.totalAllocated` / `totalSpent` column drop**: requires
  first auditing `overview`-entity consumers that reference these columns.

## ⚠️ DO NOT AUTO-MERGE

Workflow files in `.github/workflows/` touch production CI. Operator review +
merge required.
