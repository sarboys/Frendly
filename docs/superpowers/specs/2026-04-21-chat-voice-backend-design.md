# Chat Voice Backend Design

**Goal**

Добавить в текущий backend поддержку голосовых сообщений в чате быстро, без новой подсистемы доставки, без тяжелой серверной обработки аудио, с нормальным запасом под следующий этап.

**Problem**

Сейчас backend умеет только текстовые сообщения и обычные `chat_attachment`.

Этого уже мало для voice:
- `message.send` требует непустой `text`
- список чатов берет preview из `lastMessage.text`
- push и in-app notification тоже берут body из `text`
- `MediaAssetDto` не хранит длительность записи

Параллельно в `front/` уже появился новый voice UI:
- [VoiceMessage.tsx](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/VoiceMessage.tsx)
- [VoiceRecorder.tsx](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/VoiceRecorder.tsx)
- [data.ts](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/data.ts)
- [MeetupChat.tsx](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/screens/MeetupChat.tsx)
- [PersonalChat.tsx](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/screens/PersonalChat.tsx)

Этот UI ожидает:
- отдельный тип voice сообщения
- обязательную длительность
- waveform как необязательное улучшение

**Requirements**

- Голосовое должно ехать через текущий pipeline чата.
- Новый backend не должен вводить отдельный voice transport.
- Голосовое сообщение должно отправляться как обычное chat message с `attachmentIds`.
- Текст у voice сообщения может быть пустым.
- Сервер должен хранить `durationMs` уже в MVP.
- Сервер не обязан хранить waveform в MVP.
- Список чатов и уведомления не должны показывать пустой preview для voice.
- Все текущие file attachment сценарии должны продолжить работать без регрессий.

**Decision**

Берем вариант 2.

Voice живет как отдельный `MediaAssetKind`, например `chat_voice`, внутри уже существующего контура:
- `media_assets`
- `message_attachments`
- `/uploads/chat-attachment/*`
- `message.send`
- `message.created`

Новый отдельный сервис для voice не создаем.

**MVP Scope**

Входит:
- загрузка voice файла через текущие upload endpoints
- явный `kind=chat_voice`
- хранение `durationMs`
- привязка voice asset к сообщению через `attachmentIds`
- отправка сообщения без текста, если есть voice attachment
- корректный ответ из REST и WebSocket с `kind`, `mimeType`, `byteSize`, `fileName`, `url`, `durationMs`
- fallback preview `Голосовое сообщение` для chat list и notification body
- валидация membership, ownership, audio mime, размера и длительности

Не входит:
- waveform preprocessing
- транскрибация
- асинхронная обработка через worker
- серверная перекодировка
- шумодав
- нормализация громкости
- приватные signed download URL
- аналитика и антиспам для voice

**Architecture**

Схема остается прежней:

1. Клиент грузит файл через `/uploads/chat-attachment/file` или через presigned flow.
2. Клиент передает `chatId`.
3. Для voice клиент передает `kind=chat_voice`.
4. Для voice клиент передает `durationMs`.
5. `UploadsService` валидирует payload и создает `MediaAsset`.
6. Клиент отправляет `message.send` с `attachmentIds`.
7. `ChatServerService` создает сообщение, публикует realtime event и уведомления.
8. `ChatsService` и presenter отдают message payload без отдельной voice ветки.

Главный принцип по скорости:
- не трогаем transport
- не трогаем Redis/pubsub схему
- не трогаем worker
- не декодируем аудио на сервере
- не добавляем новую таблицу под voice

**Data Model**

Нужны два изменения Prisma:

1. В `MediaAssetKind` добавить:

```prisma
enum MediaAssetKind {
  avatar
  chat_attachment
  chat_voice
}
```

2. В `MediaAsset` добавить:

```prisma
durationMs Int?
```

Почему не отдельная таблица:
- для MVP это лишняя сложность
- текущая связка `Message -> MessageAttachment -> MediaAsset` уже закрывает задачу
- nullable `durationMs` дешевле по миграции и хорошо ложится на будущий voice-only рендер

Почему не добавляем waveform сейчас:
- backend без него уже функционален
- `front` умеет рисовать fallback bars
- хранение waveform сейчас добавит формат, размер и источник правды, это не нужно для первого этапа

**API Contract**

Текущие upload routes сохраняем:
- `POST /uploads/chat-attachment/file`
- `POST /uploads/chat-attachment/upload-url`
- `POST /uploads/chat-attachment/complete`

Меняется request body:
- `chatId: string`, как и раньше
- `kind?: 'chat_attachment' | 'chat_voice'`
- `durationMs?: number`, только для `chat_voice`

