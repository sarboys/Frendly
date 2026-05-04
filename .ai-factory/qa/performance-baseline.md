# Performance baseline

Дата: 2026-05-04

## Цель

Зафиксировать цифры до performance правок из плана `performance-audit-services.md`.

## Что мерить

- API latency: p50, p95, статус ответа.
- Response size: bytes на один ответ.
- DB query count: число SQL queries на запрос.
- Worker RSS: `rssBefore`, `rssAfter`, delta.
- Worker throughput: `durationMs`, `itemsPerSecond`, `skippedCount`.
- Flutter frame time: p95 frame build/raster на длинных списках.

## API endpoints

Проверяем на локальном API `http://localhost:3000`:

```bash
curl -sS -o /tmp/affiche-events.json -w 'status=%{http_code} size=%{size_download} time=%{time_total}\n' 'http://localhost:3000/affiche/events?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&limit=50'
curl -sS -o /tmp/search.json -w 'status=%{http_code} size=%{size_download} time=%{time_total}\n' 'http://localhost:3000/search?q=%D0%BA%D0%BE%D0%BD%D1%86%D0%B5%D1%80%D1%82&city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0'
curl -sS -o /tmp/events-nearby.json -w 'status=%{http_code} size=%{size_download} time=%{time_total}\n' 'http://localhost:3000/events?filter=nearby&latitude=55.75&longitude=37.61&limit=50'
curl -sS -o /tmp/route-templates.json -w 'status=%{http_code} size=%{size_download} time=%{time_total}\n' 'http://localhost:3000/evening/route-templates?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&limit=50'
```

Для p50/p95 прогоняем каждый endpoint серией из 30 запросов после прогрева.

## Before snapshot

Дата: 2026-05-05.

Окружение:

- Отдельный clean worktree `/tmp/myapp-perf-before` на commit `381060e9`.
- Docker Postgres `frendly-before-postgres`, DB `big_break`.
- Docker Redis `frendly-before-redis`.
- API `http://localhost:3000`.
- Seed dataset плюс 120 локальных Affiche events and 260 локальных route place candidates.
- Серия: 3 warmup requests, потом 30 sequential requests на endpoint.
- Authenticated smoke через `/auth/dev/login` для endpoints, которым нужен bearer token.

| Endpoint | p50 | p95 | Size | Query count | Статус |
| --- | ---: | ---: | ---: | ---: | --- |
| `/affiche/events?city=Москва&limit=50` | 6.70 ms | 10.91 ms | 31 766 B | 2 | 200 |
| `/search?q=концерт&city=Москва` | 4.89 ms | 9.24 ms | 6 435 B | 17 | 200 |
| `/events?filter=nearby&latitude=55.75&longitude=37.61&limit=50` | 3.72 ms | 5.21 ms | 2 029 B | 11 | 200 |
| `/evening/route-templates?city=Москва&limit=50` | 3.41 ms | 4.45 ms | 6 572 B | 7 | 200 |

Affiche smoke:

- `/affiche/events?city=Москва&limit=50` returned 50 items and `nextCursor=true`.
- Response did not contain `raw` or the inserted `raw.large` marker.

## After snapshot

Дата: 2026-05-05.

Окружение:

- Docker Postgres `frendly-perf-postgres`, DB `big_break`.
- Docker Redis `frendly-perf-redis`.
- API `http://localhost:3000`.
- Seed dataset плюс 120 локальных Affiche events and 260 локальных route place candidates.
- Серия: 3 warmup requests, потом 30 sequential requests на endpoint.

| Endpoint | p50 | p95 | Size | Query count | Статус |
| --- | ---: | ---: | ---: | ---: | --- |
| `/affiche/events?city=Москва&limit=50` | 4.95 ms | 9.21 ms | 34 108 B | 2 | 200 |
| `/search?q=концерт&city=Москва` | 5.20 ms | 9.25 ms | 6 725 B | 18 | 200 |
| `/events?filter=nearby&latitude=55.75&longitude=37.61&limit=50` | 4.12 ms | 4.93 ms | 2 029 B | 12 | 200 |
| `/evening/route-templates?city=Москва&limit=50` | 3.17 ms | 3.85 ms | 6 572 B | 8 | 200 |

Affiche smoke:

- `/affiche/events?city=Москва&limit=50` returned 50 items and `nextCursor=true`.
- Response did not contain `raw` or the inserted `raw.large` marker.

DB EXPLAIN summary:

