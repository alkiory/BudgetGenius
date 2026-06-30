#!/usr/bin/env bash
#
# scripts/release-android.sh
#
# One-shot operator script for shipping a BudgetGenius Android APK release.
#
# Runs en bloc:
#   1. Tag the configured VERSION (annotated, signed-off via git's GPG/SSH
#      configuration — not by this script) and push the tag to origin.
#   2. Poll the GitHub Actions run for that tag until it goes green (or
#      fail loudly after a configurable timeout).
#   3. Pull the canonical asset URL out of the published GitHub Release.
#   4. HEAD-curl the URL to verify it serves a non-zero APK body.
#   5. Set the GitHub repository secret `VITE_APK_DOWNLOAD_URL` to the
#      asset URL (read by firebase-hosting-merge.yml + firebase-pull-request.yml).
#   6. (Optional) Set the matching Vercel production env var IF the
#      `vercel` CLI is installed + authenticated. Skipped silently if not.
#   7. (Optional) Update local apps/webClient/.env.production + .env.development
#      (gitignored, useful for local QA against `pnpm dev` /
#      `pnpm build --mode production`).
#   8. Push an empty commit to retrigger Firebase deploy so the next live
#      build reads the freshly-set GitHub Secret at build time.
#   9. Curl-verify the live site at /#download renders the active-CTA marker
#      ("Download for Android") and NOT the disabled-state placeholder.
#
# Hard-stops on any failure via `set -euo pipefail` + explicit `die()`.
# Every step prints its own status block so you can copy-paste a failure
# transcript straight into a bug report or workflow-issue comment.
#
# Prerequisites:
#   • `gh` CLI installed + authenticated with `repo` + `workflow` scopes.
#   • `jq` installed (used by `gh release view --jq …`).
#   • `git` with push access to origin.
#   • (Optional) `vercel` CLI installed + authenticated IF knowledge.md §9.2
#     lists Vercel as a primary host alongside Firebase.
#   • Workflow `.github/workflows/release-android.yml` merged into main.
#   • Branched exactly on `main` with no uncommitted changes (so the empty
#     retrigger commit in Step 8 doesn't drag in unrelated diffs).
#
# Usage:
#   VERSION=v1.6.1 ./scripts/release-android.sh
#
# Or (prompt for confirmation before each step):
#   VERSION=v1.6.1 INTERACTIVE=1 ./scripts/release-android.sh

set -euo pipefail

# ── Cleanup trap (handler #5 from review)────────────────────────────
# If the script aborts after Step 1's `git tag -a` succeeds but before
# the tag is pushed to origin, the local tag persists and pollutes
# later runs. This trap drops it on any non-zero exit. (Push success
# means the cleanup is harmless — the remote tag is still there.)
cleanup_on_abort() {
  local rc=$?
  if (( rc != 0 )) \
     && [[ -n "${VERSION:-}" ]] \
     && git rev-parse --verify "$VERSION" >/dev/null 2>&1; then
    # Only delete if the tag is local-only and was created by THIS run.
    # Tag created locally < 60s ago AND not yet pushed to origin? safe to drop.
    local tag_created_at
    tag_created_at=$(git for-each-ref --format='%(creatordate:unix)' "refs/tags/$VERSION" 2>/dev/null || echo 0)
    local now; now=$(date +%s)
    if (( now - tag_created_at < 60 )) \
       && ! git ls-remote --tags origin "$VERSION" 2>/dev/null | grep -q "$VERSION"; then
      warn "Aborted (rc=$rc). Cleaning up local-only tag $VERSION…"
      git tag -d "$VERSION" || true
    fi
  fi
  # Also drop any .bak files left over from sed -i.bak in Step 7
  find . -maxdepth 4 -name '*.bak' -newer /tmp/release-android.start 2>/dev/null \
    | while read -r f; do rm -f "$f"; done || true
  exit "$rc"
}
trap cleanup_on_abort EXIT
[[ -f /tmp/release-android.start ]] || touch /tmp/release-android.start

# ── Helpers ─────────────────────────────────────────────────────────
readonly C_RESET=$'\033[0m'
readonly C_BLUE=$'\033[1;34m'
readonly C_GREEN=$'\033[1;32m'
readonly C_RED=$'\033[1;31m'
readonly C_YELLOW=$'\033[1;33m'

