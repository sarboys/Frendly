# План: перенос новой мини-соцсети, баннера и билетов из front во Flutter

> Чекбокс `[x]` ставим только после кода, теста или ручной проверки. Под каждой закрытой задачей оставляем короткий комментарий: что сделано, какие файлы тронуты, чем проверено.

**Дата:** 2026-05-05.
**Источник UI:** `front/src/components/bigbreak/`.
**Цель:** перенести в Flutter 1 в 1 новый UI из `front/`, убрать локальную заглушку в пользу backend, сохранить скорость hot paths.

## Что уже проверено при планировании

- [x] Найдены React-источники новой логики.
  Комментарий: `socialStore.ts`, `SocialActions.tsx`, `screens/UserProfile.tsx`, `AnnouncementBanner.tsx`, `screens/MeetupChat.tsx`, `data.ts`.

- [x] Найдены Flutter-точки переноса.
  Комментарий: `user_profile_screen.dart`, `bb_system_overlays.dart`, `meetup_chat_screen.dart`, `meetup_chat.dart`, `poster.dart`, `backend_repository.dart`, parity tests.

- [x] Найдены backend-точки для API.
  Комментарий: `people.controller.ts`, `people.service.ts`, `chats.service.ts`, `events.service.ts`, `posters.service.ts`, contracts, Prisma schema.

- [x] Проверено текущее отличие по билетам.
  Комментарий: после обновления `main` backend уже поддерживает `afficheEventId` при создании встречи, публичную `AfficheEvent` модель и external ticket поля. Но meetup chat summary пока отдает только `ticketUrl` из legacy `sourcePoster`, без `posterId`, `priceFrom`, `provider`, `venue`, и без данных из `sourceExternalContentItem`.

- [x] Проверено текущее отличие по соцсети.
  Комментарий: generic follow, profile like, super-like для публичного профиля нет. Есть `DatingAction`, но это другой сценарий, его нельзя смешивать с обычными профилями.

- [x] Перепроверен свежий `main` после pull.
  Комментарий: в `main` появились публичная афиша, `AfficheEvent`, `POST /events` с `afficheEventId`, связь `Event.sourceExternalContentItemId`, ticket metadata в Evening route steps. Это меняет план билетов: chat ticket block должен работать и для legacy `Poster`, и для новой `Affiche`.

- [x] Проверено, что social backend все еще не появился.
  Комментарий: в Prisma есть только `DatingAction` с `super_like`, обычных `UserFollow` или `ProfileReaction` нет. Phase 1 остается актуальной.

## Правила реализации

- [x] Сначала backend contract, потом Flutter model, потом UI.
  Комментарий: добавлены Prisma contract и backend endpoints, затем Flutter models/providers, потом UI в профиле, баннере и meetup chat.

- [x] Для соцдействий делать optimistic UI, но source of truth держать на backend.
  Комментарий: `ProfileSocialController` делает optimistic update и заменяет состояние snapshot-ответом backend.

- [x] Не грузить social state глобально для всех списков.
  Комментарий: social state scoped через `profileSocialProvider(userId)`, глобальной загрузки по всем спискам нет.

- [ ] Для списков использовать компактные счетчики, для полного профиля полный блок.
  Комментарий: полный блок в профиле готов. Компактные варианты виджета есть, но списки не подключены, потому что chat/dating/after-dark сейчас не получают bounded social preview.

- [ ] Pixel parity проверять скриншотами front и Flutter на одинаковых состояниях.
  Комментарий: скриншотная проверка еще не сделана.

- [x] Ticket block в чате должен брать готовый summary из chat API.
  Комментарий: `MeetupChat` берет ticket summary из chat API, UI не делает дополнительный запрос.
  Не делать дополнительный запрос к `/posters/:id` или `/affiche/events/:id` при открытии чата.

## Phase 1: Backend social model

- [x] Task 1.1: Добавить Prisma-модели для обычных соцдействий.
  Комментарий: добавлены `UserFollow`, `ProfileReaction`, `ProfileReactionKind`. Для `ProfileReaction` unique сделан по `actorUserId,targetUserId,kind`, чтобы like и super-like были независимыми. `DatingAction` не тронут.

- [x] Task 1.2: Добавить индексы hot path.
  Комментарий: добавлены индексы по target, actor и target plus kind, плюс cascade FK для cleanup.

- [x] Task 1.3: Добавить migration.
  Комментарий: добавлена migration `20260505133000_profile_social_actions`, старые пользователи получают нулевые counts через отсутствие строк.

- [x] Task 1.4: Добавить DTO в `@big-break/contracts`.
  Комментарий: добавлен `ProfileSocialDto` с counts и viewer flags.

- [x] Task 1.5: Добавить endpoints в people API.
  Комментарий: добавлены `GET /people/:userId/social`, follow PUT/DELETE и reactions PUT/DELETE.

- [x] Task 1.6: Запретить действия на самого себя.
  Комментарий: backend возвращает `self_social_action_not_allowed`, Flutter отключает кнопки для своего профиля.

