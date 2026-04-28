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
- API: `http://77.233.221.119/`
- Health: `http://77.233.221.119/health`
- Chat WebSocket: `ws://77.233.221.119/ws`
- S3 public endpoint: `https://s3.twcstorage.ru/frendly-backet`

В production файлы лежат в Timeweb Cloud Object Storage.
Локальный `compose.yaml` тоже использует S3-compatible Object Storage.
Перед локальным запуском передай `S3_ACCESS_KEY` и `S3_SECRET_KEY` через shell или `--env-file`.

## Первый запуск на сервере

1. Скопировать `.env.production.example` в `.env.production`
2. Заполнить реальные секреты
3. Оставить `RUN_DB_SEED=false`, если это не одноразовый пустой стенд
4. Для тестового стенда поставить `ENABLE_TESTING_ACCESS=true`, для боевого оставить `false`
5. Выполнить `sudo bash scripts/bootstrap-server.sh`
6. Выполнить `bash scripts/deploy.sh`

## Локальный запуск

```bash
docker compose --env-file .env.production.local up --build --remove-orphans
```

Минимально нужны S3 переменные:

- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

Остальные S3 значения по умолчанию смотрят на Timeweb Cloud:

- `S3_ENDPOINT=https://s3.twcstorage.ru`
- `S3_REGION=ru-1`
- `S3_BUCKET=frendly-backet`
- `S3_PUBLIC_ENDPOINT=https://s3.twcstorage.ru`

## GitHub Actions secrets

Для автодеплоя нужен секрет репозитория:
- `DEPLOY_SSH_KEY`

Хост `77.233.221.119`, пользователь `root`, порт `22` и путь `/opt/frendly` уже зашиты в workflow.