log()   { printf '%b[step]%b %s\n' "$C_BLUE"   "$C_RESET" "$*"; }
ok()    { printf '%b[ok]%b   %s\n' "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf '%b[warn]%b %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf '%b[err]%b  %s\n' "$C_RED"    "$C_RESET" "$*" >&2; }

die() {
  err "$@"
  err "Aborting. Inspect the last [ok]/[err] block above for context."
  exit 1
}

confirm() {
  [[ "${INTERACTIVE:-0}" == "1" ]] || return 0
  local prompt="$1"
  read -r -p "$(printf '%b[prompt]%b %s [y/N]: ' "$C_YELLOW" "$C_RESET" "$prompt")" ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted by user."; exit 0; }
}

require_cmd() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "Required command not on PATH: $cmd"
  done
}

# ── Preflight ───────────────────────────────────────────────────────
log "Preflight: checking CLI + repo state"
require_cmd gh jq git curl
if ! gh auth_out=$(gh auth status 2>&1); then
  die "gh CLI is not authenticated. Debug with: 'gh auth status'. Output was:

$gh_auth_out"
fi

# Guard: must be on main (so Step 8's empty commit doesn't drag in unrelated diffs)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$CURRENT_BRANCH" == "main" ]] \
  || die "Must run on main (current: $CURRENT_BRANCH). git checkout main && git pull --rebase first."

# Guard: working tree clean (the empty commit we're going to push later must NOT
# include any unrelated modified files)
if [[ -n "$(git status --porcelain)" ]]; then
  die "Working tree has uncommitted changes. Commit or stash before running this script — Step 8 will refuse to push otherwise."
fi

# Guard: VERSION env var required
: "${VERSION:?Set VERSION=vX.Y.Z before running this script (e.g. VERSION=v1.6.1).}"

# Guard: VERSION matches the knowledge.md §16.5 contract (vX.Y.Z or vX.Y.Z-pre-release)
# Catches accidental collisions with $VERSION set by other tools (node version managers,
# python venv scripts, etc.) that aren't git tag-shaped.
[[ "$VERSION" =~ ^v[0-9]+(\.[0-9]+){0,2}([-+][A-Za-z0-9.-]*)?$ ]] \
  || die "VERSION=$VERSION does not match the vX or vX.Y or vX.Y.Z or vX.Y.Z-pre-release format expected by knowledge.md §16.5."
ok "VERSION = $VERSION (matches semver-tag regex)"

# Confirm the .github/workflows/release-android.yml is actually on main, not
# just untracked on a feature branch
MERGED_REF=$(git rev-parse --verify "main:.github/workflows/release-android.yml" 2>/dev/null || echo "")
if [[ -z "$MERGED_REF" ]]; then
  die ".github/workflows/release-android.yml is NOT on main yet. Merge the CI PR first (open-pr CI first), then re-run."
fi
ok "release-android.yml merged into main (blob $MERGED_REF)"

# ── Step 1 — Tag + push ─────────────────────────────────────────────
log "Step 1: tagging $VERSION (annotated) + pushing to origin"

confirm "Tag $VERSION and push? (this triggers the release-android workflow)"

# Annotated tag (per knowledge.md §16.5)
git tag -a "$VERSION" -m "$VERSION — released via scripts/release-android.sh"
ok "tag $VERSION created locally"

git push origin "$VERSION"
ok "$VERSION pushed to origin (release-android.yml should now fire)"

# ── Step 2 — Poll Actions until green ───────────────────────────────
log "Step 2: waiting for release-android.yml run on tag $VERSION to go green"

OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO=$(gh repo view --json name --jq '.name')

# GitHub UI exposes a tag-push workflow run within ~5s; poll the workflow run
# listing filtered by ref for up to POLL_TIMEOUT_S (default 1500s = 25min, the
# longest realistic build for clean caches).
POLL_TIMEOUT_S="${POLL_TIMEOUT_S:-1500}"
DEADLINE=$((SECONDS + POLL_TIMEOUT_S))

RUN_ID=""
while (( SECONDS < DEADLINE )); do
  RUN_ID=$(gh run list \
            --workflow=release-android.yml \
            --json databaseId,status,conclusion,headRef \
            --jq ".[] | select(.headRef == \"$VERSION\") | .databaseId" \
            | head -1 || true)
  [[ -n "$RUN_ID" ]] && break
  sleep 10
done

[[ -n "$RUN_ID" ]] || die "No Actions run appeared for tag $VERSION within $POLL_TIMEOUT_S seconds. Open https://github.com/$OWNER/$REPO/actions/workflows/release-android.yml to inspect manually."

ok "Found Actions run: $RUN_ID — polling until terminal state…"

