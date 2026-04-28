#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"
LOCK_FILE="${LOCK_FILE:-/tmp/frendly-deploy.lock}"
LOCK_TIMEOUT_SECONDS="${LOCK_TIMEOUT_SECONDS:-1800}"
LANDING_DIR="${LANDING_DIR:-$APP_DIR/landing}"
LANDING_REPO_URL="${LANDING_REPO_URL:-https://github.com/sarboys/frendly_landing.git}"
LANDING_BRANCH="${LANDING_BRANCH:-main}"
LANDING_TARGET_SHA="${LANDING_TARGET_SHA:-}"

export LANDING_DIR

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
echo "Waiting for deploy lock: $LOCK_FILE"
if ! flock -w "$LOCK_TIMEOUT_SECONDS" 9; then
  echo "Could not acquire deploy lock after ${LOCK_TIMEOUT_SECONDS}s" >&2
  exit 1
fi
echo "Deploy lock acquired"

mkdir -p "$(dirname "$LANDING_DIR")"

if [ -e "$LANDING_DIR" ] && [ ! -d "$LANDING_DIR/.git" ]; then
  echo "Landing dir exists but is not a git repo: $LANDING_DIR" >&2
  exit 1
fi

if [ ! -d "$LANDING_DIR/.git" ]; then
  git clone --branch "$LANDING_BRANCH" "$LANDING_REPO_URL" "$LANDING_DIR"
fi

cd "$LANDING_DIR"
git fetch origin "$LANDING_BRANCH"
git checkout -B "$LANDING_BRANCH" "origin/$LANDING_BRANCH"

if [ -n "$LANDING_TARGET_SHA" ]; then
  git reset --hard "$LANDING_TARGET_SHA"
else
  git reset --hard "origin/$LANDING_BRANCH"
fi

git clean -fd

LANDING_ACTUAL_SHA="$(git rev-parse HEAD)"
echo "Landing deploy target SHA: ${LANDING_TARGET_SHA:-origin/$LANDING_BRANCH}"
echo "Landing deploy actual SHA: $LANDING_ACTUAL_SHA"

if [ -n "$LANDING_TARGET_SHA" ] && [ "$LANDING_ACTUAL_SHA" != "$LANDING_TARGET_SHA" ]; then
  echo "Expected landing HEAD $LANDING_TARGET_SHA but got $LANDING_ACTUAL_SHA" >&2
  exit 1
fi

cd "$APP_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --no-deps landing
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps landing nginx
