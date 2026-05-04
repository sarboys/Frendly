# Performance Audit Plan: routes, affiche, imports

> Для исполнения: идти по чеклисту сверху вниз. После каждого пункта ставить `[x]`, писать короткий факт в строке `Комментарий после исполнения:`. После любых изменений запускать `bash scripts/update-understand-graph.sh`.

**Цель:** убрать места, которые могут грузить API, worker, базу, память и Flutter UI в сценариях маршрутов, афиши, поиска, постеров и импорта внешних данных.

**Целевой уровень:** быстрый первый экран, ровный скролл 60 fps, API p95 до 200 мс для обычных списков, без скачков памяти на worker import, без лишних сетевых запросов при вводе и переходах.

**Scope:**

- Backend API: `/search`, `/events`, `/affiche/events`, `/posters`, `/evening/route-templates`, `/evening/sessions`.
- Worker: KudaGo, Timepad, AdvCake Ticketland, route draft generation.
- Flutter: Search, Affiche, Evening Routes, image cache, Riverpod providers.
- Database: индексы и формы запросов для hot paths.

**Out of scope:**

- Новые продуктовые фичи.
- Новый отдельный ingestion service.
- Редизайн экранов.
- Смена базы или ORM.

---

## Короткий вывод аудита

Главные проблемы сейчас не в одной явной утечке. Риск в другом:

- Worker импорта собирает большие внешние ответы в массивы и потом обрабатывает их целиком.
- Public API местами читает лишние поля, включая `raw` JSON, хотя на клиент они не нужны.
- Поиск делает несколько тяжелых запросов сразу, а Flutter параллельно поднимает discovery feed и people.
- Каталог маршрутов на backend отдает все шаги для summary, а Flutter строит все карточки сразу.
- В гео ленте events без PostGIS backend может грузить до 300 записей с include перед тем, как отдать первые 20.
- Для route generation загружается до 720 places в память на один город, потом строятся skeletons.

Это не выглядит как явная memory leak. Это больше похоже на накопление лишней работы в hot path.

---

## Найденные риски

### P0. Worker import держит весь feed в памяти

Файлы:

- `backend/apps/worker/src/content/content-import.service.ts`
- `backend/apps/worker/src/content/kudago.adapter.ts`
- `backend/apps/worker/src/content/timepad.adapter.ts`
- `backend/apps/worker/src/content/advcake-ticketland.adapter.ts`

Факты по коду:

- `ContentImportService.executeRun()` получает `rawItems = await adapter.fetchItems(...)`, потом идет по всему массиву, строки 153-168.
- KudaGo собирает `events` и `places` через `Promise.all`, потом возвращает `return [...events, ...places]`, строки 67-73.
- KudaGo `fetchPaged()` копит `items.push(...pageItems)`, строки 177-185.
- Timepad копит все страницы в `items`, строки 17-52.
- AdvCake читает весь XML через `response.text()`, потом парсит весь body, строки 64-67 и 94-112.
- AdvCake лимит 60 MB на feed защищает от бесконечного роста, но XML parser создает второй большой объект в памяти.

Риск:

- При большом feed worker может резко поднять RSS.
- Если параллельно идут route generation, outbox, push, память будет дергаться.
- Долгий импорт держит процесс занятым, ручные runs могут ждать.

Что сделать:

- [x] Перевести adapters на async iterator или page callback.
  - Файлы: `content-source.types.ts`, `content-import.service.ts`, `kudago.adapter.ts`, `timepad.adapter.ts`.
  - Комментарий после исполнения: готово, добавлен optional `fetchBatches()`, KudaGo, Timepad, AdvCake отдают batch stream, старый `fetchItems()` сохранен.
- [x] Обрабатывать page batch по 50-200 items без общего массива `rawItems`.
  - Критерий: peak RSS на локальном stress import не растет линейно от общего числа items.
  - Комментарий после исполнения: готово, `ContentImportService` обрабатывает batch по мере прихода, без общего `rawItems`.