- [x] Task 1.7: Вернуть social snapshot в `GET /people/:userId`.
  Комментарий: `PeopleService.getPersonProfile` возвращает `social`, Flutter парсит его в `ProfileData`.

- [ ] Task 1.8: Добавить social preview в списки людей, где это нужно.
  Комментарий: не сделано. Пока нет backend preview contract для chat/dating/after-dark списков, чтобы не плодить запросы по строкам.

- [x] Task 1.9: Добавить unit tests backend.
  Комментарий: добавлены тесты `people.service.unit.spec.ts` на profile social snapshot, независимые like/super-like и запрет self action.

## Phase 2: Backend ticket block for meetup chat

- [x] Task 2.1: Расширить chat summary contract.
  Комментарий: добавлен `MeetupChatTicketDto`, старый `ticketUrl` сохранен.

- [x] Task 2.2: Обновить `ChatsService.listChats`.
  Комментарий: `ChatsService` делает narrow select для `sourcePoster` и `sourceExternalContentItem`, затем мапит общий ticket summary.

- [x] Task 2.3: Скрывать ticket block для бесплатного или неизвестного источника.
  Комментарий: backend не отдает ticket summary без URL, без положительной цены или если Affiche не paid. Flutter дополнительно проверяет `hasPaidTicket`.

- [x] Task 2.4: Проверить создание встречи из poster и affiche.
  Комментарий: свежий `main` уже сохраняет `posterId` и `afficheEventId`, chat summary читает обе связи через `Event`.

- [x] Task 2.5: Добавить backend tests на chat summary.
  Комментарий: добавлены тесты на paid poster, paid affiche и free affiche без ticket summary.

## Phase 3: Flutter data layer

- [x] Task 3.1: Расширить `ProfileData`.
  Комментарий: добавлен `ProfileSocialData`, парсинг из `fromPersonJson` и безопасный default для `fromProfileJson`.

- [x] Task 3.2: Добавить social model и provider.
  Комментарий: добавлен `profileSocialProvider(userId)` и `ProfileSocialController` с optimistic update и rollback.

- [x] Task 3.3: Добавить методы `BackendRepository` для social endpoints.
  Комментарий: добавлены `fetchProfileSocial`, `setProfileFollow`, `setProfileReaction`.

- [x] Task 3.4: Расширить `MeetupChat`.
  Комментарий: добавлены `ticketSourceKind`, `ticketSourceId`, `ticketPriceFrom`, `ticketProvider`, `ticketVenue`, `hasPaidTicket`, старый `ticketUrl` оставлен.

- [x] Task 3.5: Обновить mock data и tests fixtures.
  Комментарий: обновлены profile fixtures, meetup chat model tests и parity tests для ticket/social.

## Phase 4: Flutter reusable SocialActions

- [x] Task 4.1: Создать reusable widget `BbSocialActions`.
  Комментарий: создан `shared/widgets/bb_social_actions.dart` с вариантами `full`, `compact`, `row`.

- [x] Task 4.2: Перенести формат counts.
  Комментарий: `_formatSocialCount` форматирует `1340` в `1.3k`, `10000` в `10k`, мелкие числа без суффикса.

- [x] Task 4.3: Перенести full layout.
  Комментарий: full layout показывает три stat-карточки и ряд follow, like, super-like через `AppColors`.

- [x] Task 4.4: Перенести compact layout.
  Комментарий: compact layout показывает кнопку подписки и круглую кнопку like. Для list tap используется локальный callback внутри виджета.

- [x] Task 4.5: Перенести row layout.
  Комментарий: row layout показывает только counts с иконками, без action-кнопок.

- [x] Task 4.6: Добавить widget tests.
  Комментарий: добавлен `bb_social_actions_test.dart` на full, compact optimistic toggle и row counters.

## Phase 5: Flutter UserProfile parity

- [x] Task 5.1: Вставить `BbSocialActions.full` в профиль.
  Комментарий: блок вставлен в `UserProfileScreen` между location и trust cards.

- [x] Task 5.2: Подогнать отступы профиля под front.
  Комментарий: social block встроен в существующую сетку профиля, sticky actions не менялись.

- [x] Task 5.3: Скрыть или отключить social actions для своего профиля.
  Комментарий: для своего профиля кнопки disabled, backend дополнительно запрещает self action.

- [ ] Task 5.4: Интегрировать social row в нужные списки.
  Комментарий: не закрыто. В чатах есть `memberProfiles.userId`, но нет social preview. В after-dark event сейчас нет host userId. В dating используется отдельный `DatingAction`, поэтому обычную соцсеть туда нельзя смешивать без нового contract.

- [x] Task 5.5: Добавить parity test на профиль.
  Комментарий: parity test проверяет `Подписчики`, `Лайков`, `Супер`, counts и кнопку `Вы подписаны`.

## Phase 6: Flutter announcement banner parity

- [x] Task 6.1: Переписать `_AnnouncementBanner` в `bb_system_overlays.dart`.
  Комментарий: баннер переведен на карточку `colors.card`, border, тень и левую severity-полосу.

