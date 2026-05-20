# Mobile2 Backend Performance Guide

Используй этот файл в новой сессии, когда подключаешь готовый backend к `mobile2`.

Цель простая: новое приложение должно работать быстро сразу после подключения backend. Не делай временную простую интеграцию, если она потом приведет к медленному старту, лишним запросам, скачкам UI, тяжелым картинкам или нестабильному чату.

## Главный принцип

`mobile2` нельзя подключать к backend как набор прямых запросов из экранов.

Нужен слой данных:

1. UI читает Riverpod provider.
2. Provider идет в repository.
3. Repository решает, что брать из памяти, локального хранилища, cache или сети.
4. UI получает уже готовое состояние.

Экран не должен знать, как устроены токены, refresh, retry, cache, signed media URLs, pagination или websocket.

## Порядок работы в новой сессии

1. Сначала прочитай `project_map.md`.
2. Потом прочитай `ai-context/index.md`.
3. Потом прочитай этот файл.
4. Потом прочитай `ai-context/frontend-flutter.md`.
5. Если задача затрагивает auth, chat, realtime, API contract или media, прочитай нужную карту из `ai-context`.
6. Перед чтением кода запусти `./scripts/ua-query.mjs "<ключевые слова>"`.
7. Не читай весь проект. Выбирай только нужные файлы.

## Что надо перенести как концепцию

Старое приложение было быстрым не из-за одного трюка.

Оно держалось на нескольких правилах:

- warm open показывает данные из локального слоя быстро;
- сеть обновляет данные в фоне;
- одинаковые GET запросы не дублируются;
- stale запросы отменяются;
- media грузится через общие виджеты;
- картинки декодируются под реальный размер на экране;
- чат сначала показывает локальный snapshot;
- websocket подключается только там, где нужен;
- realtime обновляет локальные summary, badges и thread state;
- списки не пересобирают весь экран ради одного изменения;
- длинные списки строятся лениво;
- map objects кешируются;
- heavy native plugins стартуют только в нужном месте;
- session cleanup чистит приватный cache при logout или смене user id.

При подключении backend к `mobile2` эти правила важнее скорости написания кода.

## Архитектура слоя данных

Для `mobile2` нужен общий data foundation.

Минимальный набор:

- `ApiClient` на Dio;
- auth token storage через secure storage;
- refresh token flow;
- repository как единая граница REST mapping;
- local-first cache;
- chat local store;
- attachment service;
- media prewarm service;
- websocket client;
- session controller;
- shared app providers.

UI фичи не должны создавать Dio, читать secure storage или собирать URL руками.

## API client

HTTP слой должен делать это:

- добавлять bearer token к private запросам;
- делать refresh token ровно один раз после 401;
- повторять исходный запрос после успешного refresh;
- сохранять исходные timeout, method, headers, query, data и cancel token;
- иметь connect, send и receive timeout;
- dedupe одинаковых GET запросов;
- разделять dedupe по auth scope;
- dedupe должен работать и для GET с caller `CancelToken`, потому что repository providers передают cancel token почти всегда;
- позволять отключить dedupe только для редких запросов;
- не дедуплицировать stream responses;
- не прятать реальные ошибки, если cache пустой.

Нельзя делать так:

- вызывать `Dio()` внутри экрана;
- добавлять token в каждом provider руками;
- делать refresh в каждом методе repository;
- повторять одинаковый GET с разных виджетов;
- оставлять запрос живым после dispose экрана.

## Local-first cache

Повторное открытие экрана должно быть быстрым.

Правило:

1. Свежие данные из локального cache можно показать сразу.
2. После этого сеть обновляет cache в фоне.
3. Если cache stale, не выдавай его как будто он свежий.
4. Если сети нет, можно показать старые данные только в явном degraded state.
5. Если cache пустой, показывай normal loading state.

Cache key должен включать:

- endpoint;
- query params;
- user scope;
- город;
- координаты или округленные bounds;
- фильтры;
- limit;
- cursor, если это не first page.

User scoped данные нельзя смешивать между аккаунтами.
В `mobile2` user scope идет через `currentCacheScopeProvider`. Hot local-first providers должны зависеть от него через `watch`, чтобы после auth bootstrap не оставаться на `public` scope.

При logout или смене user id нужно чистить:

- private DTO cache;
- chat summaries;
- chat messages;
- sync cursors;
- pending commands;
- private media cache;
- signed download URL cache.

`LocalFirstRepository` поддерживает `fetch` для one-shot чтения и `watch` для hot экранов. `watch` сначала emit-ит свежий cache, запускает background refresh, затем emit-ит fresh данные после записи в `AppLocalCacheStore`.

Создание встречи через `MeetingActionsController.createEvent` после успешного `POST /events` чистит namespace `events` в `AppLocalCacheStore`, потом инвалидирует home and meetings providers. Это нужно, чтобы warm open не показывал старую ленту после publish.

Принятие приглашения на встречу в `NotificationsActionsController.acceptEventInvite` вызывает `POST /events/:eventId/invites/:requestId/accept`, затем инвалидирует events, meeting detail, map events, chat lists, host profile family, notifications and unread count. Отклонение через `declineEventInvite` вызывает `POST /events/:eventId/invites/:requestId/decline`, затем инвалидирует detail, notifications and unread count.

`NotificationsActionsController.markRead` после успешного `POST /notifications/:id/read` обновляет local-first cache списка уведомлений и `unread-count`: выбранный item получает `read/isRead/readAt`, а счетчик уменьшается локально. `markAllRead` после `POST /notifications/read-all` помечает все cached items прочитанными и ставит `unread-count=0`. Это нужно, чтобы warm and visible notifications state не ждал повторный GET.

Когда chat realtime socket уже активен, `notification.created` идет через `ChatRealtimeSession.onNotificationCreated` в `NotificationsActionsController.applyRealtimeNotificationCreated`. Handler кладет новую notification наверх cached list, убирает дубль по id и увеличивает cached `unread-count`, если notification unread. Новый socket ради notifications отдельно не стартует.

`BackendRepository.fetchMeetupChats` запрашивает `/chats/meetups?includeSocial=false`, чтобы список встреч использовал compact backend response без тяжелых social preview данных. Personal chats остаются на `/chats/personal`.

`ChatActions.deleteChat` удаляет chat summary из `ChatLocalStore` до ответа backend, чтобы visible list обновился сразу. Перед удалением action сохраняет summary rows, и если `DELETE /chats/:chatId` падает, возвращает их через `restoreSummaries`, затем rethrow-ит ошибку.

## Provider rules

Каждый backend screen должен читать данные через provider.

Правила:

- detail, search, filter, map viewport и temporary screens делай `autoDispose`;
- для provider с сетевым запросом добавляй cancel token;
- при dispose cancel token должен отменяться;
- не жди auth bootstrap для public data;
- private data проверяет наличие auth tokens;
- если auth tokens нет, provider возвращает пустое состояние без сетевого запроса;
- не запускай chat realtime на старте приложения;
- не запускай provider ради данных, которые не видны на текущем экране;
- используй `select`, когда нужен только маленький кусок большого state.

Search input не должен дергать backend на каждый символ. В `SearchScreen` query идет в `searchResultsProvider` только после debounce около 300 ms. Старый запрос отменяется через `autoDispose` provider и `CancelToken`.

UI state вроде активного tab, chip, local form draft можно держать локально.

Server state должен жить в provider или controller.

## Lists and pagination

Длинные списки нельзя строить через большой `ListView(children: [...])`.

В `mobile2` список чатов на `ChatsScreen`, результаты поиска, список афиши и каталог маршрутов построены через `CustomScrollView` и `SliverList`, чтобы rows создавались лениво. Не возвращай их к `Column` или большому списку children.

Используй:

- `ListView.builder`;
- `SliverList`;
- `GridView.builder`;
- paging controller через provider или notifier;
- явный `loadNextPage`;
- scroll listener, а не вызов загрузки из `itemBuilder`.

Refresh не должен очищать текущий список.

Правильное поведение:

- первый пустой экран показывает fullscreen loading;
- warm screen показывает старые элементы;
- refresh идет тихо;
- ошибка refresh показывается компактно;
- pull to refresh делает force refresh;
- next page error не ломает уже загруженные элементы.

Home first screen не должен запрашивать больше элементов, чем сразу показывает. Текущие лимиты: 6 events для ближайших встреч и 8 affiche items для блока афиши. Home and Meetings event providers должны отправлять текущий city в `/events` и включать city в cache key.

Hot local-first providers должны быть `StreamProvider`, если UI должен увидеть background refresh без переоткрытия экрана. Сейчас так работают home events, meetings, posters, route templates, communities, map events, dating discover, matches, notifications, after dark events, perks, place search и trusted contacts.

`mobile2` affiche flow живет в `features/posters/presentation`. `/posters` читает `postersQueryProvider`, search debounce около 260 ms, cache key включает city, query, date/date range, priceMode, category and limit. Next page грузится явно через `postersPaginationProvider`, когда список близко к низу, и не очищает уже видимые items. `/posters/:posterId` читает `posterDetailProvider`, он идет в `BackendRepository.fetchAfficheDetail('/affiche/events/:id')` и local-first cache namespace `affiche`.

Affiche detail открывает создание встречи через `/meetings/new?afficheEventId=<id>`. `NewMeetingScreen` загружает `posterDetailProvider(id)`, прикрепляет affiche source, префиллит title, description, date, time, place and address, а publish отправляет `afficheEventId` в `POST /events`. Idempotency key создается один раз на draft, а не на каждый retry.

Meeting detail в `mobile2/features/meetings/presentation/meeting_detail_screen.dart` читает `entryRequirements` из `GET /events/:id`. Если `canJoin=false`, экран показывает карту закрытого доступа и ведет missing verification на `/verify`, а Frendly+ на `/paywall`. Для встреч с `accessMode/joinMode=request` sticky CTA отправляет `POST /events/:eventId/join-request`, pending state блокирует повторную отправку и оставляет отмену через `DELETE /events/:eventId/join-request`. Chat CTA показывается только когда backend вернул `chatId`, чтобы закрытая встреча не открывала чат до доступа.

Host and joined users can invite friends from meeting detail. Sticky action opens a local bottom sheet that calls `GET /people/following?eventId=<id>` with search debounce, cursor pagination and cancel tokens. Invite sends `POST /events/:eventId/invites` through `BackendRepository.inviteUserToEvent` and updates the row locally to avoid a full detail reload.

`CommunityActionsController.setJoined` calls `/communities/:id/join` or `DELETE /communities/:id/join`, then patches cached `communities/detail:<id>` and `communities/list?limit=20` for the current user scope before invalidating visible providers. This keeps community detail and list warm state in sync after join or leave.

`CommunityActionsController.createCommunity` sends `POST /communities` with idempotency key, then writes the created community into cached detail and prepends it to cached `communities/list?limit=20` for the current user scope. Existing list cursor is preserved.

`CommunityActionsController.createNews` sends `POST /communities/:id/news`, then writes the returned community into cached detail before invalidating `communityDetailProvider`. Warm community detail sees the new news list without waiting for another GET.

Communities list reads first page through `communitiesProvider` and loads next pages through `communitiesPaginationProvider` near the bottom of `CommunitiesScreen`. `BackendRepository.fetchCommunities` passes backend cursor to `/communities`, keeps already visible cards, tracks next page errors, and cancels active next-page requests on provider dispose.

Community detail media reads first page through `communityMediaProvider` and loads older media through `communityMediaPaginationProvider` with backend cursor. Pagination keeps already visible media, tracks next page loading and errors, and cancels active requests on provider dispose.

Wallet payment return links route to `/wallet` through `paymentReturnRouteForUri` and call `PaymentActionsController.handlePaymentReturn()`. That invalidates `tokenWalletProvider`, `paymentsCatalogProvider`, `subscriptionProvider`, and `subscriptionPlansProvider`, so wallet balance, catalog, subscription state, and plans refresh after returning from the payment browser.

`PaymentActionsController.subscribeWithTokens()` sends `POST /subscription/subscribe` and invalidates `tokenWalletProvider` and `subscriptionProvider` after success, so paying for Frendly+ with tokens refreshes the balance and active subscription state.

`GiveawaysScreen` reads Drops through `dropsHomeProvider`, which uses local-first cache namespace `drops/home` and returns an empty private state when auth is missing. The screen must not keep mock Drops lists. Backend data maps to local icon and accent only in UI.

`DropsActionsController` sends claim and apply actions through `BackendRepository`, tracks cancel tokens, then invalidates `dropsHomeProvider`. `POST /drops/:dropId/tickets/apply` sends `{ ticketCount }`; the apply sheet only opens when there are free tickets and the Drop eligibility allows participation. Non-MVP tasks are filtered out on the screen as a second guard, even though backend should not return them.

`PaywallScreen` reads wallet balance, payment catalog, and subscription plans only through `tokenWalletProvider`, `paymentsCatalogProvider`, and `subscriptionPlansProvider`. Parent rebuilds keep those providers mounted and do not duplicate backend requests.

`frendlySeasonProvider` reads `profile/frendly-season` through local-first cache for the current user scope. `FrendlySeasonActionsController.claimReward()` posts the claim and invalidates `frendlySeasonProvider` plus `tokenWalletProvider`, so streak rewards refresh season state and wallet balance after success.

`profileHistoryProvider` reads `profile/frendly-history?limit=20` through local-first cache and `memoryPeopleProvider` reads `profile/frendly-people?limit=20` through local-first cache. Both are private user-scoped streams, so history and Memory Map warm opens show cached items before background refresh.

`eventStoriesProvider(eventId)` reads `stories/event:<eventId>?limit=20` through local-first cache and fetches `/events/:eventId/stories`. `ShareScreen` uses `ShareActionsController.createShare()` for backend public share targets `event` and `evening_session`, renders the returned public URL in the preview, and keeps unsupported targets like `route_template`, `profile`, `memory_map`, and `ai_draft` local-only until backend adds support. Story creation and story media upload are not implemented in `mobile2` yet.

AI builder uses `/evening/routes/ai-drafts` for draft create, detail fetch, step accept, regenerate, and confirm. `eveningAiDraftProvider(draftId)` stores reopened draft detail in local-first cache under `evening-ai-drafts/<draftId>`. `EveningAiActionsController` tracks a `CancelToken` for each create, accept, regenerate, and confirm request, cancels active tokens on dispose, and invalidates the visible draft provider after accept, regenerate, or confirm. Dedicated AI voice is not implemented in `mobile2`; legacy `/ai-voice` redirects to `/ai-builder`.

Partner offer code REST contract is available in `BackendRepository`: `issuePartnerOfferCode()` calls `/evening/sessions/:sessionId/steps/:stepId/offers/:offerId/code`, and `fetchPartnerOfferCode()` calls `/evening/offer-codes/:codeId`. Legacy partner offer QR UI is not copied into `mobile2`; a new-design QR screen is still needed before that UI gap is closed.

Evening live session REST controls are available in `BackendRepository`: start, join, check-in, advance, skip and finish map to `/evening/sessions/:sessionId/start`, `/join`, `/steps/:stepId/check-in`, `/advance`, `/skip` and `/finish`. They accept caller `CancelToken`s. Legacy live meetup UI is not copied into `mobile2`; a new-design screen is still needed for visible controls.

Evening after-party REST contract is available in `BackendRepository`: `fetchEveningAfterParty()` reads `/evening/sessions/:sessionId/after-party`, `saveEveningAfterPartyFeedback()` posts rating, reaction and comment to `/feedback`, and `addEveningAfterPartyPhoto()` posts `assetId` to `/photos`. Legacy after-party UI is not copied into `mobile2`; a new-design screen is still needed for feedback and photo upload.

## Images and media

Не используй raw `Image.network` на hot screens.

Нужны shared widgets:

- avatar;
- profile photo;
- card image;
- hero image;
- fullscreen image;
- chat attachment image;
- external event image;
- brand image.

Каждый image widget должен знать usage profile:

- `avatar`;
- `card`;
- `hero`;
- `fullscreen`.

По usage profile задавай:

- cache key;
- memory cache width;
- memory cache height;
- disk cache width;
- disk cache height;
- placeholder;
- error state.

Не скачивай full resolution фото для аватара или карточки.

Image picker должен ограничивать фото перед upload:

- longest side около 1600 px;
- качество около 90;
- без тяжелого metadata, если оно не нужно.

Upload больших файлов должен идти через presigned upload или streaming path. Не держи тяжелые bytes в памяти без причины.

## Media prewarm

Prewarm нужен, но только маленький и ограниченный.

Текущая реализация `mobile2`:

- shared cache key и cache manager: `mobile2/lib/shared/widgets/dateasy_remote_image.dart`;
- bounded prewarm service: `mobile2/lib/app/core/device/app_media_prewarm_service.dart`;
- provider: `appMediaPrewarmServiceProvider` в `mobile2/lib/app/core/providers/core_providers.dart`;
- Home греет первые 6 meeting images и первые 8 affiche images;
- Chats греет первые 10 avatar images;
- Dating греет следующие 3 profile images от текущей карточки;
- Routes греет первые 6 route cover images;
- Meetings греет первые 6 meeting cover images;
- Posters греет первые 8 poster cover images;
- Communities греет первые 8 community cover images;
- Search results греет первые 10 result thumbnails как avatar usage.

`DateasyRemoteImage.cacheKeyFor` убирает временные query подписи из signed media URL. Одна и та же картинка не должна скачиваться заново только из-за `X-Amz-Signature`, `X-Amz-Expires`, `token` или похожих volatile params. Если все query params были временными, cache key должен быть без хвоста `?`.

Failed image prewarm не должен помечать cache key как готовый. `AppMediaPrewarmService` дедупит только активные и успешно прогретые keys, чтобы временная ошибка сети не блокировала следующий retry.

Нормальные лимиты:

- Home events: первые 6 карточек;
- Affiche: первые 8 карточек;
- Meetings: первые 6 карточек;
- Communities: первые 8 карточек;
- Search results: первые 10 thumbnails;
- Routes: первые 6 карточек;
- Dating: следующие 3 profile фото;
- Chats: первые 10 avatars;
- concurrency 2 или 3.

Нельзя делать:

- prewarm всего списка;
- global warmup на старте приложения;
- prefetch без limit;
- prefetch media, который пользователь может никогда не увидеть.

## Chat and realtime

Чат должен открываться быстро.

Правильный flow:

1. Прочитать recent messages из local store.
2. Показать их сразу.
3. Запросить REST history.
4. Сохранить fresh history в local store.
5. Подключить websocket.
6. Дождаться `session.authenticated`.
7. Subscribe только на нужный chat id или scope.
8. Запросить sync с последнего cursor.
9. Realtime события мержить в local state.

Warm chat thread читает bounded recent window из `ChatLocalStore`, сейчас 60 последних сообщений. Не читай весь локальный history на открытии чата.

`ChatRealtimeSession` в `mobile2/lib/app/core/network/chat_socket_client.dart` не должен отправлять `chat.subscribe`, `sync.request` или outbox до `session.authenticated`.

`ChatRealtimeSession` может держать несколько chat ids в одном сеансе. Это используется для видимого списка чатов, чтобы не открывать socket на каждый row.

`chatListProvider` в `mobile2/lib/shared/data/app_providers.dart` читает chat summaries как stream из `ChatLocalStore`, а REST refresh пишет свежие rows в фоне. Поэтому `message.created`, `message.updated` и `unread.updated` сразу меняют preview и unread на экране списка.

`message.created` и `message.updated` пишут сообщение в `ChatLocalStore` и patch cached chat summary. `unread.updated` patch cached summary counters, чтобы chat list и badges не ждали REST refresh.

Send message:

- сначала optimistic local message;
- потом websocket command;
- server ack заменяет pending message;
- при ошибке rollback или failed state;
- clientMessageId обязателен.

Outbox:

- pending commands переживают reconnect;
- команды должны иметь dedupe key;
- после reconnect сначала восстановить outbox, потом отправлять новые команды.

Attachments:

- сначала local file path;
- потом cached file;
- потом signed URL;
- signed URL cache короткий;
- одинаковые signed URL requests надо coalesce;
- image attachments надо warm только для недавних ready сообщений;
- prewarm image attachments должен сначала получить signed URL, потом скачать файл в тот же cache key, который использует `DateasyRemoteImage`;
- не отправляй voice attachments в image cache prewarm.

## Map

Map в `mobile2` при backend подключении должен быть native map, а fake backdrop только fallback.

Правила:

- YandexMap открывается только на map screen;
- MapKit init не должен тормозить общий app start;
- map events грузятся по rounded viewport bounds;
- tiny camera jitter не должен создавать новый запрос;
- viewport query должен иметь debounce;
- stale viewport request отменяется;
- map objects кешируются через `DateasyMapObjectCache` и пересобираются только при изменении pins key;
- pins используют asset icons;
- при большом числе точек включается clustering;
- cluster tap zooms to cluster center;
- selected marker меняет state без полной пересборки списка;
- map не должен грузить dating profiles, если экран показывает meetings.

Не рисуй Flutter overlay pins поверх native map на iOS и Android.

## Auth and startup

Startup должен быть легким.

На старте можно:

- поднять Flutter binding;
- включить edge-to-edge UI;
- прочитать SharedPreferences;
- восстановить auth tokens из secure storage;
- создать root providers;
- запустить listener для deep links, если он нужен.

На старте нельзя:

- грузить все home данные заранее;
- стартовать chat websocket;
- стартовать map plugins;
- грузить settings без видимой причины;
- прогревать все картинки;
- дергать private endpoints без токена.

Router должен учитывать:

- guest routes;
- authenticated routes;
- onboarding incomplete state;
- payment return;
- legacy links, если они нужны;
- logout;
- смену пользователя.

Token payment flow:

- `WalletScreen` opens backend `paymentUrl` with `LaunchMode.inAppBrowserView`, not `externalApplication`;
- iOS and Android register both `dateasy` and `frendly` URL schemes, because backend T-Bank return URLs default to `frendly://payment/...`;
- `DateasyApp` listens through `app_links`, maps payment return links to `/wallet?paymentResult=...`, closes the in-app browser and invalidates wallet, payment catalog and subscription providers.

## Backend contract expectations

Mobile не должен лечить плохой contract сложной логикой на экране.

Если endpoint возвращает список, ему нужны:

- `items`;
- `nextCursor` или понятная paging схема;
- `limit`;
- stable ids;
- timestamps;
- minimal fields for list card;
- detail endpoint для тяжелых полей.

Если endpoint возвращает media:

- нужен stable media id;
- варианты размеров, если backend их умеет;
- protected media идет через signed URL;
- signed URL имеет expiresAt;
- list response не должен тащить heavy media bytes.

