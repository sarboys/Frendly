# Partner Portal Design

Дата: 2026-04-29

## Цель

Сделать личный кабинет партнера для `https://partner.frendly.tech/`.

Партнер сам регистрируется через сайт по email и паролю. После регистрации заявка ждет подтверждения команды Frendly. После подтверждения партнер видит только свои данные.

Первый полный релиз покрывает CRUD для вкладок:

- Встречи
- Сообщества
- Афиша
- Фичеринг

## Контекст проекта

В репозитории уже есть `admin/`, отдельное React/Vite приложение.

В `admin/src/admin/portal.ts` уже есть режим `partner`. Он скрывает внутренние разделы, оставляет только партнерские вкладки.

Сейчас эти вкладки используют моковые данные:

- `admin/src/admin/pages/Meetups.tsx`
- `admin/src/admin/pages/Communities.tsx`
- `admin/src/admin/pages/Posters.tsx`
- `admin/src/admin/pages/Featured.tsx`

Реальный admin API сейчас есть только для `/admin/evening/*`. Он подходит для внутренней команды, но не подходит для личного кабинета партнера, потому что защищен admin token и не имеет scoped доступа партнера.

## Выбранный подход

Используем одно frontend приложение `admin/`, но добавляем отдельный partner режим.

Frontend:

- `VITE_ADMIN_PORTAL=partner` для сборки `partner.frendly.tech`
- отдельные страницы входа, регистрации, ожидания проверки
- вкладки используют `/partner/*` API

Backend:

- отдельный partner auth
- отдельные partner sessions
- отдельный guard для partner routes
- все partner endpoints берут `partnerId` только из сессии

Не используем `/admin/*` для партнерского кабинета.

## Регистрация партнера

Форма регистрации:

- название организации
- ИНН
- город
- контактное лицо
- телефон
- email
- пароль

После отправки создается `PartnerAccount` со статусом `pending`.

ИНН проверяется локально:

- 10 цифр для организации
- 12 цифр для ИП или физлица

Проверку через ФНС не добавляем в первом релизе.

## Модель данных

### PartnerAccount

Новая таблица для входа в партнерский кабинет.

Поля:

- `id`
- `email`, unique
- `passwordHash`
- `status`: `pending`, `approved`, `rejected`, `suspended`
- `partnerId`, nullable до подтверждения
- `organizationName`
- `taxId`
- `city`
- `contactName`
- `phone`
- `role`, default `owner`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

### PartnerSession

Новая таблица для сессий партнеров.

Поля:

- `id`
- `partnerAccountId`
- `refreshTokenId`
- `createdAt`
- `lastUsedAt`
- `revokedAt`

Сессии не смешиваются с мобильными user sessions.

### Partner

В `Partner` добавить:

- `taxId`

При подтверждении заявки `taxId` из `PartnerAccount` копируется в `Partner`.

### Владение объектами

Для scoped CRUD нужны связи с `Partner`.

Добавить:

- `Event.partnerId`
- `Community.partnerId`
- `Poster.partnerId`

Фичеринг:

- новая таблица `PartnerFeaturedRequest`

Поля:

- `id`
- `partnerId`
- `targetType`: `event`, `community`, `poster`
- `targetId`
- `city`
- `placement`
- `title`
- `description`
- `startsAt`
- `endsAt`
- `status`: `draft`, `submitted`, `approved`, `rejected`, `archived`
- `reviewNote`
- `createdAt`
- `updatedAt`

## Auth flow

Endpoints:

- `POST /partner/auth/register`
- `POST /partner/auth/login`
- `POST /partner/auth/refresh`
- `POST /partner/auth/logout`
- `GET /partner/me`

Login behavior:

- `pending`: вход разрешен, frontend показывает экран ожидания
- `approved`: доступ к кабинету
- `rejected`: вход разрешен, frontend показывает причину отказа, если она есть
- `suspended`: доступ закрыт

Пароли:

- хранить только hash
- raw password не логировать
- одинаковый ответ для неверного email и пароля
- refresh token ротировать

## Admin approval flow

В общей админке Frendly нужен раздел заявок партнеров.

Минимальный flow:

1. Команда открывает заявку.
2. Проверяет название, ИНН, город, контакт.
3. Подтверждает заявку.
4. Backend создает новый `Partner` или привязывает заявку к существующему `Partner`.
5. `PartnerAccount.status` становится `approved`.

Отклонение:

- статус `rejected`
- optional review note

Блокировка:

- статус `suspended`
- сессии партнера отзываются

## Partner API

Все endpoints под `/partner/portal/*`.

Guard:

- проверяет partner access token
- находит active `PartnerAccount`
- требует `status=approved` для CRUD
- кладет `partnerAccountId` и `partnerId` в request context

Запрещено принимать `partnerId` из client input.

### Встречи

Endpoints:

- `GET /partner/portal/meetups`
- `POST /partner/portal/meetups`
- `GET /partner/portal/meetups/:id`
- `PATCH /partner/portal/meetups/:id`
- `POST /partner/portal/meetups/:id/cancel`
- `GET /partner/portal/meetups/:id/participants`
- `GET /partner/portal/meetups/:id/join-requests`
- `POST /partner/portal/meetups/:id/join-requests/:requestId/approve`
- `POST /partner/portal/meetups/:id/join-requests/:requestId/reject`