| Target | Indexes | Seq scan | actualMs |
| --- | --- | --- | ---: |
| `affiche-events-list-basic` | `ExternalContentItem_publicStatus_city_startsAt_id_idx` | none | 0.07 |
| `affiche-events-list-search` | `ExternalContentItem_publicStatus_city_startsAt_id_idx` | none | 0.07 |
| `affiche-events-list-price-mode` | `ExternalContentItem_publicStatus_city_startsAt_id_idx` | none | 0.05 |
| `route-generation-events-candidate-scan` | `ExternalContentItem_publicStatus_city_startsAt_id_idx` | none | 0.06 |
| `route-generation-places-candidate-scan` | `ExternalContentItem_publicStatus_city_startsAt_id_idx` | none | 0.26 |

Новые индексы не добавлялись, потому что локальный EXPLAIN не подтвердил их необходимость.

## Before and after comparison

| Endpoint | Before p95 | After p95 | Before queries | After queries | Итог |
| --- | ---: | ---: | ---: | ---: | --- |
| `/affiche/events?city=Москва&limit=50` | 10.91 ms | 9.21 ms | 2 | 2 | p95 ниже, query count без роста |
| `/search?q=концерт&city=Москва` | 9.24 ms | 9.25 ms | 17 | 18 | backend endpoint почти без изменения; mobile search теперь не грузит лишние discovery feeds |
| `/events?filter=nearby&latitude=55.75&longitude=37.61&limit=50` | 5.21 ms | 4.93 ms | 11 | 12 | p95 ниже, nearby load переведен на page ids |
| `/evening/route-templates?city=Москва&limit=50` | 4.45 ms | 3.85 ms | 7 | 8 | p95 ниже, list отдает summary payload |

Проверки кода после правок:

| Проверка | Статус |
| --- | --- |
| `pnpm --filter @big-break/api test:unit` | passed |
| `pnpm --filter @big-break/api build` | passed |
| `pnpm --filter @big-break/worker test` | passed |
| `pnpm --filter @big-break/worker build` | passed |
| `pnpm --filter @big-break/database test:unit -- hot-query-explain` | passed |
| `pnpm --filter @big-break/database build` | passed |
| `pnpm --filter @big-break/database prisma:generate` | passed |
| `flutter test test/features/affiche/presentation/affiche_events_screen_test.dart test/shared/widgets/bb_external_event_image_test.dart test/features/search/presentation/search_screen_test.dart test/features/evening_routes/evening_routes_screen_test.dart` | passed |
| `flutter analyze` | passed |

## Flutter DevTools status

Ручной profile замер через DevTools UI не снят, потому что iOS Simulator не поддерживает Flutter profile/release builds.

Что проверено вместо этого:

- Поднят iOS Simulator `iPhone 17 Pro`.
- Добавлен `integration_test/affiche_performance_test.dart`.
- Тест строит длинную Affiche list, грузит event images через локальный HTTP server and `CachedNetworkImage`.
- Снят `IntegrationTestWidgetsFlutterBinding.watchPerformance`.
- После скролла сняты `PaintingBinding.instance.imageCache` metrics.

Команда:

```bash
cd mobile
flutter test integration_test/affiche_performance_test.dart -d A195A8F2-DCEB-4B12-9377-8F1D6294F072
```

Результат:

| Metric | Value |
| --- | ---: |
| `frame_count` | 631 |
| `90th_percentile_frame_build_time_millis` | 4.284 ms |
| `99th_percentile_frame_build_time_millis` | 12.681 ms |
| `worst_frame_build_time_millis` | 29.287 ms |
| `missed_frame_build_budget_count` | 3 |
| `90th_percentile_frame_rasterizer_time_millis` | 0.0 ms |
| `missed_frame_rasterizer_budget_count` | 0 |
| `imageCache.currentSize` | 56 |
| `imageCache.currentSizeBytes` | 104 832 000 B |
| `imageCache.maximumSizeBytes` | 104 857 600 B |
| `imageCache.liveImageCount` | 4 |
| `imageCache.pendingImageCount` | 0 |

Вывод:

- Длинный scroll держит p90 build ниже 16 ms на debug simulator.
- Rasterizer budget не пропускается.
- Image cache упирается в стандартный лимит Flutter, unbounded роста нет.
- Pending image loads после settle нет.
- Profile замер остается возможен только на physical iOS device или Android device/emulator with profile support.

Что уже закрыто автоматикой:

- Affiche screen строит lazy page, не весь page сразу.
- На первом viewport создается меньше `CachedNetworkImage`, чем размер page.
- Affiche card image использует `card` profile cache key and fixed cache bucket.
- Next page загружается через scroll listener.
- During filter refresh previous page remains visible.

Команда для дополнительного ручного profile замера на physical device:

```bash
cd mobile
flutter run -d <device-id> --profile --dart-define=BIG_BREAK_API_URL=http://<api-host>:3000
```

В DevTools проверить:

- Performance: p95 frame build/raster на `/affiche` после скролла длинного списка.
- Memory: рост heap после 2-3 проходов по списку.
- Image cache: нет unbounded роста entries при скролле туда-обратно.