# Poll the run's status until it transitions out of "in_progress" / "queued".
POLL_DEADLINE=$((SECONDS + 1200))
while (( SECONDS < POLL_DEADLINE )); do
  RUN=$(gh run view "$RUN_ID" --json status,conclusion,url 2>/dev/null || echo '{"status":"unknown"}')
  STATUS=$(jq -r '.status'   <<<"$RUN")
  CONCLU=$(jq -r '.conclusion // ""' <<<"$RUN")
  echo "  …status=$STATUS conclusion=${CONCLU:-pending}"
  if [[ "$STATUS" == "completed" ]]; then
    if [[ "$CONCLU" != "success" ]]; then
      err "Workflow $RUN_ID finished with conclusion=$CONCLU."
      err "Run log URL: $(jq -r .url <<<"$RUN")"
      die "Fix the workflow run, re-tag, then re-run this script."
    fi
    ok "Workflow run $RUN_ID succeeded."
    break
  fi
  sleep 30
done

[[ "$STATUS" == "completed" && "$CONCLU" == "success" ]] \
  || die "Workflow did not reach a green conclusion within 20 minutes (post-discovery) — stopping for manual inspection."

# ── Step 3 — Pull the asset URL out of the GitHub Release ───────────
log "Step 3: extracting canonical APK asset URL from the GitHub Release"

EXPECTED_ASSET="BudgetGenius-${VERSION}.apk"
APK_URL=$(gh release view "$VERSION" \
            --json assets \
            --jq ".assets[] | select(.name == \"$EXPECTED_ASSET\") | .browser_download_url")

[[ -n "$APK_URL" ]] || die "Expected release asset '$EXPECTED_ASSET' was not found under tag $VERSION. The release-android.yml workflow may have completed but did not publish the canonical asset."
ok "Canonical asset URL: $APK_URL"

# Sanity check: the URL form must match the contract documented in
# apps/webClient/.env.example + softprops's release step
EXPECTED_PREFIX="https://github.com/$OWNER/$REPO/releases/download/$VERSION/$EXPECTED_ASSET"
[[ "$APK_URL" == "$EXPECTED_PREFIX" ]] \
  || die "Asset URL shape diverged from VITE_APK_DOWNLOAD_URL contract. Got '$APK_URL', expected '$EXPECTED_PREFIX'."
ok "URL shape matches VITE_APK_DOWNLOAD_URL contract."

# ── Step 4 — RANGE-GET smoke-test ───────────────────────────────────
log "Step 4: RANGE-GET-verifying the APK URL is a real ZIP/APK binary"

# RANGE GET (first 1024 bytes) instead of HEAD. Some S3 edge nodes return
# Content-Length: 0 on HEAD because they don't COUNT the body for HEAD;
# a HEAD-only check is unreliable for proof. Pulling `Range: bytes=0-1023`
# actually downloads bytes (1024-byte cap keeps the audit log small) and
# lets us verify the first 2 bytes are 'PK' (zip/apk magic 0x50 0x4B) —
# positive proof the asset is a real archive rather than an HTML error
# page leaked past Content-Type sniffing.
TMP_HEAD="/tmp/release-android.head.$$"

# Pull a 1024-byte RANGE GET into a tmp file + capture headers + curl
# metrics. `2>&1` folds stderr in so we can surface curl's own error
# message if it fails outright. `|| die` is the loud-fail path.
RANGE_OUT=$(curl -sL -H 'Range: bytes=0-1023' \
              -D "$TMP_HEAD.headers" \
              -o "$TMP_HEAD" \
              -w '%{http_code}\t%{url_effective}\t%{size_download}\t%{size_header}\n' \
              "$APK_URL" 2>&1) \
  || die "curl RANGE GET failed outright. Network / DNS / proxy issue. Captured:

$RANGE_OUT"
echo "  $RANGE_OUT"

HTTP_CODE=$(cut -f1 <<<"$RANGE_OUT")
EFFECTIVE_URL=$(cut -f2 <<<"$RANGE_OUT")
SIZE_DOWNLOAD=$(cut -f3 <<<"$RANGE_OUT")
CONTENT_TYPE=$(grep -i '^content-type:' "$TMP_HEAD.headers" 2>/dev/null | head -1 | tr -d '\r' || echo "")

[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "206" ]] \
  || die "Asset URL RANGE GET returned HTTP $HTTP_CODE (expected 200 full or 206 partial). Asset might be still propagating or path is wrong. curl output:

$RANGE_OUT"

[[ "$SIZE_DOWNLOAD" -gt 100 ]] \
  || die "Asset body is only $SIZE_DOWNLOAD bytes — APK should be >= 25MB so first 1024 bytes of a real archive should arrive. Wrong URL, empty asset, or broken S3 redirect chain."

