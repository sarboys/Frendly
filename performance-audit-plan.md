# Performance Audit Plan

Цель: ускорить hot path дейтинга, текстового чата и голосовых сообщений.

## Закрыто

- [x] Ограничить `sync.request` в чате. Теперь возвращается максимум 100 событий по умолчанию, есть `hasMore` и `nextEventId`.
- [x] Заменить полный проход по всем WebSocket на индексы `socketsByChatId` и `socketsByUserId`.
- [x] Добавить backpressure guard через `bufferedAmount`.
- [x] Добавить throttle для повторных typing events.
- [x] Добавить короткий TTL cache для успешных membership checks.
- [x] Убрать загрузку всех прошлых dating actions из `listDiscover`.
- [x] Перенести unread fanout из hot path `message.send` в worker через outbox event `unread.fanout`.
- [x] Научить worker обрабатывать несколько outbox events за один запуск.
- [x] Добавить индексы для blocklist, subscriptions, chat list, media, push tokens, outbox.
- [x] Добавить `downloadUrlPath` в media payload, чтобы клиент мог брать signed URL для голосовых и вложений.
- [x] Добавить bounded parallel push sends в worker.
- [x] Добавить нагрузочные сценарии для chat send ack, broadcast fanout, dating discover.
- [x] Проверить Flutter hot path чата в `mobile/`.
- [x] Убрать предварительную сборку всех message widgets в `ChatThreadScreen`.
- [x] Научить mobile читать `downloadUrlPath` и сразу брать signed URL без разбора `url`.
- [x] Научить mobile догружать следующую страницу `sync.snapshot`, если backend вернул `hasMore`.
- [x] Проверить реальные p50, p95, p99 на VPS `vps1` с Postgres и Redis.

## Проверки

```bash
pnpm -r build
pnpm --filter @big-break/chat test -- test/unit/chat-server.service.unit.spec.ts --runInBand
pnpm --filter @big-break/worker test -- test/unit/worker.service.spec.ts --runInBand
pnpm --filter @big-break/api test -- test/unit/dating.service.unit.spec.ts --runInBand
node --check backend/scripts/perf-hotpaths.mjs
cd mobile && flutter test test/shared/models/message_test.dart test/app/core/device/app_attachment_service_test.dart test/features/chats/presentation/chat_thread_providers_test.dart
```

## Нагрузочные сценарии

```bash
cd backend
pnpm exec node scripts/perf-hotpaths.mjs dating --api http://127.0.0.1:3000 --token TOKEN --requests 100 --concurrency 10
pnpm exec node scripts/perf-hotpaths.mjs chat-send --ws ws://127.0.0.1:3001 --token TOKEN --chat-id p1 --messages 100
pnpm exec node scripts/perf-hotpaths.mjs fanout --ws ws://127.0.0.1:3001 --sender-token TOKEN --subscriber-token TOKEN --chat-id p1 --subscribers 100 --runs 20
```

## VPS замер 2026-04-24

Сервер: `vps1`, замер внутри Docker network через `nginx`.

```text
dating-discover, 100 requests, concurrency 10
p50 71.4 ms, p95 104.1 ms, p99 117.3 ms

chat-send-ack, 100 messages
p50 11.9 ms, p95 17.1 ms, p99 35.3 ms

chat-broadcast-fanout, 20 subscribers, 20 runs
p50 19.2 ms, p95 31.2 ms, p99 34.1 ms
```

Примечание: для chat замеров создавался временный perf chat. После замеров он удален.
