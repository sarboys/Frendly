#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frendly}"
OWNER_USER="${SUDO_USER:-${USER:-root}}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates certbot curl git gnupg

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if getent group docker >/dev/null 2>&1; then
  usermod -aG docker "$OWNER_USER" || true
fi

mkdir -p "$APP_DIR"
chown -R "$OWNER_USER:$OWNER_USER" "$APP_DIR"

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw allow 9000/tcp || true
fi

echo "Bootstrap completed for $APP_DIR"