- [x] Для AdvCake оставить hard byte limit, добавить streaming parse или chunked SAX parser.
  - Критерий: XML feed 60 MB не создает двойной объект `string + parsed tree` в памяти.
  - Комментарий после исполнения: готово, AdvCake stream режет `<offer>` chunkами, fallback оставлен для test responses без body.
- [x] Добавить метрики `rssBefore`, `rssAfter`, `durationMs`, `itemsPerSecond`, `skippedCount`.
  - Критерий: лог run показывает память и скорость без секретов.
  - Комментарий после исполнения: готово, import logs пишут RSS, duration, throughput, skipped count.

Проверка:

```bash
cd backend && pnpm --filter @big-break/worker test
cd backend && pnpm --filter @big-break/worker build
```

---

### P0. Dedupe импорта делает DB query на каждый event

Файл:

- `backend/apps/worker/src/content/content-import.service.ts`

Факты по коду:

- На каждый event вызывается `prepareItemForUpsert()`, строка 170.
- Внутри вызывается `findEventDuplicate()`, строка 362.
- `findEventDuplicate()` делает `externalContentItem.findMany()` по дню и городу, строки 399-414.

Риск:

- Для 3000 events это до 3000 отдельных queries.
- Импорт внешних источников станет медленным именно на росте данных.
- База будет занята мелкими повторяющимися запросами.

Что сделать:

- [x] Перед batch import собрать duplicate cache по `city + day + contentKind`.
  - Файлы: `content-import.service.ts`, `content-deduplication.service.ts`.
  - Комментарий после исполнения: готово, duplicate preload кешируется по city, day, contentKind и source.
- [x] Проверять duplicate in memory внутри дня, а DB трогать один раз на группу.
  - Критерий: число DB queries на import растет по дням, не по item count.
  - Комментарий после исполнения: готово, `findEventDuplicate()` ищет match по preload candidates в памяти.
- [x] Добавить unit test: 100 normalized events за один день делают один duplicate preload.
  - Комментарий после исполнения: готово, unit test проверяет один `externalContentItem.findMany()` на 100 events.

Проверка:

```bash
cd backend && pnpm --filter @big-break/worker test -- content-import
```

---

### P0. Public affiche API читает лишний `raw` JSON

Файл:

- `backend/apps/api/src/services/affiche.service.ts`

Факты по коду:

- `listEvents()` делает `externalContentItem.findMany()` без `select`, строки 25-34.
- `getEvent()` тоже делает query без `select`, строки 43-57.
- DTO не использует `raw`, `normalizedHash`, `importRunId`, `createdAt`, `updatedAt`.

Риск:

- `raw` может быть большим, потому что туда сохраняется внешний payload.
- Public list может таскать лишние JSON поля из Postgres в Node.js на каждый запрос.
- Это бьет и по памяти, и по latency.

Что сделать:

- [x] Заменить `include` на узкий `select` для list.
  - Файл: `affiche.service.ts`.
  - Комментарий после исполнения: готово, `listEvents()` использует `afficheEventSelect` без `raw`, `normalizedHash`, `importRunId`, `createdAt`, `updatedAt`.
- [x] Для detail тоже использовать select, raw не отдавать.
  - Комментарий после исполнения: готово, `getEvent()` использует тот же узкий `select`.
- [x] Добавить unit test, что `raw` не нужен для mapping.
  - Комментарий после исполнения: готово, unit test проверяет отсутствие `include` и `raw` в list/detail query.
- [x] Добавить API performance smoke: 50 affiche rows без чтения raw.
  - Комментарий после исполнения: готово, локальная база поднята в Docker, добавлено 120 test Affiche rows; `/affiche/events?city=Москва&limit=50` вернул 50 items, `nextCursor=true`, raw marker в ответе не найден.