Если endpoint зависит от города или координат:

- query должен быть явным;
- пустые координаты не должны значить Москва по умолчанию, если продукт так не решил;
- mobile cache key должен повторять эту логику.

## Error states

Ошибки не должны ломать весь экран.

Правила:

- empty initial state и refresh error разные состояния;
- offline with cache показывает cached data plus компактный warning;
- 401 refresh failure чистит session;
- validation error показывает понятный текст;
- network timeout не очищает текущий список;
- upload error чистит busy state;
- late async result не пишет state после dispose.

После любого `await` в UI action проверь `mounted` или `context.mounted`.

## Rebuild scope

Не пересобирай весь экран ради локального изменения.

Примеры:

- unread badge читает только count;
- wallet chip читает только balance;
- selected tab это локальный state или маленький provider;
- message composer не пересобирает thread list;
- progress voice playback не пересобирает весь chat screen;
- map selected pin не пересобирает весь app shell.

Используй:

- маленькие widgets;
- `const`;
- `select`;
- dedicated provider family;
- `autoDispose`;
- controller scoped by id.

## Feature connection order

Подключай backend не хаотично.

Лучший порядок:

1. Core config, API URL, WebSocket URL.
2. Auth tokens, secure storage, refresh flow.
3. ApiClient with dedupe and cancel support.
4. BackendRepository with typed mapping.
5. Local-first cache foundation.
6. Shared media widgets and attachment service.
7. Home and meetings first page.
8. Meeting detail.
9. Chat summaries.
10. Chat thread plus websocket.
11. Profile and public profile.
12. Dating discover and actions.
13. Notifications and unread badges.
14. Map native data path.
15. Affiche, routes, wallet, paywall.

После каждого шага запускай analyze. Для рискованных частей добавляй focused tests.

## What not to do

Не делай это:

- прямые backend calls из widgets;
- один большой global provider для всего приложения;
- общий loading state на весь экран при каждом refresh;
- full list image preload;
- raw `Image.network`;
- unbounded pagination;
- запрос в `itemBuilder`;
- websocket на app startup;
- map plugin на app startup;
- хранение token в plain SharedPreferences;
- смешивание cache разных users;
- hardcoded balance, unread count, city или profile после подключения backend;
- silent catch без понятного fallback;
- mock fallback там, где backend вернул пусто;
- перерисовку всего экрана на каждую букву в composer.

## Definition of done

Backend подключение считается нормальным только если:

- warm open работает быстрее холодного;
- повторное открытие экрана не делает лишний полный loading;
- одинаковые GET запросы dedupe;
- stale запросы отменяются;
- auth refresh работает один раз и повторяет исходный запрос;
- logout чистит private cache;
- media decode bounded;
- длинные списки lazy;
- chat открывается с local snapshot;
- websocket подключается scoped;
- map viewport не спамит backend;
- `flutter analyze` чистый;
- есть хотя бы focused tests для core data behavior.

## Стартовый промт для новой сессии

Скопируй в новую сессию:

```text
Ты подключаешь готовый backend к Flutter приложению mobile2.

Сначала прочитай project_map.md, ai-context/index.md, ai-context/mobile2-backend-performance.md и ai-context/frontend-flutter.md.

Главная цель: подключить backend без потери скорости. Не делай прямые запросы из экранов. Сначала подними core data foundation: auth tokens, ApiClient, repository, local-first cache, shared media widgets, cancel tokens, realtime rules.

Для каждой фичи держи flow local first, потом cache, потом сеть. Не делай global warmup, unbounded prefetch, raw Image.network, websocket на старте приложения, full screen loading при refresh, запросы из itemBuilder.

После изменений запускай flutter analyze в mobile2. Если менял файлы, перед финальным ответом запускай bash scripts/update-understand-graph.sh из корня проекта.
```
