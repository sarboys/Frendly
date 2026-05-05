# Отчет по Frendly Evening Flow v2

Дата проверки: 2026-04-26.

Проверялась новая схема:

`/Users/sergeypolyakov/Downloads/Frendly_Evening_Flow_v2.mmd`

Сравнение делалось с текущим кодом Flutter, backend API, Prisma и realtime chat.

## Короткий вывод

V2 схема уже описывает не просто личный маршрут, а полноценную публичную встречу вокруг Evening route.

В ней добавились:

1. Публикация вечера в `SCHEDULED`.
2. Показ вечера в Tonight, Map, Search и Chats.
3. Guest preview перед входом.
4. Privacy режимы `open`, `request`, `invite`.
5. Join request для гостей.
6. Host start из чата.
7. Live badges во всех discovery местах.
8. Late join во время live.
9. Системные сообщения в чат.
10. After Party со статистикой, фото и оценками.

Текущая реализация покрывает только часть старого MVP. Новые блоки из v2 почти все требуют новой модели `EveningSession`.

Главный риск остался тот же: сейчас `EveningRoute` это шаблон маршрута, но backend привязывает к нему один общий `chatId`. Для v2 этого уже точно недостаточно.

## Что реально работает сейчас

### Старт из Tonight

Работает вход в builder через `EveningHeroCard`.

Где найдено:

- `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- `mobile/lib/features/evening_plan/presentation/evening_hero_card.dart`

Ограничение: это просто CTA в builder, а не секция опубликованных вечеров.

### Builder и Plan

Работает локальный builder:

- цель
- настроение
- бюджет
- формат
- район

После выбора открывается локальный route preview.

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_builder_screen.dart`
- `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`
- `mobile/lib/features/evening_plan/presentation/evening_plan_data.dart`

Ограничение: это не AI flow и не backend resolve. Flutter не вызывает `/evening/options`, `/evening/routes/resolve`, `/evening/routes/:routeId`.

### Launch sheet частично совпадает с v2

Сейчас есть:

- время старта: сейчас, через 15 минут, через 30 минут
- режим: auto, manual, hybrid
- блок участников

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`

Ограничение: участников берут из hardcoded списка. Privacy `open/request/invite` нет. Приглашенные не выбираются реально.

### Backend launch и finish

Backend умеет:

- запустить route
- создать или обновить meetup chat
- записать `meetupPhase=live`
- записать mode
- записать `currentStep=1`
- завершить route и поставить `meetupPhase=done`

Где найдено:

- `backend/apps/api/src/controllers/evening.controller.ts`
- `backend/apps/api/src/services/evening.service.ts`
- `backend/packages/database/prisma/schema.prisma`

Ограничение: launch сразу делает `live`. Отдельного `scheduled` состояния нет.

### Chats phase

Chats уже умеют делить meetup chats на:

- live
- soon
- upcoming
- done

Done показывается в архиве.

Где найдено:

- `mobile/lib/features/chats/presentation/chats_screen.dart`
- `mobile/lib/shared/models/meetup_chat.dart`
- `backend/apps/api/src/services/chats.service.ts`

Ограничение: это работает для chat list, но не решает публикацию Evening в Tonight, Map и Search.

### Meetup chat и live pin

Meetup chat умеет показать pinned card для live Evening route.

Где найдено:

- `mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart`

Ограничение: pinned card появляется только в `live`. Для scheduled/upcoming план в чате не закреплен.

### Live UI

Live screen показывает timeline, текущий шаг, check-in, skip, next и finish.

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_live_meetup_screen.dart`

Ограничение: step state локальный. Backend не хранит check-in, skip, advance.

### After Party

