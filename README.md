# Frendly Backend

Этот репозиторий подготовлен под backend деплой.

Внутри:
- `backend/` с NestJS, Prisma, PostgreSQL, Redis, MinIO
- `compose.yaml` для локального запуска
- `compose.prod.yml` для production
- `deploy/nginx/frendly.conf` для публичных маршрутов
- `scripts/bootstrap-server.sh` для первого запуска на Ubuntu
- `scripts/deploy.sh` для ручного деплоя и для GitHub Actions
- `.github/workflows/deploy.yml` для автодеплоя по пушу в `main`

`front/` и `mobile/` в этот backend репозиторий не входят.

## Публичные точки доступа

После деплоя будут такие адреса:
- API: `http://194.113.34.223/`
- Health: `http://194.113.34.223/health`
- Chat WebSocket: `ws://194.113.34.223/ws`
- S3 public endpoint: `http://194.113.34.223/storage`

MinIO наружу напрямую не открыт. Файлы идут через nginx на `/storage`.
MinIO console доступна только через SSH tunnel на `127.0.0.1:9001`.

## Первый запуск на сервере

1. Скопировать `.env.production.example` в `.env.production`
2. Заполнить реальные секреты
3. Выполнить `sudo bash scripts/bootstrap-server.sh`
4. Выполнить `bash scripts/deploy.sh`

## GitHub Actions secrets

Для автодеплоя нужны секреты репозитория:
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

Хост, порт `22` и путь `/opt/frendly` уже зашиты в workflow.