# Magic byte check: zip/apk archives always begin with the local-file-header
# signature 0x50 0x4B ('PK'). This catches the case where S3 serves an HTML
# error page with a misleading positive Content-Length. Without this, a
# 200-with-Content-Length-but-HTML-body case would slip through.
MAGIC_HEX=$(head -c 2 "$TMP_HEAD" | xxd -p)
[[ "$MAGIC_HEX" == "504b" ]] \
  || die "Asset body does NOT start with PK zip signature (got hex '$MAGIC_HEX'). URL served an HTML error page or non-APK content. Content-Type: ${CONTENT_TYPE:-unknown}. Body head:

$(head -c 256 "$TMP_HEAD")"

ok "Asset serves ${HTTP_CODE} (CT: ${CONTENT_TYPE:-unknown}) + $SIZE_DOWNLOAD bytes, magic=PK at $EFFECTIVE_URL"

# Clean up temp files captured during RANGE GET
rm -f "$TMP_HEAD" "$TMP_HEAD.headers"

# ── Step 5 — Set GitHub Secret VITE_APK_DOWNLOAD_URL ─────────────────
log "Step 5: setting GitHub repository secret VITE_APK_DOWNLOAD_URL"

confirm "Write '$APK_URL' into the VITE_APK_DOWNLOAD_URL GitHub Secret? (read by firebase-hosting-merge.yml + firebase-pull-request.yml)"

# gh secret set --body is gh v2.45+ (mid-2024). Older gh (≤ 2.40) only accepts
# --value. Try --body first, fall back to --value so the script works on both
# generation ranges of gh that the operator might have installed.
if ! gh_secret_err=$(gh secret set VITE_APK_DOWNLOAD_URL --body "$APK_URL" 2>&1); then
  warn "--body form failed (gh < 2.45?). Falling back to --value, raw error follows:"
  warn "$gh_secret_err"
  gh secret set VITE_APK_DOWNLOAD_URL --value "$APK_URL" \
    || die "gh secret set failed both --body and --value paths. Confirm gh is installed + has repo+workflow scopes (gh auth refresh -h github.com -s repo,workflow)."
fi
ok "GitHub Secret VITE_APK_DOWNLOAD_URL = $APK_URL"

# ── Step 6 — Optional Vercel env var ─────────────────────────────────
log "Step 6: optional Vercel env var"
if command -v vercel >/dev/null 2>&1; then
  warn "vercel CLI detected. Knowledge.md §9.2 lists Vercel as primary? If yes, set production env. If not, press Ctrl+C within 5 seconds."
  if [[ "${INTERACTIVE:-0}" == "1" ]]; then
    read -r -t 5 -p "Set Vercel production env VITE_APK_DOWNLOAD_URL? [y/N]: " ans || ans=""
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      vercel env add VITE_APK_DOWNLOAD_URL production < <(echo -n "$APK_URL") \
        || die "vercel env add failed — set VITE_APK_DOWNLOAD_URL manually via the Vercel dashboard."
      ok "Vercel production env set."
    else
      warn "Skipped Vercel env. Do it manually if Vercel is in your deploy matrix."
    fi
  else
    warn "Skipping Vercel step (run with INTERACTIVE=1 to enable). Manual fallback: Vercel dashboard → Settings → Environment Variables → Production."
  fi
else
  warn "vercel CLI not installed — skipping. Manual fallback: Vercel dashboard → Settings → Environment Variables → Production."
fi

# ── Step 7 — Optional local gitignored env files ────────────────────
log "Step 7: optional local .env files (gitignored, useful for pnpm dev / build --mode production)"

if [[ "${INTERACTIVE:-0}" == "1" ]]; then
  read -r -t 5 -p "Update local apps/webClient/.env.production + .env.development with the new URL? [y/N]: " ans || ans=""
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    FLAG="VITE_APK_DOWNLOAD_URL=$APK_URL"
    for path in apps/webClient/.env.production apps/webClient/.env.development; do
      if [[ -f "$path" ]]; then
        # Update in place (or append if missing)
        if grep -q "^VITE_APK_DOWNLOAD_URL=" "$path"; then
          sed -i.bak "s|^VITE_APK_DOWNLOAD_URL=.*|$FLAG|" "$path" && rm -f "$path.bak"
        else
          printf '\n%s\n' "$FLAG" >> "$path"
        fi
        ok "Updated $path"
      else
        warn "$path does not exist locally — skipping"
      fi
    done
  else
    warn "Skipped local env files."
  fi
else
  warn "Skipping local-env edits (run with INTERACTIVE=1 to enable). Manual fallback: append 'VITE_APK_DOWNLOAD_URL=$APK_URL' to those files."
