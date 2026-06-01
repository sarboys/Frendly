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
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1/health}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-60}"
HEALTHCHECK_DELAY_SECONDS="${HEALTHCHECK_DELAY_SECONDS:-5}"
HEALTHCHECK_TIMEOUT_SECONDS="${HEALTHCHECK_TIMEOUT_SECONDS:-10}"
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

append_database_url_param() {
  local url="$1"
  local param="$2"

  if [[ "$url" == *"?"* ]]; then
    printf '%s&%s' "$url" "$param"
  else
    printf '%s?%s' "$url" "$param"
  fi
}

build_migrate_database_url() {
  local direct_url="$1"

  if [ -z "$direct_url" ]; then
    return
  fi

  if [[ "$direct_url" == *"connection_limit="* ]]; then
    printf '%s' "$direct_url"
    return
  fi

  append_database_url_param "$direct_url" "connection_limit=1"
}

COMPOSE_EXTRA_FILES="${COMPOSE_EXTRA_FILES:-$(read_env_value COMPOSE_EXTRA_FILES)}"
CORE_SERVICES="${CORE_SERVICES:-$(read_env_value CORE_SERVICES)}"
RUNTIME_SERVICES="${RUNTIME_SERVICES:-$(read_env_value RUNTIME_SERVICES)}"
NGINX_SERVICE="${NGINX_SERVICE:-$(read_env_value NGINX_SERVICE)}"
ENABLE_POSTGIS_EVENT_FEED="${ENABLE_POSTGIS_EVENT_FEED:-$(read_env_value ENABLE_POSTGIS_EVENT_FEED)}"
WORKER_REALTIME_SCALE="${WORKER_REALTIME_SCALE:-$(read_env_value WORKER_REALTIME_SCALE)}"

CORE_SERVICES="${CORE_SERVICES:-postgres redis pgbouncer}"
RUNTIME_SERVICES="${RUNTIME_SERVICES:-api chat worker landing admin_internal admin_partner}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
ENABLE_POSTGIS_EVENT_FEED="${ENABLE_POSTGIS_EVENT_FEED:-false}"
WORKER_REALTIME_SCALE="${WORKER_REALTIME_SCALE:-1}"

compose_extra_includes() {
  local expected_file="$1"
  local extra_file
  for extra_file in $COMPOSE_EXTRA_FILES; do
    if [ "$(basename "$extra_file")" = "$expected_file" ]; then
      return 0
    fi
  done
  return 1
}

if compose_extra_includes compose.scale.yml; then
  for forbidden_service in api chat worker; do
    if [[ " ${RUNTIME_SERVICES} " == *" ${forbidden_service} "* ]]; then
      echo "Scale mode must not include base runtime service: ${forbidden_service}" >&2
      echo "Use api_a api_b chat_a chat_b worker_realtime worker_content worker_schedules instead." >&2
      exit 1
    fi
  done
fi

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
for extra_file in $COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "$extra_file")
done

read -r -a CORE_SERVICE_ARGS <<< "$CORE_SERVICES"
read -r -a RUNTIME_SERVICE_ARGS <<< "$RUNTIME_SERVICES"
read -r -a NGINX_SERVICE_ARGS <<< "$NGINX_SERVICE"
RUNTIME_SCALE_ARGS=()

if compose_extra_includes compose.scale.yml; then
  if [[ " ${RUNTIME_SERVICES} " == *" worker_realtime "* ]] && [ "$WORKER_REALTIME_SCALE" != "1" ]; then
    RUNTIME_SCALE_ARGS+=(--scale "worker_realtime=${WORKER_REALTIME_SCALE}")
  fi
fi

docker_compose() {
  docker compose --env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}" "$@"
}

run_migrate() {
  local direct_url
  local migrate_database_url

  direct_url="$(read_env_value DATABASE_DIRECT_URL)"
  migrate_database_url="$(build_migrate_database_url "$direct_url")"

  if [ -n "$migrate_database_url" ]; then
    docker_compose run --rm --no-deps \
      -e DATABASE_DIRECT_URL="$migrate_database_url" \
      -e DATABASE_URL="$migrate_database_url" \
      migrate
    return
  fi

  docker_compose run --rm --no-deps migrate
}

