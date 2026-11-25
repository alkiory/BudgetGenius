#!/usr/bin/env bash
#
# scripts/release-android.sh
#
# Verification wrapper for the automated Android release.
#
# The release itself is produced by `.github/workflows/release-android.yml` on
# every push to `main`: when the root `package.json` version has no GitHub
# Release yet, that workflow builds the APK, creates the annotated tag
# `vX.Y.Z`, publishes the release (title, the `docs/changelog.md` section as
# body, `BudgetGenius-vX.Y.Z.apk` + the stable `BudgetGenius.apk` alias) and
# checks that the landing download URL serves the build.
#
# Nothing here tags, edits env files, writes repository secrets or re-deploys
# the site. The script:
#   1. Preflights `gh`/`git`/`curl`, a clean tree on `main`, and that HEAD is
#      already pushed (the workflow is triggered by the push, not by this run).
#   2. Reads the version from the root `package.json` and requires the matching
#      `## [vX.Y.Z]` section in `docs/changelog.md` (knowledge.md §16.2).
#   3. Exits early when `vX.Y.Z` is already published.
#   4. Watches the `release-android` run for the pushed commit.
#   5. Verifies both release assets and that
#      `releases/latest/download/BudgetGenius.apk` serves a real APK — the URL
#      behind the landing download button.
#
# Prerequisites:
#   • `gh` authenticated with `repo` scope (`gh auth status`).
#   • Clean `main` whose HEAD is already on `origin/main`.
#
# Usage:
#   ./scripts/release-android.sh
#   POLL_TIMEOUT_S=2400 ./scripts/release-android.sh

set -euo pipefail

readonly C_RESET=$'\033[0m'
readonly C_BLUE=$'\033[1;34m'
readonly C_GREEN=$'\033[1;32m'
readonly C_RED=$'\033[1;31m'

log() { printf '%b[step]%b %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()  { printf '%b[ok]%b   %s\n' "$C_GREEN" "$C_RESET" "$*"; }
err() { printf '%b[err]%b  %s\n' "$C_RED" "$C_RESET" "$*" >&2; }

die() {
  err "$@"
  exit 1
}

tmp_body=""
cleanup() { [[ -n "$tmp_body" ]] && rm -f "$tmp_body"; }
trap cleanup EXIT

# ── Preflight ────────────────────────────────────────────────────────────────
log "Preflight"

for cmd in gh git curl od; do
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not on PATH: $cmd"
done

gh auth status >/dev/null 2>&1 \
  || die "gh CLI is not authenticated. Debug with 'gh auth status'."

cd "$(git rev-parse --show-toplevel)"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$CURRENT_BRANCH" == "main" ]] \
  || die "Must run on main (current: $CURRENT_BRANCH)."

[[ -z "$(git status --porcelain)" ]] \
  || die "Working tree has uncommitted changes. Commit them before releasing."

git fetch --quiet origin main
HEAD_SHA=$(git rev-parse HEAD)
[[ "$HEAD_SHA" == "$(git rev-parse origin/main)" ]] \
  || die "HEAD is not pushed to origin/main. Push first — the workflow runs on the push."

REPO_SLUG=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
ok "Repository: $REPO_SLUG @ ${HEAD_SHA:0:7}"

# ── Version + changelog contract ─────────────────────────────────────────────
VERSION=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)
[[ -n "$VERSION" ]] || die "Could not read \"version\" from the root package.json."
TAG="v${VERSION}"

grep -q "^## \[${TAG}\]" docs/changelog.md \
  || die "docs/changelog.md has no '## [${TAG}]' section (knowledge.md §16.2). The release body is built from it."
ok "Version ${TAG} has its changelog entry"

# ── Already published? ───────────────────────────────────────────────────────
if gh release view "$TAG" >/dev/null 2>&1; then
  ok "Release ${TAG} already exists — nothing to publish."
else
  # ── Wait for the workflow run of this commit ───────────────────────────────
  log "Looking for the release-android run of ${HEAD_SHA:0:7}"

  POLL_TIMEOUT_S="${POLL_TIMEOUT_S:-1500}"
  discovery_deadline=$((SECONDS + 120))
  RUN_ID=""
  while (( SECONDS < discovery_deadline )); do
    RUN_ID=$(gh run list \
               --workflow=release-android.yml \
               --commit "$HEAD_SHA" \
               --limit 5 \
               --json databaseId \
               --jq '.[0].databaseId // empty')
    [[ -n "$RUN_ID" ]] && break
    sleep 5
  done

  [[ -n "$RUN_ID" ]] \
    || die "No release-android run appeared for ${HEAD_SHA:0:7}. Check https://github.com/${REPO_SLUG}/actions/workflows/release-android.yml"

  ok "Found run $RUN_ID"

  status=""
  conclusion=""
  deadline=$((SECONDS + POLL_TIMEOUT_S))
  while (( SECONDS < deadline )); do
    read -r status conclusion < <(
      gh run view "$RUN_ID" \
        --json status,conclusion \
        --jq '[.status, (.conclusion // "-")] | @tsv'
    )
    printf '  … status=%s conclusion=%s\n' "$status" "$conclusion"
    [[ "$status" == "completed" ]] && break
    sleep 15
  done

  [[ "$status" == "completed" && "$conclusion" == "success" ]] \
    || die "Run $RUN_ID did not finish green within ${POLL_TIMEOUT_S}s (status=${status:-unknown}, conclusion=${conclusion:-unknown}). Log: https://github.com/${REPO_SLUG}/actions/runs/${RUN_ID}"

  ok "Workflow run $RUN_ID succeeded"
fi

# ── Release assets ───────────────────────────────────────────────────────────
log "Verifying release assets"

ASSETS=$(gh release view "$TAG" --json assets --jq '.assets[].name')

grep -qx "BudgetGenius-${TAG}.apk" <<<"$ASSETS" \
  || die "Release ${TAG} is missing the versioned asset BudgetGenius-${TAG}.apk."
grep -qx "BudgetGenius.apk" <<<"$ASSETS" \
  || die "Release ${TAG} is missing the stable BudgetGenius.apk alias used by the landing button."

ok "Assets present: BudgetGenius-${TAG}.apk + BudgetGenius.apk"

# ── Landing download URL ─────────────────────────────────────────────────────
log "Verifying the landing download URL"

APK_URL="https://github.com/${REPO_SLUG}/releases/latest/download/BudgetGenius.apk"
tmp_body=$(mktemp)

HTTP_CODE=$(curl -sSL -r 0-0 -o "$tmp_body" -w '%{http_code}' "$APK_URL")

[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "206" ]] \
  || die "Landing URL returned HTTP $HTTP_CODE — the download button would be broken. Is ${TAG} the newest stable release?"

MAGIC_HEX=$(od -An -tx1 -N2 "$tmp_body" | tr -d ' \n')
[[ "$MAGIC_HEX" == "504b" ]] \
  || die "Landing URL did not serve a ZIP/APK body (magic: ${MAGIC_HEX:-empty})."

ok "Landing URL serves the APK (HTTP $HTTP_CODE, magic=PK)"

# ── Done ─────────────────────────────────────────────────────────────────────
ok "Release ${TAG} is published and downloadable:"
ok "  • Release:    https://github.com/${REPO_SLUG}/releases/tag/${TAG}"
ok "  • Stable APK: ${APK_URL}"
ok "  • Landing:    the download button resolves to the stable URL at build time."
ok "Next: confirm the published landing links to the APK and install it on a device."
