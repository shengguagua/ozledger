#!/usr/bin/env bash
set -euo pipefail

# GitHub Actions SSH sessions may not load the same shell profile as an
# interactive login, so we make common Node/PM2 locations explicit.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

APP_DIR="${DEPLOY_PATH:-$(pwd)}"

echo "[deploy] app dir: ${APP_DIR}"

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "[deploy] missing .env in ${APP_DIR}"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] pm2 is not installed"
  exit 1
fi

echo "[deploy] installing dependencies"
# Production currently uses MySQL as the primary store, so we skip native
# install scripts to avoid blocking deploys on optional SQLite fallback builds.
npm ci --ignore-scripts

echo "[deploy] checking server"
npm run build:server

echo "[deploy] building frontend"
npm run build

echo "[deploy] ensuring data dir"
mkdir -p data/backups

echo "[deploy] cleaning macOS metadata files"
find . -name '._*' -delete

echo "[deploy] restarting api"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[deploy] done"
