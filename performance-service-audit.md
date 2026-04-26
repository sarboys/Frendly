# Performance Service Audit Runbook

Цель: дать агенту готовый сценарий аудита производительности для любого нового сервиса, экрана или функции.

Файл нужен для повторного запуска в отдельной сессии. Открываешь его, называешь сервис, агент проходит по чеклисту, находит проблемы, пишет отчет и план исправлений.

## Режимы аудита

Перед стартом выбрать один режим. Если пользователь не указал режим, брать `Full-stack audit`.

### Mobile audit

Использовать, когда сервис или фича затрагивает Flutter.

Проверять:

- экран и его hot path
- rebuild, layout, scroll
- Riverpod state, invalidation, lifecycle
- image and media path
- cache first и repeat open
- память, controllers, streams, timers
- offline, retry, optimistic UI
- совпадение с `front/` и design system

Минимальные артефакты:

- список Flutter файлов
- список providers, controllers, streams
- список API calls из сценария
- список media widgets и usage profiles
- найденные P0, P1, P2
- команды `flutter test`, если есть подходящие тесты

### Backend audit

Использовать, когда сервис или фича затрагивает API, WebSocket, DB, workers.

Проверять:

- endpoints и request path
- WebSocket events
- Prisma queries, индексы, `where + orderBy`
- cursor pagination
- idempotency, dedup, retry
- queues, workers, outbox
- media upload, signed URL, access checks
- p50, p95, p99 для hot path

Минимальные артефакты:

- список endpoints
- список WebSocket events
- список Prisma models и индексов
- список worker jobs
- найденные P0, P1, P2
- команды `pnpm test` и perf scripts

### Full-stack audit

Использовать по умолчанию.

Проверять цепочку целиком:

- tap или scroll на mobile
- local state
- cache path
- HTTP или WebSocket request
- backend service
- DB query
- worker side effects
- realtime response
- UI update после ответа

Главная цель: найти место, где пользователь видит лаг, дубль, пропуск, stale state или лишний reload.

Минимальные артефакты:

- карта сценария от UI до DB
- список мест, где есть full refetch
- список мест, где есть unbounded работа
- список мест, где backend доверяет client-side данным
- список измерений или блокеров измерений
- план исправления по P0 и P1

## Как запускать в новой сессии

Скопируй такой запрос:

```text
Открой performance-service-audit.md.
Проведи performance audit для сервиса: <название сервиса>.
Зона проверки: <mobile / backend / оба>.
Сценарии: <например, открыть экран, свайпнуть профиль, отправить текст, отправить голосовое, проскроллить 500 сообщений>.
Нужно: найти P0, P1, P2 проблемы, дать файлы, строки, риски, тесты, план исправлений.
Код пока не менять, сначала отчет.
```

Если нужно сразу чинить:

```text
Открой performance-service-audit.md.
Проведи audit для <название сервиса>.
После отчета начни закрывать P0 и P1 по одному.
После каждого пункта запускай проверку.
```

## Обязательные документы перед аудитом

Перед проверкой агент читает:

- `AGENTS.md`
- `docs/flutter-engineering-standards.md`
- `docs/design-system-big-break.md`
- `docs/flutter-ui-mapping-big-break.md`
- `performance-audit-plan.md`, если файл есть
- `app-audit.md`, если файл есть

Правило проекта: performance first включен всегда.

## Формат результата

Каждая проблема пишется так:

```text
Finding N
Приоритет: P0 / P1 / P2 / P3
Сервис:
Сценарий:
Файл:
Строки:
Проблема:
Почему это тормозит:
Что будет на слабом устройстве:
Что будет при длинной истории или большом списке:
Как проверить:
Что исправить:
Нужен тест:
```

Приоритеты:

- P0: потеря сообщений, падение, утечка данных, зависание UI, backend деградирует под нагрузкой.
- P1: заметный лаг, лишний rebuild, N+1, unbounded работа, рост памяти, плохой cursor flow.
- P2: лишняя сложность, слабый cache path, неидеальный fallback, отсутствие метрик.
- P3: стиль, читаемость, локальное улучшение без риска для hot path.

## Performance budgets

Эти цифры не абсолютный закон. Это планка для уровня топовых приложений.

Mobile:

- открытие уже загруженного экрана: до 150 ms до первого полезного состояния
- открытие экрана с сетью: до 800 ms до usable state
- tap response: до 100 ms
- scroll: без dropped frames, frame build до 8 ms, raster до 8 ms
- отправка сообщения: optimistic bubble сразу, backend ack без блокировки UI
- переход назад или между табами: без повторной тяжелой загрузки
- повторное открытие: local first или cache first

Backend:

- chat send ack внутри backend: p95 до 50 ms, p99 до 100 ms
- dating discover: p95 до 150 ms, p99 до 250 ms
- fanout 20 подписчиков: p95 до 50 ms, p99 до 100 ms
- endpoint со списком: всегда pagination, `limit + 1`, stable cursor
- worker job: batch, retry, timeout, bounded concurrency

Memory:

- длинный чат не держит все widgets, keys, audio players, image bytes
- экран после pop освобождает controllers, streams, timers
- image cache и media cache имеют понятные лимиты
- нет роста памяти после 10 циклов открыть, закрыть, открыть

## Порядок аудита

### 1. Зафиксировать сервис

Записать:

- что проверяем
- пользовательский сценарий
- mobile файлы
- backend файлы
- API endpoints
- WebSocket events
- Prisma models
- workers или queues
- media path
- cache path

### 2. Найти hot path

Для каждого сценария ответить:

- что происходит по tap
- что происходит по scroll
- что происходит при open screen
- что происходит при repeat open
- какие данные идут из cache
- какие данные идут из сети
- какие операции идут на UI isolate
- какие операции идут в Node.js event loop
- где есть retry
- где есть optimistic UI

### 3. Проверить bounded работу

Нельзя:

- строить весь список заранее
- хранить `GlobalKey` для каждого элемента длинного списка
- проходить все сообщения на каждый build
- грузить все изображения профилей заранее
- делать full refetch после маленького действия
- держать unbounded `Promise.all`
- делать fanout через полный проход всех sockets
- загружать full relation graph без `take`
- читать все прошлые actions, messages, notifications, events без лимита

Нужно:

- показывать только видимый блок плюс ближайший следующий
- использовать cursor pagination
- использовать local remove или patch вместо full reload там, где это проще
- держать cache key, image profile, fallback в shared layer
- выносить тяжелую работу в worker или isolate
- ограничивать concurrency

### 4. Быстрый поиск по Flutter

Команды:

```bash
rg -n "CachedNetworkImage|Image\\.network|precacheImage" mobile/lib
rg -n "GlobalKey|Map<.*GlobalKey|ScrollController|TextEditingController|AnimationController|Timer|StreamSubscription" mobile/lib
rg -n "SingleChildScrollView|shrinkWrap: true|ListView\\(|GridView\\(" mobile/lib
rg -n "setState\\(|ref\\.watch|ref\\.invalidate|FutureBuilder|StreamBuilder" mobile/lib
rg -n "compute\\(|jsonDecode|base64Decode|Uint8List|File\\(|readAsBytes" mobile/lib
```

Что искать:

- прямой `CachedNetworkImage` или `Image.network` внутри feature screen
- нет usage profile для avatar, card, hero, fullscreen
- `GlobalKey` на каждую строку списка
- `SingleChildScrollView` с большим количеством элементов
- `shrinkWrap: true` внутри scroll
- тяжелая логика в `build`
- полный `ref.invalidate` после локального действия
- один provider дергает весь экран
- controllers, streams, timers без dispose
- audio bytes или image bytes в state

### 5. Быстрый поиск по backend

Команды:

```bash
rg -n "findMany\\(|include:|take:|orderBy|cursor|skip" backend/apps backend/packages
rg -n "Promise\\.all|for await|for \\(|forEach\\(|setInterval|setTimeout" backend/apps backend/packages
rg -n "emit\\(|broadcast|send\\(|bufferedAmount|WebSocket|Socket" backend/apps backend/packages
rg -n "createMany|upsert|idempotency|clientMessageId|unique|@@index|@@unique" backend/packages/database backend/apps
rg -n "upload|signed|downloadUrl|publicUrl|MediaAsset|objectKey|S3" backend/apps backend/packages
```

Что искать:

- `findMany` без `take`
- `include` тащит тяжелые связи без нужды
- cursor нестабилен при одинаковой дате или дистанции
- нет индекса под `where + orderBy`
- нет idempotency key для create
- нет `clientMessageId` для сообщений
- fanout делает полный scan sockets
- push отправляется unbounded
- worker берет по одной задаче, хотя может batch
- media идет через backend bytes там, где нужен signed URL или CDN
- нет retry, timeout, dead-letter поведения для job

### 6. Dating audit

Hot paths:

- открыть dating discover
- свайп влево, вправо, superlike
- открыть профиль
- перейти к чату после match
- вернуться назад
- повторно открыть discover

Проверить mobile:

- после swipe не пропускается следующий профиль
- после swipe не идет полный rebuild всего экрана
- текущая карточка удаляется локально или cursor сбрасывается корректно
- prefetch ограничен ближайшими 1, 2 профилями
- profile photos идут через shared media widget
- usage profile задан: `avatar`, `card`, `hero`, `fullscreen`
- image fallback общий
- кэш не скачивает одни фото повторно
- карточка не держит тяжелые bytes в state
- анимация свайпа не вызывает layout thrash

Проверить backend:

- discover не читает все прошлые actions
- есть cursor или bounded limit
- есть индексы под actions, blocks, subscription, profile visibility
- action create идемпотентен
- match create не создает дубли
- chat create после match идемпотентен
- blocklist учитывается в discover
- private profiles не попадают в выдачу

Минимальные проверки:

```bash
cd backend
pnpm --filter @big-break/api test -- test/unit/dating.service.unit.spec.ts --runInBand
pnpm --filter @big-break/api test -- test/integration/dating.integration.spec.ts --runInBand
node --check scripts/perf-hotpaths.mjs
```

Нагрузочный сценарий:

```bash
cd backend
pnpm exec node scripts/perf-hotpaths.mjs dating --api http://127.0.0.1:3000 --token TOKEN --requests 100 --concurrency 10
```

### 7. Text chat audit

Hot paths:

- открыть список чатов
- открыть длинный чат
- проскроллить 500, 1000 сообщений
- отправить текст
- получить сообщение по realtime
- reply jump
- reconnect
- mark read

Проверить mobile:

- `ListView.builder` или другой lazy list
- нет построения всех message widgets заранее
- key строки это `ValueKey(message.id)`
- `GlobalKey` только временно для reply target, не map на весь чат
- `_handleMessagesRendered` не проходит все message ids на каждый build
- bubble rebuild не дергает весь экран
- composer state отделен от list state
- optimistic bubble появляется сразу
- failed message можно retry без дубля
- scroll position сохраняется
- read receipts и typing не вызывают full rebuild

Проверить backend:

- `message.send` возвращает ack быстро
- unread fanout не в горячем пути, лучше outbox worker
- есть `clientMessageId` и dedup
- broadcast идет только по sockets нужного chatId
- есть `bufferedAmount` guard
- typing events throttled
- sync snapshot имеет limit, `hasMore`, `nextEventId`
- membership check не делает DB hit на каждое событие без cache
- reconnect не дублирует подписки

Минимальные проверки:

```bash
cd backend
pnpm --filter @big-break/chat test -- test/unit/chat-server.service.unit.spec.ts --runInBand
pnpm --filter @big-break/chat test -- test/realtime/session.realtime.spec.ts --runInBand
pnpm --filter @big-break/api test -- test/integration/core.integration.spec.ts --runInBand
```

Нагрузочные сценарии:

```bash
cd backend
pnpm exec node scripts/perf-hotpaths.mjs chat-send --ws ws://127.0.0.1:3001 --token TOKEN --chat-id CHAT_ID --messages 100
pnpm exec node scripts/perf-hotpaths.mjs fanout --ws ws://127.0.0.1:3001 --sender-token TOKEN --subscriber-token TOKEN --chat-id CHAT_ID --subscribers 100 --runs 20
```

### 8. Voice chat audit

Hot paths:

- открыть чат с голосовыми
- записать голосовое
- отправить голосовое
- получить голосовое в realtime
- проиграть голосовое
- быстро пролистать чат с голосовыми
- повторно открыть чат

Проверить mobile:

- запись не блокирует UI isolate
- waveform не считается на UI isolate для больших payload
- audio player не создается для каждого bubble заранее
- одновременно активен ограниченный набор players
- при dispose player закрывается
- upload идет direct или signed path, не через большой JSON
- progress upload не rebuild весь чат
- playback URL берется cache first, потом signed URL
- expired signed URL обновляется без пересоздания всей строки
- voice bytes не лежат в provider state

Проверить backend:

- upload использует media asset и signed URL там, где нужно
- metadata: `durationMs`, `waveform`, `mimeType`, `byteSize`
- chat member проверяется на upload и playback
- private media не доступно без прав
- signed URL не логируется
- worker может обработать media jobs batch
- нет передачи больших audio bytes через WebSocket

Минимальные проверки:

```bash
cd backend
pnpm --filter @big-break/api test -- test/integration/media.integration.spec.ts --runInBand
pnpm --filter @big-break/api test -- test/integration/core.integration.spec.ts --runInBand -t "voice"
```

### 9. Media and image audit

Проверить:

- feature screens не используют прямой raw image path
- все profile, dating, chat, posters media идут через shared layer
- есть usage profile: `avatar`, `card`, `hero`, `fullscreen`, `chatAttachment`, `voice`
- размеры картинок не больше нужного viewport
- thumbnail не заменен full image
- fallback общий
- placeholder не меняет layout
- prefetch bounded
- cache key стабильный
- private media очищается после logout, если это нужно

Команды:

```bash
rg -n "CachedNetworkImage|Image\\.network|NetworkImage|publicUrl|downloadUrl|downloadUrlPath" mobile/lib backend/apps
rg -n "BB.*Image|Media|mediaAsset|MediaResource|usage" mobile/lib backend/apps
```

### 10. Realtime audit

Проверить:

- reconnect с backoff
- heartbeat
- dedup по event id
- resume cursor
- ack на важные события
- bounded sync после reconnect
- subscriptions не дублируются
- stale events не перетирают свежее состояние
- offline queue не создает дубли
- typing, read receipts, presence имеют throttle или debounce

Backend:

- socket индексируется по userId и chatId
- broadcast идет только нужной аудитории
- slow socket не тормозит всех
- большой payload не отправляется всем
- Redis pubsub или другой bus не теряет важные события без retry там, где retry нужен

### 11. Database audit

Для каждого endpoint с `where + orderBy` проверить индекс.

Команды:

```bash
rg -n "@@index|@@unique|model Event|model Chat|model Message|model MediaAsset|model DatingAction|model OutboxEvent" backend/packages/database/prisma/schema.prisma
rg -n "findMany\\(|orderBy|where:" backend/apps/api/src backend/apps/chat/src backend/apps/worker/src
```

Чеклист:

- stable cursor использует tie breaker по id
- cursor поле совпадает с `orderBy`
- `limit + 1` используется для `nextCursor`
- offset pagination не используется в горячих лентах
- N+1 нет
- крупные relation include заменены select
- для counters нет full scan на каждый запрос
- migrations добавляют индексы без риска для prod

### 12. Worker and queue audit

Проверить:

- тяжелая работа не в request path
- job idempotent
- есть retry count
- есть status: pending, processing, done, failed
- stale processing можно вернуть в pending
- batch size ограничен
- concurrency ограничен
- push sends bounded
- job payload не хранит лишние персональные данные
- failed jobs можно найти

Минимальные проверки:

```bash
cd backend
pnpm --filter @big-break/worker test -- test/unit/worker.service.spec.ts --runInBand
```

### 13. Что обязательно измерить

Для каждого сервиса записать:

```text
Сценарий:
Команда или ручной шаг:
p50:
p95:
p99:
Память до:
Память после:
Dropped frames:
Повторное открытие:
Вывод:
```

Если нет staging token или URL, написать:

```text
Блокер замера:
Нужен URL:
Нужен token:
Нужен chatId/eventId/profileId:
Что можно проверить локально:
```

### 14. Готовый отчет после аудита

Финальный отчет должен быть коротким:

```text
Проверил сервис:
Hot paths:
Найдено:
P0:
P1:
P2:
Главный риск:
Что чинить первым:
Что измерить после исправления:
Команды проверки:
```

Если аудит сразу переходит в исправления, работать так:

1. Сначала P0
2. Потом P1 по hot path
3. Потом тесты
4. Потом замер
5. Потом запись результата в отчет

Не чинить соседние проблемы без связи с найденным hot path.
