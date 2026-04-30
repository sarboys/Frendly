# AI Context Maintenance

Keep `ai-context` short and useful.

## When to update

Update one relevant map when these change:

- module architecture
- key logic path
- API contract
- Prisma model, relation, migration or seed
- WebSocket event, sync, unread or attachment flow
- auth, session or token behavior
- media, upload or cache flow
- Flutter navigation
- shared widget or service
- performance critical path
- compose, deploy, Redis, S3 or worker flow

Do not update maps for tiny local changes like button text, small spacing, formatting or a test-only change with no behavior change.

## How to update

1. Pick the one relevant map.
2. Add architecture, links and commands only.
3. Do not paste raw code.
4. Keep it short.
5. If a path moved, update references in related maps.

## File ownership

- `index.md`: router and workspace notes.
- `architecture.md`: product shape and runtime flows.
- `frontend-flutter.md`: Flutter routes, screens, state, UI, performance.
- `backend-api.md`: REST controllers, services, endpoints, DTO, tests.
- `database.md`: Prisma schema, models, migrations, seed, indexes.
- `realtime-chat.md`: WebSocket, chat sync, unread, attachments, typing.
- `auth.md`: auth flow, sessions, JWT, Telegram, Google, Yandex.
- `infra.md`: Docker, deploy, Redis, S3, worker, push.
- `landing.md`: React/Vite landing, pages, demo, styles, deploy.
- `entry-points.md`: boot files, app starts, routes.

## Optional checks

```bash
ai-workspace reindex
ai-workspace search "<keyword>" --limit 5
```

If workspace shares changed:

```bash
ai-workspace sync
ai-workspace status
```