verify_scale_nginx_routes() {
  local service
  local nginx_config
  local nginx_service

  for service in api_a api_b chat_a chat_b; do
    if ! docker_compose ps --status running --services "$service" | grep -qx "$service"; then
      echo "Scale service is not running: ${service}" >&2
      docker_compose ps || true
      exit 1
    fi
  done

  if [ "${#NGINX_SERVICE_ARGS[@]}" -ne 1 ]; then
    echo "Scale route verification expects exactly one nginx service" >&2
    exit 1
  fi
  nginx_service="${NGINX_SERVICE_ARGS[0]}"

  if ! nginx_config="$(docker_compose exec -T "$nginx_service" nginx -T 2>/dev/null)"; then
    echo "Could not read nginx runtime config in scale mode" >&2
    exit 1
  fi

  for service in "api_a:3000" "api_b:3000" "chat_a:3001" "chat_b:3001"; do
    if ! grep -Fq "server ${service}" <<< "$nginx_config"; then
      echo "Nginx scale config does not route to ${service}" >&2
      exit 1
    fi
  done
}

verify_postgis_event_feed() {
  if [ "$ENABLE_POSTGIS_EVENT_FEED" != "true" ]; then
    return
  fi

  echo "ENABLE_POSTGIS_EVENT_FEED=true, verifying PostGIS event geo prerequisites"
  docker_compose run --rm --no-deps migrate \
    pnpm --filter @big-break/database db:verify:postgis:event-geo
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
  --filter 'name=^/?([0-9a-f]+_)?frendly-backend-(api|api_a|api_b|api_c|api_d|api_e|api_f|api_g|api_h|chat|chat_a|chat_b|worker|worker_realtime|worker_content|worker_schedules|landing|admin_internal|admin_partner|nginx|migrate|pgbouncer|postgres|redis)-1$' \
  | xargs -r docker rm -f
docker container prune -f || true
docker image prune -f || true
docker builder prune -af || true
echo "Disk usage after Docker cleanup:"
df -h / /tmp || true
docker system df || true

docker_compose up -d --build --remove-orphans "${CORE_SERVICE_ARGS[@]}"

if [[ " ${CORE_SERVICES} " != *" postgres "* ]]; then
  echo "External Postgres mode detected. Local postgres service is not part of CORE_SERVICES."
fi

if [[ " ${CORE_SERVICES} " != *" pgbouncer "* ]]; then
  echo "External PgBouncer mode detected. Local pgbouncer service is not part of CORE_SERVICES."
fi

run_migrate
verify_postgis_event_feed
docker_compose rm -sf migrate || true
docker_compose up -d --build --no-deps "${RUNTIME_SCALE_ARGS[@]}" "${RUNTIME_SERVICE_ARGS[@]}"
docker_compose up -d --no-deps --force-recreate "${NGINX_SERVICE_ARGS[@]}"
docker_compose ps

health_ready=false
echo "Waiting for health endpoint: $HEALTHCHECK_URL"
for attempt in $(seq 1 "$HEALTHCHECK_RETRIES"); do
  if curl --fail --silent --show-error --max-time "$HEALTHCHECK_TIMEOUT_SECONDS" "$HEALTHCHECK_URL" >/dev/null; then
    health_ready=true
    echo "Health endpoint is ready"
    break
  fi

  if [ "$attempt" -lt "$HEALTHCHECK_RETRIES" ]; then
    echo "Health endpoint is not ready yet, attempt ${attempt}/${HEALTHCHECK_RETRIES}"
    sleep "$HEALTHCHECK_DELAY_SECONDS"
  fi
done

if [ "$health_ready" != "true" ]; then
  echo "Health endpoint did not become ready after ${HEALTHCHECK_RETRIES} attempts" >&2
  docker_compose ps || true
  exit 1
fi

if compose_extra_includes compose.scale.yml; then
  verify_scale_nginx_routes
fi