fi

# ── Step 8 — Empty commit to retrigger Firebase Deploy ──────────────
log "Step 8: pushing empty commit to retrigger firebase-hosting-merge.yml so the live site builds with the new VITE_APK_DOWNLOAD_URL"

confirm "Push empty commit 'chore: retrigger Firebase deploy' to main? (deploys within ~2 minutes)"

git commit --allow-empty -m "chore: retrigger Firebase deploy after VITE_APK_DOWNLOAD_URL=${VERSION}
Empty commit, sole purpose is to retrigger the firebase-hosting-merge.yml
workflow so the next live site build reads the freshly-set
VITE_APK_DOWNLOAD_URL=$VERSION APK URL at build time. Generated by
scripts/release-android.sh."

git push origin main
ok "Empty commit pushed — firebase-hosting-merge.yml should fire within ~30s"

# ── Step 9 — Live CTA verification ──────────────────────────────────
log "Step 9: live CTA verification via the deployed site"

# Try to read the canonical production frontend URL from env files.
# If absent, fall back to a sensible default + tell the operator to override.
DOMAIN=""
for envfile in apps/webClient/.env.production apps/webClient/.env.development apps/webClient/.env.example; do
  if [[ -f "$envfile" ]]; then
    DOMAIN=$(grep -E '^VITE_FRONTEND_URL=' "$envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' || true)
    [[ -n "$DOMAIN" ]] && break
  fi
done
[[ -n "$DOMAIN" ]] || DOMAIN="https://budgetgenius.com"
warn "DOMAIN for live verification: $DOMAIN (override with DOMAIN=https://your-domain if needed)"

# Wait a bit for Firebase to finish the deploy
WAIT_S="${DEPLOY_WAIT_S:-90}"
log "Sleeping ${WAIT_S}s while Firebase deploys the new build…"
sleep "$WAIT_S"

CTA_PAGE_BODY=$(curl -fsSL "$DOMAIN/#download" || echo "")
if [[ -z "$CTA_PAGE_BODY" ]]; then
  die "Curl to $DOMAIN/#download failed (HTTPS error / timeout / DNS). Verify DOMAIN is correct and redeploy visible."
fi

# The site is bilingual (en.json + es.json). Check for the active-CTA marker
# in BOTH locales; we treat success as "any active marker present". Disabled
# state uses en "Coming soon" / es "Próximamente" — match both.
#
# - Active EN marker:  "Download for Android"
# - Active ES marker:  "Descargar para Android" (or similar)
# - Disabled marker:   "Coming soon"  /  "Próximamente"
#
# We first confirm the APK URL made it into the bundled JS (a much stronger
# signal than the visible label), then check visible copy. If the bundled
# VITE_APK_DOWNLOAD_URL is empty/null we'll never render the active state.
if grep -q "$APK_URL" <<<"$CTA_PAGE_BODY"; then
  ok "Bundled JS contains the APK_URL — VITE_APK_DOWNLOAD_URL was baked into the Firebase build."
elif grep -qi "download for android\|descargar para android" <<<"$CTA_PAGE_BODY"; then
  ok "Active CTA marker ('Download for Android' / 'Descargar para Android') found on $DOMAIN/#download — landing DownloadApp section flipped from disabled to enabled."
elif grep -qi "coming soon\|próximamente" <<<"$CTA_PAGE_BODY"; then
  # Possible-but-overlapping bilingual collision: skip the coming-soon branch
  # if the APK_URL search above already matched. We only die here for the
  # combined case "neither active marker + Coming soon is present".
  die "CTA still renders 'Coming soon' / 'Próximamente'. The Firebase deploy may have used a stale secret, the new build may not have included the secret, or DOMAIN points at the wrong deploy. Re-run Step 5 and confirm the secret value + redeploy."
else
  err "Neither active CTA marker nor disabled marker found on $DOMAIN/#download. Page rendered but unexpected copy. Investigate manually."
  err "Possible causes: stale browser cache (Add-Cache-Control: max-age=0 to the curl), DNS routing to a different deploy target, or your domain is gzipped (curl needs --compressed)."
  exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────
ok "Release $VERSION is fully shipped:"
ok "  • APK URL:           $APK_URL"
ok "  • GitHub Secret:      VITE_APK_DOWNLOAD_URL"
ok "  • Empty retrigger:    pushed to main"
ok "  • Live CTA:           ACTIVE on $DOMAIN/#download"
ok "Next realistic checks: install the APK on a real Android device (Settings → Apps → Special access → Install unknown apps) and confirm the Login screen renders. iOS still says 'coming soon' — that's intentional, not a bug."
