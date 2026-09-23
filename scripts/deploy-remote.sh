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

echo "[deploy] creating pre-deploy data export"
BACKUP_DIR="${APP_DIR}/data/backups"
mkdir -p "${BACKUP_DIR}"
BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_TMP="${BACKUP_DIR}/.pre-deploy-${BACKUP_STAMP}.json.tmp"
BACKUP_FILE="${BACKUP_DIR}/pre-deploy-${BACKUP_STAMP}.json"
if ! curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8787/api/backup/export > "${BACKUP_TMP}"; then
  echo "[deploy] unable to export current data; refusing to deploy"
  exit 1
fi
mv "${BACKUP_TMP}" "${BACKUP_FILE}"
chmod 600 "${BACKUP_FILE}"
echo "[deploy] backup saved: ${BACKUP_FILE}"

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
# Make sure the runtime user can write backups/sqlite here. The app process
# writes an auto-backup file before every save; if data/ is owned by another
# user (e.g. created by root), those writes fail with EACCES and saving 500s.
chmod -R u+rwX data

echo "[deploy] cleaning macOS metadata files"
find . -name '._*' -delete

echo "[deploy] restarting api"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[deploy] checking api health"
curl --fail --silent --show-error --max-time 20 http://127.0.0.1:8787/api/health >/dev/null

echo "[deploy] done"
