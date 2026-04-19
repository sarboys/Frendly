#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
REPO_URL="${REPO_URL:-https://github.com/sarboys/Frendly.git}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres redis minio
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up minio-init
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" rm -sf minio-init migrate || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --no-deps api chat worker
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
