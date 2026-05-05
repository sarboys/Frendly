# Project Map

Короткая карта проекта. Это не индекс всех файлов.

Для поиска конкретной логики сначала используй граф:

```bash
./scripts/ua-query.mjs "<ключевые слова>"
```

## Старт задачи

1. Открой `AGENTS.md`.
2. Открой этот файл.
3. Открой `ai-context/index.md`.
4. Если задача про код, архитектуру, бизнес-логику, impact или поиск файлов, запусти `ua-query`.
5. Открой 1-2 нужные карты из `ai-context`.
6. Потом читай только конкретные файлы кода.

Не читай весь проект. Не делай широкий поиск без причины.

## Роли источников

- `.understand-anything/`: машинный граф кода, связей и бизнес-флоу.
- `scripts/ua-query.mjs`: компактный context pack из графа.
- `ai-context/`: ручные правила, контракты, ограничения и команды.
- `project_map.md`: верхний уровень проекта.
- `AGENTS.md`: обязательные правила работы.

Если граф конфликтует с кодом, верь коду. Если граф конфликтует с `ai-context`, проверь код и обнови устаревший файл.

## Верхний уровень

- `mobile/`: Flutter app.
- `backend/`: NestJS monorepo.
- `admin/`: React admin app.
- `front/`: визуальный эталон продукта.
- `landing/`: отдельный landing site.
- `deploy/`, `compose*.yml`, `scripts/`: infra and automation.
- `.understand-anything/`: focused graph для backend, mobile, admin.
- `ai-context/`: ручные карты.

## Куда идти

- Flutter, UI, navigation, state, performance: `ai-context/frontend-flutter.md`.
- Backend REST API: `ai-context/backend-api.md`.
- Chat, realtime, websocket, voice, media: `ai-context/realtime-chat.md`.
- Prisma, models, migrations: `ai-context/database.md`.
- Auth, users, tokens, access: `ai-context/auth.md`.
- Infra, Redis, S3, worker, deploy: `ai-context/infra.md`.
- Entry points, routes, app start: `ai-context/entry-points.md`.
- Landing site: `ai-context/landing.md`.
- Context maintenance: `ai-context/maintenance.md`.

## Проверки

Flutter:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
```

Backend:

```bash
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
```

Admin:

```bash
cd admin && npm run build
cd admin && npm run test
```

Landing:

```bash
cd landing && npm run build
cd landing && npm run lint
```

Graph:

```bash
bash scripts/update-understand-graph.sh
node scripts/ua-query.test.mjs
```

## Обновление

После любых изменений файлов и перед финальным ответом обнови граф:

```bash
bash scripts/update-understand-graph.sh
```

Обновляй `ai-context` только когда поменялись правила, контракты, ключевые flows, архитектура, deploy, schema, auth, realtime или performance path.

Чтобы открыть dashboard:

```bash
bash scripts/update-start-graph.sh
```
