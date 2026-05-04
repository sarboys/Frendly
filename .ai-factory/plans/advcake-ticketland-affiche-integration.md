# План: AdvCake Ticketland, бесплатная афиша и места KudaGo

> Для реализации по задачам используй чекбоксы ниже. Ничего не считать готовым, пока рядом с пунктом нет `[x]`.

**Статус:** backend, worker, admin и mobile реализация выполнена; без реального `ADVCAKE_API_PASS` остались production secret setup и manual smoke.
**Дата:** 2026-05-04.  
**Города MVP:** Москва, Санкт-Петербург.  
**Основное решение:** бесплатные события берем из KudaGo и Timepad, места вроде баров, ресторанов и кофеен оставляем из KudaGo отдельным потоком, платные билетные события берем из AdvCake `ticketland.ru | live.mts.ru`, покупку открываем по реф-ссылке партнера.  
**Важно:** в коде есть адаптер `Timepad`, адаптера `Timeweb` не найдено. Если под Timeweb имелся в виду другой источник, его надо отдельно подтвердить.

## Что уже проверено

- [x] AdvCake `pass` является API key.
  Комментарий: ключ нельзя хранить в репозитории или печатать в логах. Нужен только env `ADVCAKE_API_PASS`.

- [x] Найден оффер AdvCake.
  Комментарий: `ticketland.ru | live.mts.ru`, `offer_id=663`, `alias=ticketlandru`, тип `CPA`, action type `ecommerce`, ставка 3.64%.

- [x] У оффера есть подготовленные фиды.
  Комментарий: `common-feeds` вернул `yml`, `csv`, `gsf`, по 12113 событий. Для импорта нужен `yml`, потому что там есть `region`.

- [x] Проверены поля AdvCake YML.
  Комментарий: есть `id`, `url`, `picture`, `price`, `currencyId`, `model`, `vendor`, `categoryId`, `typePrefix`, `region`, `date`, `description`, `age`.

- [x] Проверено покрытие полей в фиде.
  Комментарий: дата, время, город, площадка, цена, картинка есть у всех 12113 событий. Описание есть почти у всех. Адреса и координат отдельными полями нет.

- [x] Проверен объем на текущую неделю.
  Комментарий: с 2026-05-04 по 2026-05-10 найдено 1202 события по Москве и Санкт-Петербургу: Москва 664, Санкт-Петербург 538.

- [x] Проверена схема покупки.
  Комментарий: через AdvCake делаем реф-переход на Ticketland или MTS Live. Оплату в приложении не делаем. Для native checkout нужен отдельный Ticketland External API, `identity-id`, `salt`, свой эквайринг, возвраты и поддержка.

- [x] Проверен текущий код проекта.
  Комментарий: уже есть `ExternalContentSource`, `ExternalImportRun`, `ExternalContentItem`, worker import, admin route review, mobile posters, search, Tonight, route planner.

## Цель

Сделать единый поток контента:

```text
KudaGo events / Timepad events
  -> бесплатные события
  -> публичная бесплатная афиша
  -> маршруты free

KudaGo places
  -> бары, рестораны, кофейни, музеи, прогулочные места
  -> не афиша и не мероприятие
  -> поиск мест, подборки мест, route planner как place candidates

AdvCake Ticketland
  -> платные билетные события
  -> публичная платная афиша
  -> маршруты low и mid, только если есть адрес или координаты после enrichment
  -> покупка по affiliate url

Overpass
  -> выключить из регулярного импорта
  -> позже удалить, если KudaGo хватает по местам
```

## Правила продукта

- [x] Бесплатный контент показываем только если цена точно `0`.
  Комментарий: добавлен `priceMode` в normalizer и public policy. `null` становится `unknown`, в бесплатную афишу не попадает. Файлы: `content-normalizer.service.ts`, `content-import.service.ts`, `affiche.service.ts`, тесты worker/API/mobile.

- [x] Платный публичный контент по умолчанию берем только из AdvCake.
  Комментарий: KudaGo/Timepad paid скрываются, если не включен `CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID=true`. AdvCake paid публикуется при наличии affiliate action. Файлы: `content-import.service.ts`, `affiche.service.ts`.

- [x] Места из KudaGo не прогоняем через правила афиши.
  Комментарий: `/affiche/events` фильтрует только `contentKind=event`. Places остаются published для places/search/route planner и не фильтруются как бесплатные события. Файлы: `content-import.service.ts`, `affiche.service.ts`, `route-draft-generation.service.ts`.

- [x] Для мест из KudaGo не показываем билетную механику.
  Комментарий: билетный CTA добавлен только в `AfficheEvent` detail для `contentKind=event`. Places не возвращаются из affiche API и не рендерятся билетной карточкой. Файлы: `affiche.service.ts`, `affiche_event_detail_screen.dart`.

- [x] AdvCake событие открывает внешний checkout.
  Комментарий: `actionUrl` хранится как affiliate action и открывается через `url_launcher` с `LaunchMode.externalApplication`. Файлы: `advcake-ticketland.adapter.ts`, `affiche_event_detail_screen.dart`.

- [x] События без адреса можно показывать в списке.
  Комментарий: `address`, `lat`, `lng` в DTO и mobile model optional. Список и detail не ломаются без адреса. Файлы: `affiche.service.ts`, `affiche_event.dart`, тесты mobile.

- [x] События без координат не участвуют в route planner.
  Комментарий: selection route generation оставлен с `lat/lng not null`, теперь еще требует `publicStatus=published` и event `priceMode in free/paid`. Файлы: `route-draft-generation.service.ts`, `route-planner.ts`.

- [x] Overpass убрать из default источников.
  Комментарий: default scheduled sources теперь `kudago,timepad,advcake_ticketland`. В admin default checkbox Overpass снят, код адаптера не удален. Файлы: `worker.service.ts`, `RouteReviewQueue.tsx`, compose/env examples.

- [x] Импорт запускается раз в 4 часа.
  Комментарий: default worker interval изменен на `4 * 60 * 60 * 1000`, env examples и compose используют `14400000`. Файлы: `worker.service.ts`, `compose.yaml`, `compose.prod.yml`, env examples.

## Целевая схема

```text
worker, every 4h
  -> KudaGoAdapter
  -> TimepadAdapter
  -> AdvCakeTicketlandAdapter
  -> normalize
  -> dedupe and enrich
  -> ExternalContentItem
  -> public affiche API
  -> mobile Tonight, Search, Affiche
  -> admin content review

admin
  -> sources
  -> import runs
  -> imported items
  -> moderation
  -> source health

mobile
  -> free events
  -> KudaGo places
  -> paid tickets
  -> route plans
  -> external buy button
```

## Phase 1: Source model and contracts

- [x] Task 1.1: Добавить source code `advcake_ticketland`.
  Комментарий: source code добавлен в worker types, registry, admin source validation и UI defaults. Overpass снят с default. Файлы: `content-source.types.ts`, `external-source.registry.ts`, `admin-route-review.service.ts`, `RouteReviewQueue.tsx`, тесты.

- [x] Task 1.2: Добавить source metadata.
  Комментарий: metadata и безопасный config без API key добавлены в registry/import/admin upsert. Файлы: `external-source.registry.ts`, `content-import.service.ts`, `admin-route-review.service.ts`.

- [x] Task 1.3: Расширить нормализованный item под публичную афишу.
  Комментарий: добавлены поля `venueName`, `imageUrl`, `actionUrl`, `actionKind`, `priceMode`, `isAffiliate`, `sourceProvider`, `placeKind`, `lastSeenAt`, `publicStatus`. Файлы: `content-source.types.ts`, `content-normalizer.service.ts`, Prisma schema.
  `venueName`, `imageUrl`, `actionUrl`, `actionKind`, `priceMode`, `isAffiliate`, `sourceProvider`, `placeKind`, `lastSeenAt`.

- [x] Task 1.4: Добавить Prisma migration.
  Комментарий: добавлена migration с nullable/default полями, backfill `priceMode` и `lastSeenAt`. Файлы: `schema.prisma`, `20260504153000_affiche_external_content_fields/migration.sql`.

- [x] Task 1.5: Обновить `@big-break/contracts`.
  Комментарий: расширены admin DTO и добавлены `AfficheEventDto`, `AfficheEventListDto`. Файл: `backend/packages/contracts/src/index.ts`.

- [x] Task 1.6: Обновить индексы.
  Комментарий: добавлены индексы для admin/public выборок: city/startsAt/priceMode/contentKind/moderation/source, publicStatus/city/startsAt/id, source/price/importedAt. Файлы: Prisma schema и migration.

- [x] Task 1.7: Развести контракты `event` и `place`.
  Комментарий: public affiche endpoints отдают только `contentKind=event`. Places остаются в import pool и route planner. Файлы: `affiche.service.ts`, `content-import.service.ts`.

## Phase 2: AdvCake Ticketland adapter

- [x] Task 2.1: Создать `backend/apps/worker/src/content/advcake-ticketland.adapter.ts`.
  Комментарий: создан adapter `AdvCakeTicketlandAdapter`, реализует `ExternalSourceAdapter`. Файл: `advcake-ticketland.adapter.ts`.

- [x] Task 2.2: Добавить env.
  Комментарий: env добавлены в adapter, compose и examples. Оффер `663` покрывает `ticketland.ru | live.mts.ru`; для ясности добавлен `ADVCAKE_TICKETLAND_WEBSITES=ticketland.ru,live.mts.ru`. Реального pass нет в коде или тестах. Файлы: `advcake-ticketland.adapter.ts`, `compose.yaml`, `compose.prod.yml`, env examples.

- [x] Task 2.3: Получать feed URL через API, а не хардкодить.
  Комментарий: adapter вызывает `common-feeds`, выбирает `format=yml`, потом скачивает feed URL. Покрыто unit test. Файл: `advcake-ticketland.adapter.ts`.

- [x] Task 2.4: Маскировать секреты.
  Комментарий: добавлен masking для `pass`, env secret и приватных AdvCake/feed URL в import errors/logs. Покрыто unit test. Файлы: `advcake-ticketland.adapter.ts`, `content-import.service.ts`.

- [x] Task 2.5: Парсить YML.
  Комментарий: добавлен прямой dependency `fast-xml-parser`, XML parsing и byte guard `ADVCAKE_FEED_MAX_BYTES`. Покрыто YML fixture test. Файлы: `apps/worker/package.json`, lockfile, `advcake-ticketland.adapter.ts`.

- [x] Task 2.6: Маппинг полей AdvCake.
  Комментарий: поля AdvCake маппятся в raw/normalized item, включая venue/image/action/affiliate/price. Покрыто unit test.
  `offer.id -> sourceItemId`, `model -> title`, `description -> shortSummary/rawDescription`, `typePrefix -> category`, `region -> city`, `vendor -> venueName`, `date -> startsAt`, `price -> priceFrom`, `currencyId -> currency`, `picture -> imageUrl`, `url -> actionUrl/affiliateUrl`, `age -> tags`.

- [x] Task 2.7: Фильтровать города и даты локально.
  Комментарий: adapter оставляет только Москву/СПб и окно `from/to`. Покрыто unit test. Файл: `advcake-ticketland.adapter.ts`.

- [x] Task 2.8: Фильтровать платность.
  Комментарий: AdvCake получает `priceMode`, public policy публикует paid AdvCake с actionUrl, unknown не публикуется. Файлы: `advcake-ticketland.adapter.ts`, `content-import.service.ts`.

- [x] Task 2.9: Категории Ticketland привести к нашей таксономии.
  Комментарий: добавлен mapping в adapter и normalizer fallback для русских категорий. Файлы: `advcake-ticketland.adapter.ts`, `content-normalizer.service.ts`.

- [x] Task 2.10: Добавить unit tests на adapter.
  Комментарий: покрыты feed URL, YML offer, HTML cleanup, city/date filtering, price, affiliate url, image, category mapping. Файл: `content-adapters.spec.ts`.

## Phase 3: Free, paid and unknown policy

- [x] Task 3.1: Добавить price policy в normalizer.
  Комментарий: `priceMode` считается в normalizer: exact `0` free, `>0` paid, `null` unknown. Файлы: `content-normalizer.service.ts`, tests.

- [x] Task 3.2: KudaGo events public policy.
  Комментарий: free KudaGo events публикуются, paid/unknown скрываются по default и остаются в admin pool. Файл: `content-import.service.ts`.

- [x] Task 3.2.1: KudaGo places public policy.
  Комментарий: `contentKind=place` публикуется отдельно от афиши и участвует в route candidates при наличии координат. Файлы: `content-import.service.ts`, `route-draft-generation.service.ts`.

- [x] Task 3.3: Timepad public policy.
  Комментарий: free Timepad публикуется, paid скрывается без `CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID=true`. Файл: `content-import.service.ts`.

- [x] Task 3.4: AdvCake public policy.
  Комментарий: paid AdvCake event публикуется при наличии `actionUrl`, покупка идет через `actionUrl`. Файлы: `content-import.service.ts`, `affiche.service.ts`.

- [x] Task 3.5: Unknown price policy.
  Комментарий: `unknown` получает `publicStatus=hidden`, но виден в admin content table. Файлы: `content-import.service.ts`, `admin-route-review.service.ts`, admin UI.

- [x] Task 3.6: Overpass policy.
  Комментарий: Overpass убран из default scheduled/admin sources, но остался валидным source для явного ручного запуска. Файлы: `worker.service.ts`, `RouteReviewQueue.tsx`, env/compose.

## Phase 4: Deduplication and enrichment

- [x] Task 4.1: Описать duplicate key для событий.
  Комментарий: duplicate key строится по городу, `contentKind`, нормализованному title, UTC day и venue. Разные даты не склеиваются. Файлы: `content-deduplication.service.ts`, `content-deduplication.service.spec.ts`.

- [x] Task 4.2: Склеивать AdvCake с KudaGo/Timepad.
  Комментарий: AdvCake карточка сохраняет цену и affiliate url, координаты и адрес добираются из KudaGo/Timepad дубля. Второй source item скрывается. Файл: `content-import.service.ts`.

- [x] Task 4.3: Добавить confidence для склейки.
  Комментарий: `high`, `medium`, `low` возвращаются из `eventDuplicateMatch`; `low` не используется для merge/enrichment. Файлы: `content-deduplication.service.ts`, tests.

- [x] Task 4.4: Сохранять enrichment в raw или отдельные поля.
  Комментарий: `raw.enrichment` хранит source, sourceItemId, duplicateKey, confidence, role и copied fields. Админка показывает compact raw summary. Файлы: `content-import.service.ts`, `admin-route-review.service.ts`, `RouteReviewQueue.tsx`.

- [x] Task 4.5: Route planner берет только items с координатами.
  Комментарий: route generation выбирает только `lat/lng not null`, AdvCake без координат остается только в афише. Файл: `route-draft-generation.service.ts`.

- [x] Task 4.6: Добавить тесты на dedupe.
  Комментарий: покрыты key/confidence, разные даты, AdvCake+KudaGo enrichment в обе стороны и скрытие source дубля. Файлы: `content-deduplication.service.spec.ts`, `content-import.service.spec.ts`.

- [x] Task 4.7: Не склеивать события с местами.
  Комментарий: существующий dedupe сохраняет разделение по `contentKind`; добавлены новые поля в fixture, тесты проходят. Файлы: `content-deduplication.service.ts`, `content-deduplication.service.spec.ts`.

## Phase 5: Worker schedule and import runs

- [x] Task 5.1: Поменять default import interval на 4 часа.
  Комментарий: default изменен на `4 * 60 * 60 * 1000`. Файл: `worker.service.ts`.

- [x] Task 5.2: Обновить production env.
  Комментарий: production compose и env example обновлены placeholders, реальный `ADVCAKE_API_PASS` не добавлялся. Файлы: `compose.prod.yml`, `.env.production.example`.

- [x] Task 5.3: Окно импорта.
  Комментарий: scheduled import уже использует 14 дней вперед, API поддерживает date/dateFrom/dateTo. Файлы: `worker.service.ts`, `affiche.service.ts`.

- [x] Task 5.4: Добавить stale cleanup.
  Комментарий: после import run items с `lastSeenAt` старше 24 часов помечаются `publicStatus=stale`, удаление не делается. Файл: `content-import.service.ts`.

- [x] Task 5.5: Защитить worker от дублей запусков.
  Комментарий: проверено, `contentImportRunning` сохраняет защиту scheduled import. Worker unit tests проходят. Файл: `worker.service.ts`.

- [x] Task 5.6: Добавить метрики в import run.
  Комментарий: добавлены поля и счетчики import run, выведены в admin. Файлы: Prisma schema/migration, `content-import.service.ts`, admin DTO/UI.

- [x] Task 5.7: Добавить понятные логи.
  Комментарий: добавлены INFO start/complete, WARN empty feed, ERROR failed source с masking. Файл: `content-import.service.ts`.

## Phase 6: Public backend API

- [x] Task 6.1: Добавить публичный endpoint для афиши.
  Комментарий: добавлены public `GET /affiche/events` и controller/service. Файлы: `affiche.controller.ts`, `affiche.service.ts`, `app.module.ts`.

- [x] Task 6.2: Query params.
  Комментарий: поддержаны `city`, `date`, `dateFrom`, `dateTo`, `priceMode`, `source`, `category`, `q`, `cursor`, `limit`, `featured`; `featured=true` требует `imageUrl`. Файл: `affiche.service.ts`, тесты API/mobile.

- [x] Task 6.3: Cursor pagination.
  Комментарий: реализован cursor по `startsAt asc, id asc` через shared cursor helpers. Файл: `affiche.service.ts`.

- [x] Task 6.4: DTO.
  Комментарий: DTO возвращает перечисленные поля, optional address/coords поддержаны. Файлы: `contracts/src/index.ts`, `affiche.service.ts`.

- [x] Task 6.5: Detail endpoint.
  Комментарий: добавлен `GET /affiche/events/:eventId`, карточка mobile открывает detail с описанием и CTA. Файлы: `affiche.controller.ts`, `affiche.service.ts`, mobile detail.

- [x] Task 6.6: Search integration.
  Комментарий: `GET /search` теперь возвращает блок `affiche`, contracts и Flutter `GroupedSearchResults` обновлены. Файлы: `search.service.ts`, contracts, `backend_repository.dart`.

- [x] Task 6.7: Price filters.
  Комментарий: `free`, `paid`, `any` реализованы в public API и search integration. Публичный список не отдает `unknown`. Файлы: `affiche.service.ts`, `search.service.ts`.

- [x] Task 6.8: Unit tests API.
  Комментарий: добавлены unit tests для filters, hidden/stale, nullable address, affiliate action, detail и search. Файлы: `affiche.service.unit.spec.ts`, `admin-route-review.service.unit.spec.ts`.

- [x] Task 6.9: Не смешивать places API и affiche API.
  Комментарий: `GET /affiche/events` и detail фильтруют `contentKind=event`. Places остаются в places/search/route flow. Файл: `affiche.service.ts`.

## Phase 7: Admin UI

- [x] Task 7.1: Расширить source list.
  Комментарий: в админке есть `kudago`, `timepad`, `advcake_ticketland`, `overpass` снят с default выбора. Файлы: `RouteReviewQueue.tsx`, `admin-route-review.service.ts`.

- [x] Task 7.2: Сделать страницу импорта более явной.
  Комментарий: добавлены табы `Источники`, `Импорты`, `Контент`, `Маршруты`. Файл: `RouteReviewQueue.tsx`.

- [x] Task 7.3: Source health cards.
  Комментарий: source cards показывают статус, last import, ошибку, total/imported/published counts и last run. Файлы: `admin-route-review.service.ts`, `RouteReviewQueue.tsx`.

- [x] Task 7.4: Import control.
  Комментарий: ручной запуск выбирает город, даты и источники, AdvCake доступен, API создает `pending_manual`. Файлы: `RouteReviewQueue.tsx`, `routeReviewApi.test.ts`.

- [x] Task 7.5: Content table.
  Комментарий: таблица контента показывает source, kind, title, category, city, venue/address, priceMode/price, hasCoords, actionKind/actionUrl, publicStatus, importedAt. Файл: `RouteReviewQueue.tsx`.

- [x] Task 7.6: Content filters.
  Комментарий: добавлены API и UI filters для city, source, contentKind, priceMode, category, publicStatus, hasCoords, dateFrom/dateTo. Файлы: `admin-route-review.service.ts`, `RouteReviewQueue.tsx`.

- [x] Task 7.7: Item detail drawer.
  Комментарий: добавлен detail panel для content item: title, summary, image, source/action URL, address, coords, route visibility и raw summary. Файлы: `RouteReviewQueue.tsx`, `routeReviewTypes.ts`.

- [x] Task 7.8: Moderation actions.
  Комментарий: API и UI поддерживают `publish`, `hide`, `reject`, `stale`, `force-free`, `force-paid`. Refresh item не добавлялся, для MVP действия закрыты. Файлы: `admin-evening.controller.ts`, `admin-route-review.service.ts`, `routeReviewApi.ts`, `RouteReviewQueue.tsx`.

- [x] Task 7.9: Route planner visibility.
  Комментарий: admin DTO/UI показывают `hasCoords` и `routePlannerBlockedReason`: missing coords, hidden/stale, rejected, unknown price. Файлы: `admin-route-review.service.ts`, `RouteReviewQueue.tsx`.

- [x] Task 7.10: Admin tests.
  Комментарий: обновлены `RouteReviewQueue.test.tsx`, `routeReviewApi.test.ts`; `npm test -- RouteReviewQueue.test.tsx routeReviewApi.test.ts` прошел.

## Phase 8: Mobile app

- [x] Task 8.1: Добавить модель `AfficheEvent`.
  Комментарий: добавлена отдельная модель `AfficheEvent`, `address`, `lat`, `lng`, `imageUrl` optional. Файл: `affiche_event.dart`.

- [x] Task 8.2: Добавить repository methods.
  Комментарий: добавлены `fetchAfficheEvents`, `fetchAfficheEventDetail`, `searchGrouped.affiche`. Файл: `backend_repository.dart`.

- [x] Task 8.3: Добавить providers.
  Комментарий: добавлены providers с query object по city, date/dateFrom/dateTo, priceMode, source, category. Файл: `app_providers.dart`.

- [x] Task 8.4: Tonight screen.
  Комментарий: Tonight показывает rail `Билеты на эту неделю`, city берется из manual location fallback. Файл: `tonight_screen.dart`.

- [x] Task 8.5: Posters или отдельный Affiche screen.
  Комментарий: добавлен `features/affiche` с карточкой и detail, rail подключен в Tonight/Search без ломки Poster. Файлы: `features/affiche/*`, Tonight/Search.

- [x] Task 8.6: Search screen.
  Комментарий: Search показывает блок `Билеты и события` из `GroupedSearchResults.affiche`. Файл: `search_screen.dart`.

- [x] Task 8.7: Detail screen.
  Комментарий: detail показывает дату, время, город, venue, optional address, description, image, price и provider, пустой адрес не рисуется. Файл: `affiche_event_detail_screen.dart`.

- [x] Task 8.8: External buy button.
  Комментарий: CTA открывает HTTPS `actionUrl` через `url_launcher` с `LaunchMode.externalApplication`. Файл: `affiche_event_detail_screen.dart`.

- [x] Task 8.9: Free event CTA.
  Комментарий: free event получает CTA `Подробнее`, paid affiliate event получает `Купить билет`. Файлы: `affiche_event.dart`, `affiche_event_detail_screen.dart`.

- [x] Task 8.10: Create meetup from affiche.
  Комментарий: detail афиши ведет на `/create?afficheEventId=...`; Create Meetup грузит affiche event, префиллит форму и отправляет `afficheEventId`. Файлы: `app_router.dart`, `affiche_event_detail_screen.dart`, `create_meetup_screen.dart`, `backend_repository.dart`, tests.

- [x] Task 8.11: Mobile tests.
  Комментарий: добавлены tests на model parsing, repository list/detail, search block и empty address path. Файлы: mobile tests.

- [x] Task 8.12: Оставить KudaGo места в приложении.
  Комментарий: mobile affiche читает только public affiche events. Places остаются в прежних flows и не смешаны с event карточками. Файлы: `backend_repository.dart`, `search_screen.dart`, `tonight_screen.dart`.

## Phase 9: Route planner and Evening routes

- [x] Task 9.1: Candidate selection.
  Комментарий: route planner учитывает `priceMode`: free budget берет free, unknown не проходит как free, paid может пройти при бюджете и координатах. Файл: `route-planner.ts`.

- [x] Task 9.2: AdvCake без координат исключить из route generation.
  Комментарий: candidate query требует `lat/lng not null`, AdvCake без координат остается только в афише. Файл: `route-draft-generation.service.ts`.

- [x] Task 9.3: Добавить ticket URL в route step.
  Комментарий: route step DTOs и contracts получили `ticketUrl`, `ticketSourceCode`, `ticketProvider`. Файлы: `contracts/src/index.ts`, `evening.service.ts`, `evening-route-template.service.ts`, mobile models.

- [x] Task 9.4: Prisma migration для route step ticket URL.
  Комментарий: добавлена migration `20260504183000_evening_route_step_ticket_url`, schema обновлена, Prisma generate прошел.

- [x] Task 9.5: Admin convert сохраняет ticket URL.
  Комментарий: `convertDraft` переносит `externalContentItem.actionUrl ?? sourceUrl`, source code и provider в route revision step. Покрыто API unit test. Файл: `admin-route-review.service.ts`.

- [x] Task 9.6: Mobile EveningPlan открывает билетную ссылку.
  Комментарий: EveningPlan открывает HTTPS `ticketUrl` через `url_launcher` external mode и затем отмечает билет купленным. Без URL остается старое поведение. Файл: `evening_plan_screen.dart`.

- [x] Task 9.7: Route planner tests.
  Комментарий: проверены route planner budget/coords, route draft actionUrl, admin convert ticket URL и Evening DTO/mobile parsing. Файлы: worker/API/mobile tests.

## Phase 10: Data quality and safety

- [x] Task 10.1: HTML cleanup.
  Комментарий: adapter чистит HTML tags/entities и ограничивает длинное описание. Файл: `advcake-ticketland.adapter.ts`.

- [x] Task 10.2: Image policy.
  Комментарий: external image URL сохраняется как `imageUrl`, скачивания в S3 не добавлялось. Файлы: adapter, normalizer, API/mobile DTO.

- [x] Task 10.3: Affiliate URL policy.
  Комментарий: AdvCake feed URL разрешен только `https://feeds.advcake.ru`; actionUrl только HTTPS allowlist `go.avred.online`, `ticketland.ru`, `live.mts.ru`. Покрыто unit test. Файл: `advcake-ticketland.adapter.ts`.

- [x] Task 10.4: Secret policy.
  Комментарий: реальный pass не добавлен, adapter читает только `ADVCAKE_API_PASS`, errors/logs маскируются. Файлы: adapter, import service, env examples.

- [x] Task 10.5: Timezone policy.
  Комментарий: Ticketland даты парсятся как Moscow local time, API возвращает ISO, date/time labels строятся для mobile. Файлы: adapter, `affiche.service.ts`, `affiche_event.dart`.

- [x] Task 10.6: Stale policy.
  Комментарий: исчезнувшие items помечаются `publicStatus=stale` после grace period, raw не удаляется. Файл: `content-import.service.ts`.

- [x] Task 10.7: Rate and size guard.
  Комментарий: добавлены request timeout, max bytes guard и graceful import failure с masked error. Файл: `advcake-ticketland.adapter.ts`.

## Phase 11: Configuration and deploy

- [x] Task 11.1: Обновить env docs.
  Комментарий: env examples обновлены для AdvCake Ticketland/MTS Live и 4h scheduled import. Файлы: `.env.production.example`, `backend/.env.example`.

- [x] Task 11.2: Обновить compose examples.
  Комментарий: compose placeholders добавлены, реальные значения не записаны. Файлы: `compose.yaml`, `compose.prod.yml`.

- [ ] Task 11.3: Обновить production secret setup.
  Комментарий: добавить секрет через текущий deploy flow, без записи в git.

- [x] Task 11.4: Проверить worker health.
  Комментарий: worker unit tests и build прошли; import failure одного источника сохраняется в run и не валит API path. Реальный production smoke остается в Task 12.6.

- [x] Task 11.5: Rollout plan.
  Комментарий: rollout: завести production secret `ADVCAKE_API_PASS`, manual import Москва/СПб на 7 дней, проверить admin items, включить scheduled 4h, затем открыть public API/mobile UI.

## Phase 12: Tests and verification

- [x] Task 12.1: Worker unit tests.
  Комментарий: запущены worker unit tests для adapter, normalizer, import, dedupe, route planner, draft generation, worker schedule. Все прошли.

- [x] Task 12.2: API unit tests.
  Комментарий: запущены API unit tests, включая public affiche list/detail, search integration, hidden/stale policy и admin filters. Все прошли.

- [x] Task 12.3: Admin tests.
  Комментарий: проверены source defaults, import form, filters, content table, detail panel и moderation API. `npm test -- RouteReviewQueue.test.tsx routeReviewApi.test.ts` прошел.

- [x] Task 12.4: Mobile tests.
  Комментарий: запущены targeted mobile tests для providers, repository, create meetup from affiche и `flutter analyze`.

- [x] Task 12.5: Build checks.
  Комментарий:
  `cd backend && pnpm --filter @big-break/worker test:unit -- content-import.service.spec.ts content-deduplication.service.spec.ts content-adapters.spec.ts route-draft-generation.service.spec.ts route-planner.spec.ts worker.service.spec.ts`,
  `cd backend && pnpm --filter @big-break/api test:unit -- admin-route-review.service.unit.spec.ts affiche.service.unit.spec.ts events.service.unit.spec.ts evening.service.unit.spec.ts evening-route-template.service.unit.spec.ts admin-evening-route.service.unit.spec.ts`,
  `cd backend && pnpm --filter @big-break/worker build`,
  `cd backend && pnpm --filter @big-break/api build`,
  `cd admin && npm test -- RouteReviewQueue.test.tsx routeReviewApi.test.ts`,
  `cd admin && npm run build`,
  `cd mobile && flutter analyze`,
  `cd mobile && flutter test test/shared/data/app_providers_test.dart test/shared/data/backend_repository_test.dart test/features/create_meetup/presentation/create_meetup_screen_test.dart`.

- [ ] Task 12.6: Manual smoke.
  Комментарий: запустить manual import AdvCake на Москву на 7 дней, увидеть paid items в админке, открыть item detail, открыть mobile paid card, нажать купить, проверить внешний переход.

## Phase 13: Documentation and context

- [x] Task 13.1: Обновить `ai-context/backend-api.md`.
  Комментарий: добавлены `/affiche/events`, `featured`, create event from `afficheEventId`, admin moderation action, ticket URL в route DTO. Файл: `ai-context/backend-api.md`.

- [x] Task 13.2: Обновить `ai-context/database.md`.
  Комментарий: описаны `Event.sourceExternalContentItemId`, route step ticket metadata, enrichment raw и public affiche fields. Файл: `ai-context/database.md`.

- [x] Task 13.3: Обновить `ai-context/infra.md`.
  Комментарий: описаны 4h schedule, default sources, AdvCake env и Overpass вне default scheduled import. Файл: `ai-context/infra.md`.

- [x] Task 13.4: Обновить `ai-context/frontend-flutter.md`.
  Комментарий: добавлены `AfficheEvent`, repository/providers, Tonight/Search rails, create meetup from affiche и EveningPlan ticket URL flow. Файл: `ai-context/frontend-flutter.md`.

- [x] Task 13.5: Обновить graph.
  Комментарий: выполнено `bash scripts/update-understand-graph.sh`, граф обновлен без warnings. Files analyzed: 578.