- [x] Task 6.2: Перенести severity palette.
  Комментарий: `info`, `warning`, `critical` получают отдельные accent, tone, icon background и icon.

- [x] Task 6.3: Перенести CTA со стрелкой.
  Комментарий: CTA теперь `FilledButton` с `LucideIcons.arrow_right`.

- [x] Task 6.4: Сохранить force behavior.
  Комментарий: force behavior сохранен, close button скрыт при `force=true`.

- [x] Task 6.5: Добавить widget tests на banner.
  Комментарий: обновлены `bb_system_overlays_test.dart`, проверены content, warning label и CTA arrow.

## Phase 7: Flutter meetup chat ticket block

- [x] Task 7.1: Добавить paid ticket block под pinned meetup card.
  Комментарий: `_MeetupTicketBanner` вставлен в `topItems` сразу после pinned meetup card.

- [x] Task 7.2: Перенести визуал из front.
  Комментарий: добавлен primary gradient, ticket icon tile, текст `Купить билет · от X ₽`, строка provider/venue и external link icon.

- [x] Task 7.3: Открывать внешний provider.
  Комментарий: используется существующий `_ticketAction(chat)`, он открывает URL через `url_launcher` external application и показывает snackbar при ошибке.

- [x] Task 7.4: Скрыть block для free poster.
  Комментарий: `MeetupChat.hasPaidTicket` требует URL и `ticketPriceFrom > 0`, backend не отдает free/unknown Affiche.

- [x] Task 7.5: Обновить chat tests.
  Комментарий: добавлены model tests и parity test на paid ticket block. Отдельный tap launcher test не добавлен, так как используется уже существующий ticket action.

## Phase 8: Pixel parity and QA

- [ ] Task 8.1: Сделать front screenshots для эталона.
  Комментарий: не сделано в этом проходе.

- [ ] Task 8.2: Сделать Flutter screenshots.
  Комментарий: не сделано в этом проходе.

- [x] Task 8.3: Проверить mobile на narrow width.
  Комментарий: добавлены FittedBox/ellipsis в action labels и provider line, targeted widget tests проходят без overflow.

- [x] Task 8.4: Проверить hot path.
  Комментарий: профиль берет initial social snapshot из profile response, списки не делают social запросы.

- [x] Task 8.5: Запустить Flutter проверки.
  Комментарий: пройдены `flutter analyze`, targeted tests и полный `cd mobile && flutter test`.

- [x] Task 8.6: Запустить backend проверки.
  Комментарий: пройдены unit tests через `pnpm --filter @big-break/api test:unit -- people.service.unit.spec.ts chats.service.unit.spec.ts` и `pnpm --filter @big-break/api build`.

## Phase 9: AI context and graph

- [x] Task 9.1: Обновить `ai-context/database.md`.
  Комментарий: добавлены `UserFollow`, `ProfileReaction`, hot path индексы и отличие от `DatingAction`.

- [x] Task 9.2: Обновить `ai-context/backend-api.md`.
  Комментарий: добавлены people social endpoints и ticket summary для meetup chat.

- [x] Task 9.3: Обновить `ai-context/frontend-flutter.md`.
  Комментарий: добавлены `BbSocialActions`, `profileSocialProvider`, ticket block и новый banner style.

- [x] Task 9.4: Обновить Understand graph.
  Комментарий: `bash scripts/update-understand-graph.sh` упал из-за CRLF в shell-файле. Граф обновлен напрямую через `node scripts/update-understand-graph.mjs`, проанализировано 596 файлов, warnings 0.

## Acceptance checklist

- [x] В Flutter профиль показывает counts и три кнопки как front.
  Комментарий: `UserProfileScreen` показывает followers, likes, super-likes и кнопки follow, like, super-like.

- [x] Follow, like, super-like сохраняются на backend.
  Комментарий: реализованы таблицы, endpoints и repository методы. Проверено backend unit tests.

- [x] Counts не прыгают после refresh.
  Комментарий: после action Flutter принимает snapshot от backend, профиль стартует с snapshot из `GET /people/:userId`.

- [x] Announcement banner совпадает с новым карточным стилем.
  Комментарий: карточка, stripe, icon tile и CTA arrow перенесены в `bb_system_overlays.dart`.

- [x] Meetup chat показывает ticket block только для платной афиши.
  Комментарий: block показывается для paid Poster и paid Affiche, free/unknown отсекаются.
  Должно работать для paid legacy `Poster` и paid public `Affiche`.

- [x] Ticket block открывает внешний provider.
  Комментарий: используется существующий external ticket action через `url_launcher`.

- [x] Backend tests проходят.
  Комментарий: unit tests и API build прошли.

- [x] Flutter tests проходят.
  Комментарий: `flutter analyze`, targeted tests и полный `flutter test` прошли.

- [x] Граф обновлен.
  Комментарий: direct Node update прошел, `.understand-anything/knowledge-graph.json` обновлен.