Rules:

- создавать `Event` с `partnerId` из сессии
- редактировать только свои `Event`
- после старта не менять время, capacity, join mode
- отмена вместо удаления
- участники загружаются постранично

### Сообщества

Endpoints:

- `GET /partner/portal/communities`
- `POST /partner/portal/communities`
- `GET /partner/portal/communities/:id`
- `PATCH /partner/portal/communities/:id`
- `POST /partner/portal/communities/:id/archive`
- `POST /partner/portal/communities/:id/news`
- `PATCH /partner/portal/communities/:id/news/:newsId`
- `DELETE /partner/portal/communities/:id/news/:newsId`
- `POST /partner/portal/communities/:id/media`
- `PATCH /partner/portal/communities/:id/media/:mediaId`
- `DELETE /partner/portal/communities/:id/media/:mediaId`

Rules:

- создавать `Community` с `partnerId`
- архив вместо hard delete
- новости, медиа, ссылки доступны только внутри своих community

### Афиша

Endpoints:

- `GET /partner/portal/posters`
- `POST /partner/portal/posters`
- `GET /partner/portal/posters/:id`
- `PATCH /partner/portal/posters/:id`
- `POST /partner/portal/posters/:id/submit`
- `POST /partner/portal/posters/:id/archive`

Rules:

- партнер создает `Poster` со статусом draft
- `submit` отправляет на модерацию
- публикация остается за командой Frendly или за отдельным approved flow
- партнер может снять свой poster с публикации через archive request

### Фичеринг

Endpoints:

- `GET /partner/portal/featured-requests`
- `POST /partner/portal/featured-requests`
- `GET /partner/portal/featured-requests/:id`
- `PATCH /partner/portal/featured-requests/:id`
- `POST /partner/portal/featured-requests/:id/submit`
- `POST /partner/portal/featured-requests/:id/archive`

Rules:

- target должен принадлежать текущему `partnerId`
- партнер не ставит объект в прод фичеринг напрямую
- команда Frendly подтверждает или отклоняет заявку
- approved заявка становится источником для публичного размещения

## Frontend behavior

Partner routes:

- `/login`
- `/register`
- `/pending`
- `/rejected`
- `/`
- `/meetups`
- `/meetups/:id`
- `/communities`
- `/communities/:id`
- `/posters`
- `/featured`

Состояния:

- loading
- empty
- form validation error
- API error
- pending approval
- rejected
- suspended

CRUD формы должны быть короткими. Сложные поля раскрывать только когда нужны.

Списки:

- искать по названию
- фильтровать по статусу
- грузить постранично
- не делать full fetch всех записей партнера

## Производительность

Hot paths:

- открытие кабинета
- список встреч
- список афиши
- список заявок фичеринга
- детали встречи с участниками

Правила:

- списки с `limit` и cursor
- участники встреч отдельно от detail
- counts через aggregate, не через загрузку всех строк
- forms не перезагружают весь кабинет после каждого ввода
- React Query cache для списков и detail

## Ошибки

API возвращает понятные code:

- `partner_auth_required`
- `partner_account_pending`
- `partner_account_rejected`
- `partner_account_suspended`
- `partner_scope_denied`
- `partner_target_not_found`
- `partner_invalid_tax_id`
- `partner_invalid_credentials`

Для `partner_scope_denied` не раскрывать, существует ли чужой объект.

## Тесты

Backend:

- register создает pending account
- duplicate email возвращает ошибку
- invalid tax id отклоняется
- login pending не дает CRUD
- approved partner получает только свои записи
- попытка открыть чужую запись возвращает not found или scope denied
- featured request нельзя создать на чужой target

Frontend:

- partner portal показывает только partner routes
- pending account видит экран ожидания
- login сохраняет tokens
- списки показывают loading, empty, error
- create, update, archive вызывают partner API

## Rollout

Шаг 1:

- DB migration
- backend partner auth
- backend partner guard
- frontend login and register
- pending screen

Шаг 2:

- approval flow в общей админке
- создание и привязка `Partner`

Шаг 3:

- CRUD встреч
- CRUD сообществ
- CRUD афиши
- CRUD заявок фичеринга

Шаг 4:

- тесты
- build
- deploy config для `partner.frendly.tech`

## Не входит в первый релиз

- проверка ИНН через ФНС
- платежи партнера
- роли нескольких сотрудников партнера
- drag and drop порядка публичного фичеринга
- ручная рассылка от партнера
- загрузка тяжелых медиа напрямую из кабинета без shared upload flow

## Критерий готовности

Партнер может:

1. Зарегистрироваться по email, паролю, ИНН.
2. Дождаться подтверждения команды Frendly.
3. Войти в `partner.frendly.tech`.
4. Создать, редактировать, архивировать свои встречи, сообщества, афишу.
5. Создать заявку на фичеринг только для своего объекта.
6. Не увидеть чужие данные даже при ручной подмене id в URL или API запросе.