## Acceptance criteria

- [x] Scheduled import раз в 4 часа работает.
  Комментарий: default interval и default sources обновлены, worker unit/build прошли. Production runtime smoke остается в Task 12.6.

- [x] AdvCake импортирует Ticketland/MTS Live.
  Комментарий: adapter берет feed через API, поддерживает `ADVCAKE_TICKETLAND_WEBSITES=ticketland.ru,live.mts.ru`, маппит дату, цену, картинку, описание и affiliate url. Покрыто unit tests; реальный pass smoke не запускался.

- [x] Бесплатный каталог не содержит unknown price.
  Комментарий: `unknown` скрыт из public affiche и не проходит как free budget. Покрыто worker/API tests.

- [x] Платный каталог монетизируемый.
  Комментарий: paid public events публикуются из AdvCake только с affiliate `actionUrl/actionKind=affiliate_ticket`. Покрыто adapter/import/API/mobile tests.

- [x] Админка показывает источники, импорты и items.
  Комментарий: source cards, import runs, content table, filters, detail panel, raw summary, route visibility и moderation actions реализованы. Admin tests/build прошли.

- [x] Приложение показывает афишу.
  Комментарий: Tonight/Search/detail используют `AfficheEvent` и separate affiche providers. Mobile tests/analyze прошли.

- [x] Buy button открывает внешний сайт.
  Комментарий: paid affiche и route ticket buttons открывают HTTPS URL через `url_launcher` external mode; in-app payment не добавлялся.

- [x] Route planner не ломается.
  Комментарий: candidate query требует координаты, public event priceMode free/paid, ticket URL сохраняется при convert. Worker/API/mobile tests прошли.

- [x] KudaGo места остаются в продукте.
  Комментарий: `contentKind=place` остается отдельным потоком для route/search/places и не попадает в `/affiche/events`.

## Риски

- [x] Нет адреса и координат у AdvCake.
  Комментарий: AdvCake без coords остается в афише, но не попадает в route planner; enrichment добирает coords/address из KudaGo/Timepad дубля.

- [x] Дубли между источниками.
  Комментарий: добавлены duplicate key/confidence и merge AdvCake с KudaGo/Timepad; source дубль скрывается.

- [x] Платные события из KudaGo/Timepad могут создать невыгодный трафик.
  Комментарий: paid KudaGo/Timepad скрыты по default, fallback только через `CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID=true`.

- [x] Места могут случайно попасть в афишу.
  Комментарий: `/affiche/events` и detail фильтруют `contentKind=event`; places остаются отдельным flow.

- [x] Большой feed.
  Комментарий: есть `ADVCAKE_FEED_MAX_BYTES`, import timeout и masked failed run; adapter tests покрывают guard.

- [x] Ticketland URL может измениться.
  Комментарий: feed URL берется через `common-feeds` на каждый fetch, download URL не хардкодится.

- [x] Секрет может попасть в лог.
  Комментарий: `ADVCAKE_API_PASS` читается только из env, errors/logs маскируются. Unit test проверяет отсутствие raw pass.

## Открытые решения

- [x] Решение 1: как назвать публичный раздел.
  Комментарий: выбран MVP нейминг `Афиша`, в UI блок называется события/билеты без смешивания с places.

- [x] Решение 2: где показывать в mobile.
  Комментарий: показываем в Tonight rail, Search block и отдельном `features/affiche` detail.

- [x] Решение 3: paid fallback из KudaGo/Timepad.
  Комментарий: выбран default hide, fallback только env `CONTENT_IMPORT_INCLUDE_UNMONETIZED_PAID=true`.

- [x] Решение 4: auto publish или manual moderation.
  Комментарий: AdvCake paid affiliate и free KudaGo/Timepad auto publish после policy, admin может publish/hide/reject/stale/force price.

- [x] Решение 5: сохранять ли картинки в S3.
  Комментарий: выбран MVP external `imageUrl`; загрузка в S3 не добавлялась.

## Источники

- AdvCake API вебмастера: https://support.advcake.com/docs/api/publisher-api.html
- AdvCake common feeds: `GET /common-feeds?pass={API-key}&offer_id=663`
- Ticketland External API: https://external-api.ticketland.ru/?lang=ru
- Локальный контекст: `ai-context/backend-api.md`, `ai-context/database.md`, `ai-context/infra.md`, `ai-context/frontend-flutter.md`
- Код: `backend/apps/worker/src/content/*`, `backend/apps/api/src/services/admin-route-review.service.ts`, `admin/src/admin/pages/RouteReviewQueue.tsx`, `mobile/lib/shared/models/poster.dart`
