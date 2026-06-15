#!/usr/bin/env bash
# Reset local dev environment: sync main, clean Next.js cache, reinstall if needed.
#
# Usage:
#   ./scripts/dev-reset.sh              # pull + clean + npm run dev
#   ./scripts/dev-reset.sh --skip-dev   # pull + clean only (prints "run npm run dev")
#   ./scripts/dev-reset.sh --skip-pull  # clean cache only (no git pull)
#   ./scripts/dev-reset.sh --skip-pull --skip-dev
#
# Env:
#   GIT_PATH — full path to git (optional)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT="${GIT_PATH:-git}"
LOCK_HASH_FILE="$ROOT/node_modules/.package-lock.hash"

SKIP_DEV=false
SKIP_PULL=false

for arg in "$@"; do
  case "$arg" in
    --skip-dev) SKIP_DEV=true ;;
    --skip-pull) SKIP_PULL=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"

run_git() {
  "$GIT" "$@"
}

if [ "$SKIP_PULL" = false ]; then
  echo "[dev-reset] Fetching origin..."
  run_git fetch origin

  if [ -n "$(run_git status --porcelain)" ]; then
    echo "[dev-reset] WARNING: Uncommitted changes detected — skipping git pull. Commit or stash first." >&2
  else
    echo "[dev-reset] Pulling origin/main..."
    run_git pull origin main
  fi
fi

echo "[dev-reset] Removing .next and node_modules/.cache..."
rm -rf "$ROOT/.next" "$ROOT/node_modules/.cache"

LOCK_FILE="$ROOT/package-lock.json"
CURRENT_HASH=""
if [ -f "$LOCK_FILE" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    CURRENT_HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    CURRENT_HASH="$(shasum -a 256 "$LOCK_FILE" | awk '{print $1}')"
  fi
fi

STORED_HASH=""
if [ -f "$LOCK_HASH_FILE" ]; then
  STORED_HASH="$(tr -d '\n\r' < "$LOCK_HASH_FILE")"
fi

NEEDS_INSTALL=false
if [ ! -d "$ROOT/node_modules" ]; then
  NEEDS_INSTALL=true
elif [ -n "$CURRENT_HASH" ] && [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  NEEDS_INSTALL=true
fi

if [ "$NEEDS_INSTALL" = true ]; then
  echo "[dev-reset] package-lock.json changed or node_modules missing — running npm install..."
  npm install
  if [ -n "$CURRENT_HASH" ]; then
    mkdir -p "$ROOT/node_modules"
    printf '%s' "$CURRENT_HASH" > "$LOCK_HASH_FILE"
  fi
else
  echo "[dev-reset] package-lock.json unchanged — skipping npm install"
fi

SHA="$(run_git rev-parse --short HEAD)"
echo "[dev-reset] Latest commit: $SHA"

if [ "$SKIP_DEV" = true ]; then
  echo "[dev-reset] Run: npm run dev"
else
  npm run dev
fi