Проверка:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- affiche
cd backend && pnpm --filter @big-break/api build
```

---

### P0. Nearby events грузят слишком много records перед выдачей страницы

Файл:

- `backend/apps/api/src/services/events.service.ts`

Факты по коду:

- `listEvents()` при geo center без PostGIS берет `listTake(take, geoQuery)`, строки 217-220.
- `listTake()` для geo center берет до `take * 6`, максимум 300, строки 2151-2157.
- До slicing грузятся `participants`, `joinRequests`, `attendances`, `liveState`, строки 184-221.
- Потом в JS идет geo sort и slice, строки 223-240.

Риск:

- При limit 50 backend может загрузить до 300 events плюс вложенные участники.
- Это тяжелый путь для Tonight, Search discovery, Map.
- На слабом сервере p95 будет прыгать при активной карте или поиске рядом.

Что сделать:

- [x] Сделать двухфазный query для nearby без PostGIS: сначала ids и coords, потом details только для page ids.
  - Файл: `events.service.ts`.
  - Комментарий после исполнения: готово, geo center без PostGIS сначала грузит `id`, `coords`, `startsAt`, потом details только для page ids.
- [x] Включить PostGIS path как production default, если миграции и extension готовы.
  - Файлы: `schema.prisma`, migrations, deploy docs.
  - Комментарий после исполнения: проверено, production default не включен, потому что `Event.geo` и GiST index создаются отдельным `db:postgis:event-geo`, а не обычной миграцией.
- [x] Для PostGIS candidate query добавить те же ключевые фильтры, что потом применяются в Prisma, или увеличить overfetch по правилам.
  - Причина: сейчас raw query фильтрует distance, startsAt, blocked hosts, но не все фильтры из `buildListWhere()`.
  - Комментарий после исполнения: готово, PostGIS raw scan теперь учитывает `canceledAt`, visibility, gender visibility, date/now window, route flags, q, lifestyle, gender, access and price filters.
- [x] Добавить load test для `/events?filter=nearby&latitude=...&longitude=...&limit=50`.
  - Критерий: p95 до 200 мс на seed dataset.
  - Комментарий после исполнения: готово, локальный API и seed dataset подняты; 30 sequential requests дали p50 4.12 ms, p95 4.93 ms.

Проверка:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- events.service
cd backend && pnpm --filter @big-break/api build
```

---

### P1. Search запускает много тяжелой работы за один ввод

Файлы:

- `backend/apps/api/src/services/search.service.ts`
- `mobile/lib/features/search/presentation/search_screen.dart`
- `mobile/lib/features/search/presentation/search_providers.dart`

Факты по коду:

- Backend `groupedSearch()` делает 5 запросов параллельно: meetups, after dark, routes, posters, affiche.
- Flutter `SearchScreen.build()` всегда смотрит `eventsProvider('nearby')`, строки 190-191.
- Там же всегда смотрит `peopleProvider`, строки 216-217.
- `searchResultsProvider` запрашивает по 20 items на каждую группу, строки 102-114.
- Потом Flutter еще раз фильтрует результаты локально, строки 117 и далее.

Риск:

- При открытии search может стартовать location, `/events`, `/people`.
- При активном поиске добавляется `/search`.
- На плохой сети пользователь увидит задержку ввода и лишний spinner.

Что сделать:

- [x] Разделить discovery mode и remote search mode.
  - Если `_showResults == true`, не смотреть `eventsProvider('nearby')` без нужды.
  - Файл: `search_screen.dart`.
  - Комментарий после исполнения: готово, remote search active path не смотрит discovery events.
- [x] `peopleProvider` грузить только на discover screen, не во время remote search.
  - Комментарий после исполнения: готово, remote search active path возвращает пустой people list без watch provider.
- [x] В `/search` передавать только нужные группы или снижать лимиты по умолчанию.
  - Файлы: `search.service.ts`, `search_providers.dart`.
  - Комментарий после исполнения: готово, Flutter remote search limits снижены с 20 на группу до 6-8.
- [x] Добавить cancellation или stale result guard для debounce requests.
  - Критерий: быстрый ввод не рисует старые results поверх новых.
  - Комментарий после исполнения: готово, во время pending debounce старые remote results не используются, а settled query смотрит provider по новому ключу.

Проверка:

```bash
cd mobile && flutter test test/features/search
cd mobile && flutter analyze
```

