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

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

COMPOSE_EXTRA_FILES="${COMPOSE_EXTRA_FILES:-$(read_env_value COMPOSE_EXTRA_FILES)}"
NGINX_SERVICE="${NGINX_SERVICE:-$(read_env_value NGINX_SERVICE)}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
for extra_file in $COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "$extra_file")
done

compose_command=(docker compose --env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}")

mkdir -p \
  /etc/letsencrypt/renewal-hooks/pre \
  /etc/letsencrypt/renewal-hooks/post \
  /etc/letsencrypt/renewal-hooks/deploy

cat >/etc/letsencrypt/renewal-hooks/pre/frendly-stop-nginx.sh <<HOOK
#!/usr/bin/env bash
set -euo pipefail
cd "$APP_DIR"
ENV_FILE="$ENV_FILE"
COMPOSE_FILE="$COMPOSE_FILE"
COMPOSE_EXTRA_FILES="\${COMPOSE_EXTRA_FILES:-\$(awk -F= '\$1 == "COMPOSE_EXTRA_FILES" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-\$(awk -F= '\$1 == "NGINX_SERVICE" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-nginx}"
COMPOSE_ARGS=(-f "\$COMPOSE_FILE")
for extra_file in \$COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "\$extra_file")
done
docker compose --env-file "\$ENV_FILE" "\${COMPOSE_ARGS[@]}" stop \$NGINX_SERVICE >/dev/null 2>&1 || true
HOOK

cat >/etc/letsencrypt/renewal-hooks/post/frendly-start-nginx.sh <<HOOK
#!/usr/bin/env bash
set -euo pipefail
cd "$APP_DIR"
ENV_FILE="$ENV_FILE"
COMPOSE_FILE="$COMPOSE_FILE"
COMPOSE_EXTRA_FILES="\${COMPOSE_EXTRA_FILES:-\$(awk -F= '\$1 == "COMPOSE_EXTRA_FILES" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-\$(awk -F= '\$1 == "NGINX_SERVICE" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-nginx}"
COMPOSE_ARGS=(-f "\$COMPOSE_FILE")
for extra_file in \$COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "\$extra_file")
done
docker compose --env-file "\$ENV_FILE" "\${COMPOSE_ARGS[@]}" up -d --no-deps \$NGINX_SERVICE >/dev/null
HOOK

cat >/etc/letsencrypt/renewal-hooks/deploy/frendly-reload-nginx.sh <<HOOK
#!/usr/bin/env bash
set -euo pipefail
cd "$APP_DIR"
ENV_FILE="$ENV_FILE"
COMPOSE_FILE="$COMPOSE_FILE"
COMPOSE_EXTRA_FILES="\${COMPOSE_EXTRA_FILES:-\$(awk -F= '\$1 == "COMPOSE_EXTRA_FILES" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-\$(awk -F= '\$1 == "NGINX_SERVICE" { sub(/^[^=]*=/, ""); print; exit }' "\$ENV_FILE")}"
NGINX_SERVICE="\${NGINX_SERVICE:-nginx}"
COMPOSE_ARGS=(-f "\$COMPOSE_FILE")
for extra_file in \$COMPOSE_EXTRA_FILES; do
  COMPOSE_ARGS+=(-f "\$extra_file")
done
docker compose --env-file "\$ENV_FILE" "\${COMPOSE_ARGS[@]}" exec -T \$NGINX_SERVICE nginx -s reload >/dev/null 2>&1 || true
HOOK

chmod +x \
  /etc/letsencrypt/renewal-hooks/pre/frendly-stop-nginx.sh \
  /etc/letsencrypt/renewal-hooks/post/frendly-start-nginx.sh \
  /etc/letsencrypt/renewal-hooks/deploy/frendly-reload-nginx.sh

docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
trap '"${compose_command[@]}" up -d --no-deps $NGINX_SERVICE >/dev/null || true' EXIT

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

if ! "${compose_command[@]}" up -d --no-deps --force-recreate $NGINX_SERVICE; then
  echo "Certificates are ready, but nginx could not be restarted yet." >&2
  echo "Run scripts/deploy.sh after app services are available, then rerun this script if nginx still needs reload." >&2
  exit 0
fi

docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload
