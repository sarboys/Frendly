#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
REPO_URL="${REPO_URL:-https://github.com/sarboys/Frendly.git}"
BRANCH="${BRANCH:-main}"
TARGET_SHA="${TARGET_SHA:-}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"
LOCK_FILE="${LOCK_FILE:-/tmp/frendly-deploy.lock}"
LOCK_TIMEOUT_SECONDS="${LOCK_TIMEOUT_SECONDS:-1800}"

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

if [ -n "$TARGET_SHA" ]; then
  git reset --hard "$TARGET_SHA"
else
  git reset --hard "origin/$BRANCH"
fi

git clean -fd

ACTUAL_SHA="$(git rev-parse HEAD)"
echo "Deploy target SHA: ${TARGET_SHA:-origin/$BRANCH}"
echo "Deploy actual SHA: $ACTUAL_SHA"

if [ -n "$TARGET_SHA" ] && [ "$ACTUAL_SHA" != "$TARGET_SHA" ]; then
  echo "Expected HEAD $TARGET_SHA but got $ACTUAL_SHA" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
echo "Waiting for deploy lock: $LOCK_FILE"
if ! flock -w "$LOCK_TIMEOUT_SECONDS" 9; then
  echo "Could not acquire deploy lock after ${LOCK_TIMEOUT_SECONDS}s" >&2
  exit 1
fi
echo "Deploy lock acquired"

echo "Disk usage before Docker cleanup:"
df -h / /tmp || true
docker system df || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" rm -sf migrate || true
docker ps -aq \
  --filter 'name=^[0-9a-f]+_frendly-backend-(api|chat|worker|nginx|migrate|pgbouncer|postgres|redis)-1$' \
  | xargs -r docker rm -f
docker container prune -f || true
docker image prune -f || true
docker builder prune -af || true
echo "Disk usage after Docker cleanup:"
df -h / /tmp || true
docker system df || true

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans postgres redis pgbouncer
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" rm -sf migrate || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --no-deps api chat worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