---

### P1. Route template list отдает все steps для summary

Файл:

- `backend/apps/api/src/services/evening-route-template.service.ts`

Факты по коду:

- `listRouteTemplates()` использует `include: this.templateSummaryInclude()`, строки 31-75.
- `templateSummaryInclude()` грузит все `currentRoute.steps`, строки 351-359.
- Summary берет только `steps.slice(0, 4)`, строки 397-403.
- `partnerOffersPreview` тоже идет по всем steps, строка 404.

Риск:

- Если маршрутов станет много, list endpoint будет отдавать detail payload.
- Это грузит Prisma, JSON response, Flutter parsing.
- Search `/search` тоже использует route list, значит тормоз пойдет в общий поиск.

Что сделать:

- [x] Разделить summary select и detail include.
  - Summary должен брать только route fields плюс первые 4 visible steps.
  - Комментарий после исполнения: готово, list использует `templateSummarySelect` с `steps.take=4`, detail использует отдельный полный select.
- [x] Для `partnerOffersPreview` сделать отдельный bounded select или denormalized preview на route.
  - Комментарий после исполнения: готово, preview грузится отдельным select по `EveningRouteStep` с лимитом `routeIds * 8` и без тяжелых detail fields.
- [x] Добавить contract test: list route templates не содержит полные `description`, `ticketUrl`, `offerTerms` steps.
  - Комментарий после исполнения: готово, unit test проверяет summary select и bounded partner offer select.

Проверка:

```bash
cd backend && pnpm --filter @big-break/api test:unit -- evening-route-template
cd backend && pnpm --filter @big-break/api build
```

---

### P1. Evening routes экран строит все карточки сразу

Файл:

- `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`

Факты по коду:

- `_RoutesContent` делает `rest = routes.skip(1).toList()`, строка 481.
- Потом `ListView(children: [... for (final route in rest) ...])`, строки 483-510.

Риск:

- При 30-100 маршрутах Flutter построит все карточки сразу.
- Карточка тяжелая: timeline, chips, тени, тексты, кнопки.
- Скролл маршрутов может проседать на слабом устройстве.

Что сделать:

- [x] Заменить `ListView(children:)` на `CustomScrollView` или `ListView.builder`.
  - Файл: `evening_routes_screen.dart`.
  - Комментарий после исполнения: готово, `_RoutesContent` использует `CustomScrollView` и `SliverChildBuilderDelegate` для остальных маршрутов.
- [x] Убрать `rest.toList()` из build path.
  - Комментарий после исполнения: готово, остальные routes читаются по индексу без промежуточного списка.
- [x] Добавить widget test на 100 route summaries, чтобы build не создает все cards.
  - Комментарий после исполнения: готово, test проверяет, что `Маршрут 99` не построен сразу.

Проверка:

```bash
cd mobile && flutter test test/features/evening_routes
cd mobile && flutter analyze
```

---

### P1. Affiche screen берет 50 items без pagination

Файл:

- `mobile/lib/features/affiche/presentation/affiche_events_screen.dart`

Факты по коду:

- Экран запрашивает `limit: 50`, строки 54-61.
- API поддерживает cursor, но UI не использует next page.

Риск:

- Первый ответ больше, чем нужен первому viewport.
- При search вводе можно часто получать 50 rows.
- Нет контроля подгрузки при длинной афише.

Что сделать:

- [x] Сделать paginated provider для affiche: first page 12-20, next page по scroll threshold.
  - Файлы: `app_providers.dart`, `affiche_events_screen.dart`.
  - Комментарий после исполнения: готово, добавлен `afficheEventsPagedProvider`, first page 18, next page грузится рядом с низом списка.
- [x] Сохранять previous data на смене фильтра, показывать thin loading state.
  - Комментарий после исполнения: готово, screen держит last page state и показывает тонкий `LinearProgressIndicator` при смене query/filter.
- [x] Добавить debounce + stale guard для query.
  - Комментарий после исполнения: готово, query debounce сохранен, results привязаны к provider key, old data не заменяется stale response.

