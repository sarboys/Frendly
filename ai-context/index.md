# AI Context Index

Роутер для чтения контекста.

Порядок:

1. `project_map.md`.
2. Этот файл.
3. 1-2 файла ниже.
4. Конкретный код.

Не читай все `ai-context/*` подряд.

## Mobile app rule

- По умолчанию работай только с `mobile2/`.
- `mobile/` устарел. Не используй его в поиске, `rg`, графе, контекстных картах и правках, если пользователь явно не сказал `mobile/`.
- Для Flutter задач сначала открывай `ai-context/mobile2-backend-performance.md`. `ai-context/frontend-flutter.md` относится к старому `mobile/` и нужен только по явному запросу.

## Карты

- `ai-context/architecture.md`: общая структура проекта.
- `ai-context/frontend-flutter.md`: legacy Flutter app `mobile/`, только по явному запросу.
- `ai-context/mobile2-backend-performance.md`: правила быстрой backend интеграции для нового Flutter app `mobile2`.
- `ai-context/backend-api.md`: REST API, controllers, services, DTO, tests.
- `ai-context/landing.md`: landing site, pages, demo, deploy.
- `ai-context/realtime-chat.md`: chat, WebSocket, sync, unread, voice, attachments.
- `ai-context/database.md`: Prisma, models, migrations, seed, indexes.
- `ai-context/auth.md`: auth, sessions, tokens, Telegram login, guards.
- `ai-context/infra.md`: Docker, deploy, worker, Redis, S3, push.
- `ai-context/entry-points.md`: runtime entry points, app starts, routes.
- `ai-context/maintenance.md`: правила обновления карт.

## Типовые задачи

Flutter UI or screen in current app:

- `ai-context/mobile2-backend-performance.md`
- `ai-context/entry-points.md`, если нужны routes

Backend integration for `mobile2`:

- `ai-context/mobile2-backend-performance.md`
- `ai-context/backend-api.md`, если подключаешь REST contract
- `ai-context/realtime-chat.md`, если подключаешь chat или websocket

Если меняется визуал, добавь только нужные design docs:

- `docs/design-system-big-break.md`
- `docs/flutter-ui-mapping-big-break.md`
- `docs/flutter-engineering-standards.md`

Backend endpoint:

- `ai-context/backend-api.md`
- `ai-context/database.md`, если меняется модель or запрос

Landing site:

- `ai-context/landing.md`
- `ai-context/entry-points.md`, если нужны routes or deploy starts

Chat or realtime:

- `ai-context/realtime-chat.md`
- `ai-context/mobile2-backend-performance.md`, если нужен Flutter state or UI
- `ai-context/backend-api.md`, если нужен REST fallback
- `ai-context/infra.md`, если нужны Redis, worker, S3, deploy

Auth:

- `ai-context/auth.md`
- `ai-context/backend-api.md`, если нужен endpoint
- `ai-context/database.md`, если нужны Session or token models

Database or Prisma:

- `ai-context/database.md`
- `ai-context/backend-api.md`, если меняется API contract
- `ai-context/infra.md`, если нужны rollout, indexes, deploy

Infra, worker, deploy:

- `ai-context/infra.md`
- `ai-context/database.md`, если есть migrations
- `ai-context/realtime-chat.md`, если есть Redis or outbox flow

## Workspace

`ai-workspace` group: `frendly`.

Projects:

- root: `/Users/sergeypolyakov/MyApp`
- landing: `/Users/sergeypolyakov/MyApp/landing`
- mobile2: `/Users/sergeypolyakov/MyApp/mobile2`
- mobile: `/Users/sergeypolyakov/MyApp/mobile`, legacy, только по явному запросу
- backend: `/Users/sergeypolyakov/MyApp/backend`

Codex config:

- global: `/Users/sergeypolyakov/.codex/config.toml`
- project: `.codex/config.toml`
- MCP server: `ai-workspace`
- command: `/Users/sergeypolyakov/.local/bin/ai-workspace serve`

## Что не класть в markdown

- сырой код
- большие куски файлов
- логи
- build output
- секреты
- `.env`
- token values

Карты должны говорить, где лежит логика, как связаны модули, какие проверки запускать.

