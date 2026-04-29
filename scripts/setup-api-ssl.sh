#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
DOMAINS="${CERT_DOMAINS:-${SSL_DOMAINS:-${API_DOMAIN:-${DOMAIN:-api.frendly.tech admin.frendly.tech partner.frendly.tech}}}}"
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

docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
trap 'docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps nginx >/dev/null || true' EXIT

for DOMAIN in $DOMAINS; do
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Certificate already exists: $DOMAIN"
    continue
  fi

  echo "Issuing certificate: $DOMAIN"
  docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true

  certbot certonly \
    --standalone \
    --preferred-challenges http \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --cert-name "$DOMAIN" \
    -d "$DOMAIN"
done

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --force-recreate nginx; then
  echo "Certificates are ready, but nginx could not be restarted yet." >&2
  echo "Run scripts/deploy.sh after app services are available, then rerun this script if nginx still needs reload." >&2
  exit 0
fi

docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