Проверка:

```bash
cd mobile && flutter test test/features/affiche
cd mobile && flutter analyze
```

---

### P1. Image cache в affiche идет через raw CachedNetworkImage

Файл:

- `mobile/lib/features/affiche/presentation/affiche_event_card.dart`

Факты по коду:

- Карточка сама считает `cacheWidth`, `cacheHeight`, строки 166-184.
- `cacheKey` включает width и URL, строка 179.
- Это не shared image/media widget, хотя правила проекта просят shared media path.

Риск:

- Одна картинка может иметь несколько disk cache entries для card, compact, hero.
- В разных экранах будет разная логика placeholder, fade, memory size.
- Сложно управлять prefetch и eviction.

Что сделать:

- [x] Ввести shared widget/service для external event images с usage profile `card`, `rail`, `hero`.
  - Файлы: `mobile/lib/shared/widgets` или existing shared image module.
  - Комментарий после исполнения: готово, добавлен `BbExternalEventImage`, card использует `card/rail`, detail hero использует `hero`.
- [x] Стабилизировать cache key: URL плюс usage profile, не raw width.
  - Комментарий после исполнения: готово, cache key строится как `external-event-image-<profile>-<url>`.
- [x] Оставить `memCacheWidth/Height`, но сделать фиксированные buckets.
  - Комментарий после исполнения: готово, профили используют фиксированные buckets: rail 560x320, card 900x520, hero 1400x900.
- [x] Проверить image memory на длинной афише через DevTools memory.
  - Комментарий после исполнения: готово через simulator integration check вместо DevTools UI. `flutter test integration_test/affiche_performance_test.dart -d A195A8F2-DCEB-4B12-9377-8F1D6294F072` прошел: `imageCache.currentSize=56`, `currentSizeBytes=104832000`, `maximumSizeBytes=104857600`, `pendingImageCount=0`. Profile DevTools на iOS Simulator невозможен, Flutter пишет `release/profile builds are only supported for physical devices`.

Проверка:

```bash
cd mobile && flutter test test/shared/widgets
cd mobile && flutter analyze
```

---

### P1. Route generation держит до 720 places на batch

Файл:

- `backend/apps/worker/src/content/route-draft-generation.service.ts`

Факты по коду:

- Константа `MAX_PLACE_CANDIDATES_PER_PROMPT = 720`.
- `selectCandidates()` грузит events и places в память.
- `buildPromptRequest()` строит skeletons и prompt candidates из общего массива, строки 332-390.

Риск:

- На scheduled generation по городам, moods и budgets память и CPU могут пиками расти.
- Prompt уже режется по chars, но selection и skeleton строятся до этого.
- Places order по `importedAt` может вытеснять более полезные места по району.

Что сделать:

- [x] Снизить candidate pool через район, category quotas и geo buckets до route planner.
  - Файл: `route-draft-generation.service.ts`.
  - Комментарий после исполнения: готово, place query ограничен 240 rows, дальше pool балансируется по area, category и geo bucket.
- [x] Добавить memory and duration logs на batch.
  - Комментарий после исполнения: готово, batch logs пишут `rssBefore`, `rssAfter`, `durationMs`.
- [x] Проверить индекс для places query.
  - Нужен путь под `publicStatus + city + contentKind + moderationStatus + importedAt`.
  - Комментарий после исполнения: готово, EXPLAIN ANALYZE снят на локальной Docker DB; используется `ExternalContentItem_publicStatus_city_startsAt_id_idx`, seq scan нет, actualMs 0.26.
- [x] Добавить test на bounded candidates per city and mood.
  - Комментарий после исполнения: готово, unit test проверяет `take=240` и bounded prompt candidates.

Проверка:

```bash
cd backend && pnpm --filter @big-break/worker test -- route-draft-generation route-planner
```

---

### P2. Индексы ExternalContentItem не полностью совпадают с hot queries

Файл:

- `backend/packages/database/prisma/schema.prisma`

Факты по схеме:

- Есть `@@index([publicStatus, city, startsAt, id])`.
- Есть `@@index([city, startsAt, priceMode, contentKind, moderationStatus, sourceId])`.
- Public affiche фильтрует `city`, `contentKind`, `publicStatus`, `moderationStatus`, `priceMode`, `startsAt`.
- Route generation places фильтрует `city`, `publicStatus`, `contentKind=place`, `moderationStatus in (...)`, `lat/lng not null`, `expiresAt`, потом order by `importedAt desc, category asc, id asc`.

Риск:

- На малом объеме все нормально.
- На большом объеме Postgres может читать лишние rows, особенно по places.

Что сделать:

- [x] Снять `EXPLAIN ANALYZE` для `/affiche/events` с q пустым, q непустым, priceMode.
  - Комментарий после исполнения: готово, basic/search/priceMode идут через `ExternalContentItem_publicStatus_city_startsAt_id_idx`, seq scan нет, actualMs 0.05-0.07.
- [x] Снять `EXPLAIN ANALYZE` для route generation events и places queries.
  - Комментарий после исполнения: готово, events и places идут через `ExternalContentItem_publicStatus_city_startsAt_id_idx`, seq scan нет, actualMs 0.06 и 0.26.
- [x] Добавить только подтвержденные индексы.
  - Кандидаты:
    - `ExternalContentItem(publicStatus, city, contentKind, priceMode, startsAt, id)`
    - `ExternalContentItem(publicStatus, city, contentKind, moderationStatus, importedAt, category, id)`
  - Комментарий после исполнения: готово, новых индексов не добавлено, потому что локальный EXPLAIN не подтвердил необходимость.
- [x] Если `q` по affiche важен, рассмотреть trigram index или tsvector вместо `contains insensitive`.
  - Комментарий после исполнения: готово, для текущего локального smoke поиск идет по существующему index scan без seq scan; trigram/tsvector не добавлялся.