Правила:
- если `kind` не передан, по умолчанию `chat_attachment`
- для `chat_attachment` `durationMs` игнорируется
- для `chat_voice` `durationMs` обязателен

Меняется response shape для media asset:

```ts
export interface MediaAssetDto {
  id: string;
  kind: 'avatar' | 'chat_attachment' | 'chat_voice';
  status: 'pending' | 'ready' | 'failed';
  url: string | null;
  mimeType: string;
  byteSize: number;
  fileName: string;
  durationMs: number | null;
}
```

**WebSocket Contract**

Событие `message.send` не получает новый transport type.

Остается тот же event:

```ts
'message.send': {
  chatId: string;
  text: string;
  clientMessageId: string;
  attachmentIds?: string[];
}
```

Меняется только серверное правило:
- пустой `text` допустим, если есть хотя бы один `attachmentId`
- полностью пустое сообщение, без текста и без вложений, запрещено

Это важно для нового `front`, потому что там voice bubbles уже идут как message с пустым `text`.

**Validation**

Для `chat_voice` backend проверяет:
- `mimeType` начинается с `audio/`
- `durationMs` больше `0`
- `durationMs` не больше верхнего лимита MVP
- `byteSize` не больше верхнего лимита MVP
- asset принадлежит тому же `chatId`
- asset принадлежит текущему user

Рекомендованные лимиты MVP:
- `MAX_CHAT_VOICE_DURATION_MS = 180000`
- `MAX_CHAT_VOICE_BYTES = 8 * 1024 * 1024`

Этого достаточно для коротких голосовых, без риска раздувать чат.

Для обычных вложений сохраняем текущую схему.

**Preview Rules**

Для message preview добавляем один общий helper.

Если:
- `text.trim()` не пустой, показываем текст
- текст пустой, но есть `chat_voice`, показываем `Голосовое сообщение`
- текст пустой, но есть обычный `chat_attachment`, показываем `Вложение`

Этот helper нужен в двух местах:
- `ChatsService.listChats`
- `ChatServerService`, при создании notification body

Так список чатов, уведомления и unread сценарии остаются читаемыми.

**Performance Rules**

- Никакого server-side audio decoding в MVP.
- Никакого waveform extraction.
- Никакого background job.
- Никакого нового websocket event type.
- Никакой новой таблицы под voice message.
- Никаких дополнительных запросов к БД ради preview, используем уже загруженные attachments.

Это решение почти не меняет горячий путь чата.

Самая заметная нагрузка будет не на chat server, а на storage и сеть. Для коротких голосовых это нормально.

**Error Handling**

Нужны явные ошибки:
- `invalid_chat_attachment_kind`
- `invalid_chat_voice_mime_type`
- `invalid_chat_voice_duration`
- `chat_voice_too_large`
- `message_payload_empty`

Текущие ошибки сохраняются:
- `chat_attachment_forbidden`
- `chat_id_required`
- `attachment_chat_mismatch`

**Testing**

Обязательные тесты:
- integration test на upload voice file
- integration test на upload completion для voice metadata
- realtime test на `message.send` с пустым text и voice attachment
- realtime test на `message.created`, где `kind === 'chat_voice'`
- integration test на chat list preview fallback
- realtime test на notification body fallback
- regression test на обычный `chat_attachment`

**Frontend Alignment**

Новый `front` уже задает нужный визуальный контракт.

Что backend должен дать сразу:
- `kind=chat_voice`
- `url`
- `durationMs`

Что backend пока не обязан давать:
- waveform

Почему это ок:
- [VoiceMessage.tsx](/Users/sergeypolyakov/MyApp/front/src/components/bigbreak/VoiceMessage.tsx) уже имеет `defaultWave`
- для входящих голосовых достаточно `duration`
- waveform можно добавить вторым этапом, не ломая контракт

**Future Work**

Следующим этапом остаются:
- `waveform` в ответе сервера
- транскрибация voice
- async processing через `worker`
- storage политики для приватных voice URL
- лимиты по количеству и частоте voice messages
- модерация и abuse protection
- аналитика по прослушиванию
- server-side transcoding в единый формат, если это реально понадобится

**Acceptance**

- Voice asset можно загрузить в чат через текущие upload endpoints.
- `MediaAsset.kind` умеет `chat_voice`.
- `MediaAssetDto` возвращает `durationMs`.
- Voice message можно отправить с пустым `text`.
- `message.created` возвращает `chat_voice` attachment.
- Chat list не показывает пустой preview для voice.
- Notification body не пустой для voice.
- Обычные file attachment сценарии не ломаются.
- В hot path чата не появляется новая тяжелая обработка.
