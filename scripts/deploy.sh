#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
REPO_URL="${REPO_URL:-https://github.com/sarboys/Frendly.git}"
BRANCH="${BRANCH:-main}"
TARGET_SHA="${TARGET_SHA:-}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"

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

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres redis
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" rm -sf migrate || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --no-deps api chat worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx
docker rm -f frendly-backend-minio-1 frendly-backend-minio-init-1 >/dev/null 2>&1 || true
docker volume rm frendly-backend_minio_data >/dev/null 2>&1 || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