Проверка:

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
```

---

## План исполнения по фазам

### Phase 1. Измерения до правок

- [x] Добавить простой performance baseline doc в `.ai-factory/qa/performance-baseline.md`.
  - Что мерить: API latency, DB query count, worker RSS, Flutter frame time.
  - Комментарий после исполнения: готово, добавлен baseline artifact с командами и таблицей.
- [x] Локально замерить:
  - `/affiche/events?city=Москва&limit=50`
  - `/search?q=концерт&city=Москва`
  - `/events?filter=nearby&latitude=55.75&longitude=37.61&limit=50`
  - `/evening/route-templates?city=Москва&limit=50`
  - Комментарий после исполнения: готово, локальная Docker DB, Redis, seed dataset and API подняты, 30 sequential requests на endpoint.
- [x] Сохранить текущие p50, p95, response size, query count.
  - Комментарий после исполнения: готово, цифры записаны в `.ai-factory/qa/performance-baseline.md`; query count снят через `pg_stat_statements`.

### Phase 2. Backend API hot path

- [x] Убрать лишние поля из `AfficheService`.
  - Комментарий после исполнения: готово, public list/detail больше не читают `raw`.
- [x] Разделить route template summary and detail.
  - Комментарий после исполнения: готово, list грузит summary payload, detail грузит полные steps отдельно.
- [x] Переделать nearby events на двухфазную загрузку.
  - Комментарий после исполнения: готово, full include выполняется только для ids текущей page.
- [x] Снизить default grouped search limits или сделать group mask.
  - Комментарий после исполнения: готово, mobile search больше не запрашивает `20` для каждой группы.

### Phase 3. Worker import and generation

- [x] Перевести KudaGo и Timepad на page batch processing.
  - Комментарий после исполнения: готово, adapters отдают страницы через `fetchBatches()`.
- [x] Убрать per item duplicate query.
  - Комментарий после исполнения: готово, duplicate DB preload кешируется по дневной группе.
- [x] Улучшить AdvCake XML memory behavior.
  - Комментарий после исполнения: готово, feed читается streamом и парсится offer batchами.
- [x] Ограничить candidate pool route generation до полезного набора.
  - Комментарий после исполнения: готово, route generation применяет query cap, area preference, category quotas, geo buckets.

### Phase 4. Flutter responsiveness

- [x] Search не должен грузить discovery feed и people во время remote search.
  - Комментарий после исполнения: готово, `SearchScreen` разделяет discovery and remote modes.
- [x] Affiche list перейти на pagination.
  - Комментарий после исполнения: готово, list использует paged provider и lazy `ListView.separated`.
- [x] Evening routes list перейти на lazy builder.
  - Комментарий после исполнения: готово, catalog строит route cards лениво.
- [x] Affiche images перевести на shared image usage profiles.
  - Комментарий после исполнения: готово, Affiche card and hero image используют shared `BbExternalEventImage`.

### Phase 5. Database and release gates

- [x] Снять explain plans после Phase 2 and Phase 3.
  - Комментарий после исполнения: готово, `db:perf:hot-queries` прошел с `PERF_CHECK_RUN_ANALYZE=true` на локальной Docker DB.
- [x] Добавить только нужные индексы.
  - Комментарий после исполнения: готово, новых индексов не добавлено, потому что локальный EXPLAIN не показал seq scan или плохой план для проверенных hot paths.
- [x] Прогнать backend build and tests.
  - Комментарий после исполнения: готово, API unit tests, worker tests, database unit tests, API build, worker build, database build and prisma generate прошли.
- [x] Прогнать Flutter analyze and targeted tests.
  - Комментарий после исполнения: готово, `flutter analyze`, search tests, evening routes test, Affiche screen pagination test and external event image widget test прошли.
- [x] Проверить Flutter DevTools: frame time, memory, image cache.
  - Комментарий после исполнения: готово через iOS Simulator integration check вместо DevTools UI. Debug simulator metrics: `frame_count=631`, p90 build `4.284 ms`, p99 build `12.681 ms`, p90 raster `0.0 ms`, missed raster budget `0`, image cache `104832000/104857600 B`, pending images `0`. Profile DevTools остается только для physical iOS device или Android device/emulator with profile support.

---

## Definition of Done

- [x] `/affiche/events` не читает `raw` JSON в public path.
- [x] `/evening/route-templates` отдает summary payload, а detail грузится отдельно.
- [x] Nearby events не грузят hundreds of records with includes перед page slice.
- [x] Search screen не делает лишний `/events` и `/people` во время remote search.
- [x] Affiche и route catalog используют lazy list.
- [x] Worker import не держит все pages в одном массиве.
- [x] Dedupe import не делает query на каждый item.
- [x] Route generation имеет bounded candidate pool and memory logs.
- [x] Есть baseline до и после.
  - Комментарий после исполнения: готово, before snapshot восстановлен из отдельного clean worktree `/tmp/myapp-perf-before` на commit `381060e9`, after snapshot уже был снят на текущих правках; сравнение записано в `.ai-factory/qa/performance-baseline.md`.
- [x] Все проверки проходят.
  - Комментарий после исполнения: готово, automated checks, graph update, API smoke, DB EXPLAIN and Flutter simulator performance check passed.

---

## Команды проверки

Backend:

```bash
cd backend && pnpm --filter @big-break/api test:unit
cd backend && pnpm --filter @big-break/api build
```

Worker:

```bash
cd backend && pnpm --filter @big-break/worker test
cd backend && pnpm --filter @big-break/worker build
```

Database:

```bash
cd backend && pnpm --filter @big-break/database prisma:generate
cd backend && pnpm --filter @big-break/database db:perf:hot-queries
```

Flutter:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
```

Graph:

```bash
bash scripts/update-understand-graph.sh
node scripts/ua-query.test.mjs
```

---

## Заметки по порядку

Сначала лучше сделать Phase 1 and Phase 2. Это даст быстрый эффект на API и уменьшит лишний payload.

Потом worker import. Там больше риск задеть внешние источники, поэтому нужны тестовые fixtures.

Flutter правки лучше делать после API сужения, чтобы не чинить два слоя одновременно.
