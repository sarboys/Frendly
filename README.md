# Frendly Backend

Этот репозиторий подготовлен под backend деплой.

Внутри:
- `backend/` с NestJS, Prisma, PostgreSQL, Redis
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
- S3 public endpoint: `https://global.s3.cloud.ru/frendly`

В production файлы лежат в Cloud.ru Object Storage.
Для Cloud.ru S3 ключ доступа задается в формате `<tenant_id>:<key_id>`.
Локальный `compose.yaml` все еще использует MinIO для разработки.

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
