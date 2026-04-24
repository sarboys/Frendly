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
- `docs/backend-deploy-runbook.md` как опорная инструкция по деплою

`front/` и `mobile/` в этот backend репозиторий не входят.

## Mobile install и Xcode

Инструкция для ручной iOS сборки лежит в `mobile/README.md`.

Коротко:

```bash
cd mobile
flutter pub get
cd ios
pod install
open Runner.xcworkspace
```

В Xcode нужно выбрать scheme `Runner`, указать `Team` в `Signing & Capabilities`, потом запустить `Product` -> `Build`.

## Публичные точки доступа

После деплоя будут такие адреса:
- API: `http://82.202.157.228/`
- Health: `http://82.202.157.228/health`
- Chat WebSocket: `ws://82.202.157.228/ws`
- S3 public endpoint: `https://global.s3.cloud.ru/frendly`

В production файлы лежат в Cloud.ru Object Storage.
Для Cloud.ru S3 ключ доступа задается в формате `<tenant_id>:<key_id>`.
Локальный `compose.yaml` все еще использует MinIO для разработки.

## Первый запуск на сервере

1. Скопировать `.env.production.example` в `.env.production`
2. Заполнить реальные секреты
3. Оставить `RUN_DB_SEED=false`, если это не одноразовый пустой стенд
4. Для тестового стенда поставить `ENABLE_TESTING_ACCESS=true`, для боевого оставить `false`
5. Выполнить `sudo bash scripts/bootstrap-server.sh`
6. Выполнить `bash scripts/deploy.sh`

## GitHub Actions secrets

Для автодеплоя нужны секреты репозитория:
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

Хост `82.202.157.228`, порт `22` и путь `/opt/frendly` уже зашиты в workflow.
