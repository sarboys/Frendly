# Audit Remediation Decisions

## 2026-04-21, Auth dev and OTP gating

**Вопрос**

Как закрыть обходы авторизации, если в коде были публичный `dev login` и локальный OTP stub без реального delivery provider.

**Выбранное решение**

`POST /auth/dev/login` работает только при `ENABLE_DEV_AUTH=true` и только вне production.

Phone OTP работает только при `ENABLE_DEV_OTP=true` и только вне production. В остальном backend отвечает `503 phone_auth_unavailable`.

**Почему**

Это самый безопасный fail-closed вариант. Он убирает фальшивый продовый логин, не притворяется рабочей SMS аутентификацией, не оставляет дыру на случай забытых флагов.

**Какие пункты аудита это закрывает**

- публичный dev login
- статичный OTP код
- `localCodeHint` вне dev
- повторное использование OTP challenge
- параллельный refresh token consume

**Какие контракты или экраны это затронуло**

- `POST /auth/dev/login`
- `POST /auth/phone/request`
- `POST /auth/phone/verify`
- `WelcomeScreen`
- `PhoneAuthScreen`

## 2026-04-21, Billing mock baseline

**Вопрос**

Что делать с подпиской, если store proof, receipt validation, Apple and Google sandbox и webhook reconciliation не входят в этот прогон.

**Выбранное решение**

`POST /subscription/subscribe` и `POST /subscription/restore` считаются временным mock billing flow.

Обычный `PaywallScreen` и `AfterDarkPaywallScreen` используют один и тот же mock subscribe and restore path.

**Почему**

Store receipts and sandbox еще не интегрированы, но внутри этого репозитория уже появился новый подписочный сценарий After Dark. Чтобы не держать два противоречащих paywall, выбран единый mock billing baseline до отдельной store integration.

**Какие пункты аудита это закрывает**

- единый временный mock subscribe flow для всех paywall
- консистентность между обычным paywall и After Dark paywall

**Какие контракты или экраны это затронуло**

- `POST /subscription/subscribe`
- `POST /subscription/restore`
- `GET /subscription/me`
- `PaywallScreen`
- `AfterDarkPaywallScreen`

## 2026-04-21, Media access by asset kind

**Вопрос**

Как сохранить публичные аватары через `/media/:assetId`, не оставив публичный доступ к chat attachments и voice.

**Выбранное решение**

`avatar` assets остаются публичными.

`chat_attachment` и `chat_voice` требуют bearer token и проверку owner or chat membership.

**Почему**

Так приватные вложения перестают течь наружу, а публичные профильные картинки не ломают существующий UI path.

**Какие пункты аудита это закрывает**

- публичный доступ к приватным media assets
- IDOR на chat attachments and voice
- приватность чатов и голосовых

**Какие контракты или экраны это затронуло**

- `GET /media/:assetId`
- все mobile и backend места, которые читают avatar and chat media proxy URL

## 2026-04-21, SOS fail-closed

**Вопрос**

Что делать с SOS, если trusted contacts не привязаны к реальному SMS or call delivery, а worker раньше просто не умел обработать outbox event.

**Выбранное решение**

В этом прогоне SOS переведен в fail-closed. Backend отвечает `503 sos_delivery_unavailable` вместо ложного `ok`.

Mobile показывает явную ошибку вместо оптимистичного `SOS отправлен`.

**Почему**

Фальшивый успех в SOS хуже честной недоступности. Пользователь не должен думать, что кого-то реально уведомили, если этого не произошло.

**Какие пункты аудита это закрывает**

- SOS outbox event без обработчика
- optimistic fake success в mobile live meetup and safety hub

**Какие контракты или экраны это затронуло**

- `POST /safety/sos`
- `SafetyHubScreen`
- `LiveMeetupScreen`

## 2026-04-21, Push settings fail-closed

**Вопрос**

Как обрабатывать `allowPush`, если в текущем коде нет реального FCM or APNS token provider и нельзя честно подтвердить device registration runtime-прогоном.

**Выбранное решение**

Добавлен отдельный push token service abstraction. Текущая реализация возвращает `null`, из-за этого `allowPush` не включается без реального device token и backend registration.

UI показывает, что push пока недоступны в этом билде.

**Почему**

Это соблюдает требование не считать push включенными без зарегистрированного device token. При этом кодовая точка интеграции теперь есть.

**Какие пункты аудита это закрывает**

- `allowPush` без реальной device registration
- ложное сохранение push enable state

**Какие контракты или экраны это затронуло**

- `POST /push-tokens`
- `PermissionsScreen`
- `SettingsScreen`
- logout cleanup

## 2026-04-22, Privacy settings applied strictly

**Вопрос**

Как трактовать `discoverable` и `showAge`, если раньше они почти не влияли на API и часть сценариев можно было читать по прямому `userId`.

**Выбранное решение**

Если `discoverable=false`, пользователь пропадает из people discovery, public profile lookup и matches.

Если `showAge=false`, возраст не отдается наружу даже когда профиль доступен.

**Почему**

Это самый безопасный вариант. Настройки приватности начинают реально работать, а не остаются декоративными флагами.

**Какие пункты аудита это закрывает**

- privacy settings в people API
- privacy settings в public profile
- privacy settings в matches

**Какие контракты или экраны это затронуло**

- `GET /people`
- `GET /people/:userId`
- `GET /matches`

## 2026-04-22, Dedupe for reports and trusted contacts

**Вопрос**

