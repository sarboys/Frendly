#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
DOMAIN="${API_DOMAIN:-${DOMAIN:-api.frendly.tech}}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
NGINX_CONTAINER="${NGINX_CONTAINER:-frendly-backend-nginx-1}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run this script as root" >&2
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is not installed" >&2
  exit 1
fi

cd "$APP_DIR"

mkdir -p \
  /etc/letsencrypt/renewal-hooks/pre \
  /etc/letsencrypt/renewal-hooks/post \
  /etc/letsencrypt/renewal-hooks/deploy

cat >/etc/letsencrypt/renewal-hooks/pre/frendly-stop-nginx.sh <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
docker stop frendly-backend-nginx-1 >/dev/null 2>&1 || true
HOOK

cat >/etc/letsencrypt/renewal-hooks/post/frendly-start-nginx.sh <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/frendly
docker compose --env-file .env.production -f compose.prod.yml up -d --no-deps nginx >/dev/null
HOOK

cat >/etc/letsencrypt/renewal-hooks/deploy/frendly-reload-nginx.sh <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
docker exec frendly-backend-nginx-1 nginx -s reload >/dev/null 2>&1 || true
HOOK

chmod +x \
  /etc/letsencrypt/renewal-hooks/pre/frendly-stop-nginx.sh \
  /etc/letsencrypt/renewal-hooks/post/frendly-start-nginx.sh \
  /etc/letsencrypt/renewal-hooks/deploy/frendly-reload-nginx.sh

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
  trap 'docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps nginx >/dev/null || true' EXIT

  certbot certonly \
    --standalone \
    --preferred-challenges http \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --cert-name "$DOMAIN" \
    -d "$DOMAIN"
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