After Party screen открывается после finish.

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_after_party_screen.dart`

Ограничение: фото, реакции, сохранение шаблона и оценки не пишутся в backend. Кнопка добавления фото пустая.

## Что добавили в v2 и чего нет в коде

### Phase SCHEDULED

В схеме после launch появляется:

`Phase: SCHEDULED`, вечер собирается.

В коде этого нет.

Сейчас backend `launchRoute` сразу пишет:

- `meetupPhase=live`
- `currentStep=1`

Даже если выбран старт через 15 или 30 минут, phase все равно становится `live`.

Влияние: P0.

Что нужно:

- разделить publish и start
- добавить session phase `scheduled`
- переводить `scheduled` в `soon` и `live` отдельной логикой
- не считать delayed launch уже начавшимся вечером

### Публикация в Tonight

В схеме есть секция:

`Идём сегодня вечером`

В коде Tonight есть `EveningHeroCard` и preview meetup chats, но нет списка опубликованных Evening sessions.

Где найдено:

- `mobile/lib/features/tonight/presentation/tonight_screen.dart`

Влияние: P1.

Что нужно:

- endpoint для публичных Evening sessions
- provider во Flutter
- отдельная секция Tonight
- карточка session с host, route, местами и phase

### MapScreen pins с маршрутом

В схеме scheduled evening должен появляться на карте как route pin.

В коде MapScreen работает с обычными `Event` из `/events`. Evening route sessions туда не попадают.

Где найдено:

- `mobile/lib/features/map/presentation/map_screen.dart`
- `mobile/lib/shared/data/backend_repository.dart`, `fetchEvents`

Влияние: P1.

Что нужно:

- либо включать Evening sessions в discovery API
- либо сделать отдельный `/evening/sessions` для map/search/today
- вернуть lat/lng текущего или первого route step

### Search фильтр На сегодня

В схеме Search должен находить опубликованные Evening sessions.

В коде Search ищет обычные events и people. Evening session provider там нет.

Где найдено:

- `mobile/lib/features/search/presentation/search_screen.dart`
- `mobile/lib/features/search/presentation/search_providers.dart`

Влияние: P1.

Что нужно:

- добавить Evening sessions в search results
- явно решить, это часть `/events` или отдельный блок результатов

### EveningPreview для гостя

В схеме гость открывает preview:

- маршрут
- участники
- свободные места
- хост

В коде отдельного `EveningPreview` нет.

Сейчас route preview есть только как `EveningPlanScreen`, он рассчитан на запуск хостом, а не на guest join.

Влияние: P1.

Что нужно:

- новый экран guest preview
- route `evening-session/:sessionId` или похожий
- backend DTO с host, participants, capacity, free seats, privacy

### Privacy open/request/invite

В схеме launch задает privacy:

- open
- request
- invite

В Evening backend и DB этого нет.

Есть похожая логика у обычных `Event`, но она не привязана к Evening route.

Где найдено:

- `backend/packages/database/prisma/schema.prisma`, `Event.joinMode`, `Event.accessMode`
- `backend/packages/database/prisma/schema.prisma`, `EveningRoute`
- `backend/apps/api/src/services/evening.service.ts`

Влияние: P0.

Что нужно:

- хранить privacy на `EveningSession`
- хранить capacity
- хранить host user id
- хранить invite token или invite link
- не переиспользовать `EveningRoute` как живую встречу

### JoinRequest для Evening

В схеме request mode создает join request, который хост принимает или отклоняет.

В коде join requests есть только для обычных events.

Где найдено:

- `backend/apps/api/src/services/events.service.ts`
- `backend/apps/api/src/services/host.service.ts`
- `mobile/lib/features/join_request/presentation/join_request_screen.dart`

Влияние: P1.

Что нужно:

- `EveningSessionJoinRequest`
- endpoints для request, cancel, approve, reject
- host dashboard или chat UI для заявок
- уведомления для хоста и гостя

### AutoJoin в чат

В схеме open mode сразу добавляет гостя в чат.

В текущем Evening API chat membership создается только для пользователя, который запускает route.

Где найдено:

- `backend/apps/api/src/services/evening.service.ts`, `launchRoute`

Влияние: P1.

Что нужно:

- endpoint join session
- проверка privacy
- проверка capacity
- создание `ChatMember`
- возврат `chatId`

### Host start из чата

В схеме host нажимает `Стартуем` из Chats или из чата встречи.

Сейчас soon card в Chats может открыть plan с `launch=1`. Но:

- host role не проверяется на Flutter
- backend не проверяет host ownership
- query `chatId` передается, но plan route фактически работает по `routeId`

Где найдено:

- `mobile/lib/features/chats/presentation/chats_screen.dart`
- `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`
- `backend/apps/api/src/services/evening.service.ts`

Влияние: P0.

Что нужно:

- запускать session, а не route template
- проверять host
- передавать `sessionId` и `chatId`
- показывать start CTA только host

### Live badge во всех местах

В схеме live должен пульсировать в Tonight, Map, Search и Chats.

Сейчас live явно есть в Chats и в meetup chat pinned card.

Нет live badge для Evening sessions в:

- Tonight
- Map
- Search

Влияние: P1.

Что нужно:

- общий `EveningSessionSummary`
- phase sync во всех providers
- UI badge в discovery cards and map pins

### System messages

В схеме чат получает системное сообщение:

`Вечер начался, шаг 1`

В коде таких системных сообщений для launch, step transition, check-in, finish и join нет.

Есть `share-chat`, но это обычное сообщение от пользователя про perk или ticket.

Где найдено:

- `backend/apps/api/src/services/evening.service.ts`, `shareStepToChat`
- `backend/apps/chat/src/chat-server.service.ts`

Влияние: P1.

Что нужно:

- тип system message или server-authored message
- события для launch, join, step advance, check-in, finish
- idempotency keys для системных сообщений

### Late guest и LiveEveningPreview

В схеме поздний гость видит live preview:

- текущий шаг
- где сейчас группа
- сколько осталось
- кнопка вписаться

В коде такого экрана нет.

Текущий live screen открыт по `routeId` и использует локальный route state. Он не является публичным preview для гостя.

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_live_meetup_screen.dart`

Влияние: P1.

Что нужно:

- guest live preview screen
- session detail endpoint
- join during live endpoint
- current step from backend
- free seats and privacy checks

### Late join auto message

В схеме при входе во время live чат получает:

`{Имя} присоединился на шаге 3`

В коде этого нет.

Влияние: P2.

Что нужно:

- создавать system message при accepted join
- включать current step в message payload
- не дублировать сообщение при retry

### After Party stats, photos, ratings

В схеме After Party содержит:

- статистику вечера
- фото
- оценки участников

В текущем Evening After Party это локальный экран.

Где найдено:

- `mobile/lib/features/evening_plan/presentation/evening_after_party_screen.dart`

Влияние: P2.

Что нужно:

- backend model для Evening feedback
- media upload привязать к session
- rating endpoint
- summary stats endpoint

## Главные расхождения с v2

### P0

1. Нет `EveningSession`.
2. Нет `scheduled` phase.
3. `launchRoute` сразу делает `live`.
4. `EveningRoute.chatId` делает chat общим для route template.
5. Нет host ownership и membership checks для launch и finish.
6. Нет privacy `open/request/invite` для Evening.
7. Flutter не использует `chatId` из launch response.
8. Live screen строит `chatId` локально как `evening-chat-${routeId}`.

### P1

1. Нет discovery API для published Evening sessions.
2. Нет секции Tonight `Идём сегодня вечером`.
3. Нет Evening pins на Map.
4. Нет Evening results в Search.
5. Нет guest `EveningPreview`.
6. Нет guest join flow.
7. Нет Evening join requests.
8. Нет realtime phase refresh через `chat.updated`.
9. Нет backend step advance, skip, check-in.
10. Нет live badge в Tonight, Map, Search.
11. Нет system messages.
12. Auto mode без timer engine.

### P2

1. After Party не сохраняет фото, оценки и статистику.
2. Participants в Launch и Live сейчас hardcoded.
3. Тексты и route data во Flutter живут отдельно от backend seed.
4. Premium unlock не подключен к реальной подписке на plan route.

## Что нужно добавить в архитектуру

### 1. EveningSession

Новая сущность нужна обязательно. Без нее v2 будет ломаться на нескольких пользователях.

Минимальные поля:

- `id`
- `routeId`
- `hostUserId`
- `chatId`
- `phase`: draft, scheduled, soon, live, done, canceled
- `privacy`: open, request, invite
- `mode`: auto, manual, hybrid
- `capacity`
- `startsAt`
- `startedAt`
- `endedAt`
- `currentStep`
- `inviteToken`

### 2. EveningSessionParticipant

Нужно хранить участников отдельно от chat members.

Минимальные поля:

- `sessionId`
- `userId`
- `role`: host, guest
- `status`: invited, requested, joined, declined, removed
- `joinedAt`
- `leftAt`

### 3. EveningSessionJoinRequest

Нужно для privacy `request`.

Минимальные поля:

- `sessionId`
- `userId`
- `status`
- `note`
- `reviewedById`
- `reviewedAt`

### 4. EveningSessionStepState

Нужно для live progress.

Минимальные поля:

- `sessionId`
- `stepId`
- `status`: upcoming, current, done, skipped
- `startedAt`
- `finishedAt`
- `skippedAt`

### 5. EveningStepCheckIn

Нужно для check-ins.

Минимальные поля:

- `sessionId`
- `stepId`
- `userId`
- `checkedInAt`

### 6. EveningAfterParty

Можно начать просто.

Минимальные поля:

- `sessionId`
- `userId`
- `rating`
- `reaction`
- `comment`
- `photoAssetId`

## API, который нужен под v2

Минимальный набор:

```text
POST /evening/sessions
GET /evening/sessions
GET /evening/sessions/:sessionId
POST /evening/sessions/:sessionId/publish
POST /evening/sessions/:sessionId/join
POST /evening/sessions/:sessionId/join-request
POST /evening/sessions/:sessionId/join-requests/:requestId/approve
POST /evening/sessions/:sessionId/join-requests/:requestId/reject
POST /evening/sessions/:sessionId/start
POST /evening/sessions/:sessionId/steps/:stepId/check-in
POST /evening/sessions/:sessionId/steps/:stepId/advance
POST /evening/sessions/:sessionId/steps/:stepId/skip
POST /evening/sessions/:sessionId/finish
GET /evening/sessions/:sessionId/after-party
POST /evening/sessions/:sessionId/after-party/feedback
POST /evening/sessions/:sessionId/after-party/photos
```

Старые route endpoints можно оставить для route template:

```text
GET /evening/options
POST /evening/routes/resolve
GET /evening/routes/:routeId
```

## Flutter, который нужен под v2

1. Модели:
   - `EveningSessionSummary`
   - `EveningSessionDetail`
   - `EveningParticipant`
   - `EveningJoinRequest`
2. Providers:
   - published sessions for Tonight
   - map sessions
   - search sessions
   - session detail
   - session live state
3. Screens:
   - `EveningPreviewScreen`
   - `LiveEveningPreviewScreen`
   - возможно `EveningJoinRequestScreen`
4. Existing screens нужно перевести с `routeId` на `sessionId` там, где это живой вечер:
   - live
   - after party
   - guest preview
   - chat pinned card
5. Launch sheet:
   - добавить privacy
   - добавить capacity
   - добавить реальные invited users
   - после launch получать `sessionId` и `chatId`
6. Chats:
   - start CTA только для host
   - pinned plan для scheduled/upcoming
   - pinned live state для live
7. Realtime:
   - обрабатывать `chat.updated`
   - добавить event для session phase
   - обновлять summary без полного refresh

## Что можно делать первым

### Шаг 1

Сделать backend `EveningSession` и миграцию.

Проверка:

- один route можно запустить двумя разными sessions
- у каждой session свой chat
- старый shared `EveningRoute.chatId` больше не нужен для новых запусков

### Шаг 2

Поменять launch API.

Проверка:

- launch возвращает `sessionId`, `chatId`, `phase=scheduled`
- Flutter сохраняет эти значения
- live открывается по session, а не по route template

### Шаг 3

Добавить privacy и join.

Проверка:

- open сразу добавляет в chat
- request создает заявку
- invite требует invite token
- capacity не дает переполнить вечер

### Шаг 4

Добавить discovery.

Проверка:

- scheduled sessions видны в Tonight
- sessions видны в Search
- sessions видны на Map
- guest preview открывается по session id

### Шаг 5

Добавить live sync.

Проверка:

- host start переводит scheduled в live
- current step приходит с backend
- check-in, skip, advance сохраняются
- Chats, Tonight, Map и Search видят live phase

### Шаг 6

Добавить system messages и After Party.

Проверка:

- launch пишет системное сообщение
- late join пишет системное сообщение с номером шага
- finish пишет системное сообщение
- After Party сохраняет rating и photo

## Проверка

На этом шаге код проекта не менялся. Обновлен отчет и поправлен один синтаксический узел в v2 схеме.

Проверялись:

- новая схема v2
- текущие RAG карты
- Flutter screens and providers
- backend Evening API
- Prisma schema
- chat realtime contracts

Mermaid render для `Frendly_Evening_Flow_v2.mmd` сначала падал на узле `LateJoin`.

Причина: подпись содержит `{Имя}` внутри незаключенного в кавычки node label. Mermaid CLI воспринимает `{` как начало shape.

Исправлено: label узла `LateJoin` завернут в кавычки. После этого Mermaid CLI успешно собрал SVG в `/tmp/frendly_evening_flow_v2.svg`.

Дополнительно важно: текущие тесты из прошлого отчета подтверждают старый MVP, но почти не покрывают v2 функционал.

Нужны новые тесты:

1. Backend unit tests для `EveningSession`.
2. Backend integration tests для privacy and join.
3. Flutter tests для launch sheet с privacy.
4. Flutter tests для guest preview.
5. Flutter tests для chat start CTA только у host.
6. Realtime tests для phase update.

## Итог

V2 схема описывает правильное направление продукта, но она сильно шире текущей реализации.

Сейчас работает личный Evening route flow и часть chat phase UI.

Для v2 нужно сначала ввести `EveningSession`. Без этого нельзя безопасно сделать scheduled publication, guest join, privacy, live state и After Party.