Как закрыть спам duplicate reports и накрутку trusted contacts без отдельной moderation подсистемы.

**Выбранное решение**

Открытый report на ту же цель больше нельзя создать повторно.

Trusted contact с тем же номером у того же пользователя тоже нельзя создать повторно.

**Почему**

Это минимальная и надежная защита от спама и от искусственного раздувания trust score.

**Какие пункты аудита это закрывает**

- duplicate reports
- duplicate trusted contacts
- лишние сырые поля в reports and blocks DTO

**Какие контракты или экраны это затронуло**

- `POST /reports`
- `GET /reports/me`
- `POST /safety/trusted-contacts`
- `GET /blocks`

## 2026-04-22, Onboarding guard after restart

**Вопрос**

Как не пускать пользователя в `Tonight` после рестарта, если onboarding еще не завершен, а отдельного server-side флага завершенности нет.

**Выбранное решение**

Router теперь использует completeness check по onboarding данным. Если нет `intent`, `city`, `area`, `vibe` или выбрано меньше двух `interests`, authenticated пользователь редиректится на `Onboarding`.

**Почему**

Это минимальный и проверяемый критерий. Он не придумывает новый backend contract, но реально блокирует обход remaining setup после рестарта.

**Какие пункты аудита это закрывает**

- router не проверяет завершенность onboarding
- bypass remaining setup после restart

**Какие контракты или экраны это затронуло**

- `buildAppRouter`
- `BigBreakRoot`
- `OnboardingScreen`

## 2026-04-22, Worker stale processing recovery

**Вопрос**

Как восстанавливать outbox jobs, которые навсегда зависли в `processing` после падения worker instance.

**Выбранное решение**

Worker теперь считает `processing` job протухшей, если `lockedAt` старше lease timeout. Такая job может быть снова claimed и обработана повторно.

**Почему**

Это закрывает очевидный stuck state без дополнительной инфраструктуры leader election. Для текущей архитектуры это самый прямой путь.

**Какие пункты аудита это закрывает**

- stuck outbox jobs в `processing`
- отсутствие recovery после падения worker

**Какие контракты или экраны это затронуло**

- `WorkerService.claimNextEvent`
- unit tests worker

## 2026-04-22, Join request reopen policy

**Вопрос**

Что делать с повторным открытием той же join request после `canceled` или `rejected`, если отдельного anti-spam сценария в продукте нет.

**Выбранное решение**

Повторное открытие через тот же endpoint запрещено. После любого непредикатного финального статуса backend отвечает `409 join_request_already_reviewed`.

**Почему**

Это safest default. Он убирает спам по хосту и не вводит новый retry flow без отдельного UX.

**Какие пункты аудита это закрывает**

- reopen canceled or rejected join request
- отсутствие server-side лимита на note

**Какие контракты или экраны это затронуло**

- `POST /events/:eventId/join-request`
- `JoinRequestScreen`

## 2026-04-22, Event time and map source of truth

**Вопрос**

Как убрать фейковые карты и разъехавшуюся временную логику, если mobile раньше жил на hardcoded map points и display string времени.

**Выбранное решение**

Event payload получил стабильные поля `startsAtIso`, `latitude` и `longitude`.

`MapScreen`, `CheckInScreen` и `HostDashboardScreen` используют только эти поля. Если координат нет, pin не рисуется и дистанция не выдумывается.

**Почему**

Это убирает ложную геометрию и делает время пригодным для клиентской логики без парсинга UI строки.

**Какие пункты аудита это закрывает**

- hardcoded event points на карте
- фейковая дистанция в check in
- split upcoming and past по display string

**Какие контракты или экраны это затронуло**

- `GET /events`
- `GET /events/:eventId`
- `GET /events/:eventId/check-in`
- `MapScreen`
- `CheckInScreen`
- `HostDashboardScreen`

## 2026-04-22, Heavy lists use page-first cursors

**Вопрос**

Как закрыть тяжелые списки, которые раньше грузили весь набор в память и только потом резали его курсором.

**Выбранное решение**

`people`, `chats`, `matches`, `host dashboard` и `after-dark/events` переведены на page first выборку.

Сначала из базы берется страница по стабильному cursor order, потом гидратится только эта страница.

**Почему**

Это минимальный способ убрать full materialize, не ломая экранные контракты сильнее, чем уже нужно по аудиту.

**Какие пункты аудита это закрывает**

- in memory pagination на тяжелых list endpoint
- нестабильный cursor order
- лишняя нагрузка на `people`, `chats`, `matches`, `host dashboard`, `after-dark/events`

**Какие контракты или экраны это затронуло**

- `GET /people`
- `GET /chats/meetups`
- `GET /chats/personal`
- `GET /matches`
- `GET /host/dashboard`
- `GET /after-dark/events`

## 2026-04-22, No fake copy in discovery and match surfaces

**Вопрос**

Как поступить с блоками discovery and compatibility, если часть subtitle и trait rows раньше подставлялась без реальных данных.

**Выбранное решение**

`SearchScreen` и `MatchScreen` показывают только поля, которые реально пришли из backend. Пустые значения скрываются, а не заменяются фейковым текстом.

**Почему**

Это сохраняет экран честным. Пользователь видит только подтвержденные общие интересы, район и вайб.

**Какие пункты аудита это закрывает**

- выдуманные `3 общих встречи`
- фейковые trait rows в compatibility block

**Какие контракты или экраны это затронуло**

- `GET /people`
- `GET /matches`
- `SearchScreen`
- `MatchScreen`
