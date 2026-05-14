#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
REPO_URL="${REPO_URL:-https://github.com/sarboys/Frendly.git}"
BRANCH="${BRANCH:-main}"
TARGET_SHA="${TARGET_SHA:-}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"
COMPOSE_EXTRA_FILES="${COMPOSE_EXTRA_FILES:-}"
CORE_SERVICES="${CORE_SERVICES:-}"
RUNTIME_SERVICES="${RUNTIME_SERVICES:-}"
NGINX_SERVICE="${NGINX_SERVICE:-}"
LOCK_FILE="${LOCK_FILE:-/tmp/frendly-deploy.lock}"
LOCK_TIMEOUT_SECONDS="${LOCK_TIMEOUT_SECONDS:-1800}"
LANDING_DIR="${LANDING_DIR:-$APP_DIR/landing}"
LANDING_REPO_URL="${LANDING_REPO_URL:-https://github.com/sarboys/frendly_landing.git}"
LANDING_BRANCH="${LANDING_BRANCH:-main}"
LANDING_TARGET_SHA="${LANDING_TARGET_SHA:-}"
ADMIN_DIR="${ADMIN_DIR:-$APP_DIR/admin}"
ADMIN_REPO_URL="${ADMIN_REPO_URL:-https://github.com/sarboys/Frendly-admin.git}"
ADMIN_BRANCH="${ADMIN_BRANCH:-main}"
ADMIN_TARGET_SHA="${ADMIN_TARGET_SHA:-}"

export LANDING_DIR
export ADMIN_DIR

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard
git clean -fd
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

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

COMPOSE_EXTRA_FILES="${COMPOSE_EXTRA_FILES:-$(read_env_value COMPOSE_EXTRA_FILES)}"
CORE_SERVICES="${CORE_SERVICES:-$(read_env_value CORE_SERVICES)}"
RUNTIME_SERVICES="${RUNTIME_SERVICES:-$(read_env_value RUNTIME_SERVICES)}"
NGINX_SERVICE="${NGINX_SERVICE:-$(read_env_value NGINX_SERVICE)}"

CORE_SERVICES="${CORE_SERVICES:-postgres redis pgbouncer}"
RUNTIME_SERVICES="${RUNTIME_SERVICES:-api chat worker landing admin_internal admin_partner}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
for extra_file in $COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "$extra_file")
done

read -r -a CORE_SERVICE_ARGS <<< "$CORE_SERVICES"
read -r -a RUNTIME_SERVICE_ARGS <<< "$RUNTIME_SERVICES"
read -r -a NGINX_SERVICE_ARGS <<< "$NGINX_SERVICE"

docker_compose() {
  docker compose --env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}" "$@"
}

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
git reset --hard
git clean -fd
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

mkdir -p "$(dirname "$ADMIN_DIR")"

if [ -e "$ADMIN_DIR" ] && [ ! -d "$ADMIN_DIR/.git" ]; then
  echo "Admin dir exists but is not a git repo: $ADMIN_DIR" >&2
  exit 1
fi

if [ ! -d "$ADMIN_DIR/.git" ]; then
  git clone --branch "$ADMIN_BRANCH" "$ADMIN_REPO_URL" "$ADMIN_DIR"
fi

cd "$ADMIN_DIR"
git fetch origin "$ADMIN_BRANCH"
git reset --hard
git clean -fd
git checkout -B "$ADMIN_BRANCH" "origin/$ADMIN_BRANCH"

if [ -n "$ADMIN_TARGET_SHA" ]; then
  git reset --hard "$ADMIN_TARGET_SHA"
else
  git reset --hard "origin/$ADMIN_BRANCH"
fi

git clean -fd

ADMIN_ACTUAL_SHA="$(git rev-parse HEAD)"
echo "Admin deploy target SHA: ${ADMIN_TARGET_SHA:-origin/$ADMIN_BRANCH}"
echo "Admin deploy actual SHA: $ADMIN_ACTUAL_SHA"

if [ -n "$ADMIN_TARGET_SHA" ] && [ "$ADMIN_ACTUAL_SHA" != "$ADMIN_TARGET_SHA" ]; then
  echo "Expected admin HEAD $ADMIN_TARGET_SHA but got $ADMIN_ACTUAL_SHA" >&2
  exit 1
fi

cd "$APP_DIR"

echo "Disk usage before Docker cleanup:"
df -h / /tmp || true
docker system df || true
docker_compose rm -sf migrate || true
docker ps -aq \
  --filter 'name=^[0-9a-f]+_frendly-backend-(api|api_a|api_b|chat|chat_a|chat_b|worker|worker_realtime|worker_content|worker_schedules|landing|admin_internal|admin_partner|nginx|migrate|pgbouncer|postgres|redis)-1$' \
  | xargs -r docker rm -f
docker container prune -f || true
docker image prune -f || true
docker builder prune -af || true
echo "Disk usage after Docker cleanup:"
df -h / /tmp || true
docker system df || true

docker_compose up -d --build --remove-orphans "${CORE_SERVICE_ARGS[@]}"
docker_compose up --build migrate
docker_compose rm -sf migrate || true
docker_compose up -d --build --no-deps "${RUNTIME_SERVICE_ARGS[@]}"
docker_compose up -d --no-deps --force-recreate "${NGINX_SERVICE_ARGS[@]}"
docker_compose ps
