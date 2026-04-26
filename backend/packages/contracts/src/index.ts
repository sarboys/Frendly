export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  lastEventId?: string | null;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export type EventFilter = 'nearby' | 'now' | 'calm' | 'newcomers' | 'date';
export type EventLifestyleFilter = 'any' | 'zozh' | 'neutral' | 'anti';
export type EventPriceFilter = 'any' | 'free' | 'cheap' | 'mid' | 'premium';
export type EventGenderFilter = 'any' | 'male' | 'female';
export type EventAccessFilter = 'any' | 'open' | 'request' | 'free';

export interface DevLoginRequest {
  userId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type TelegramDispatchKind = 'start' | 'contact';

export interface TelegramDispatchRequest {
  kind: TelegramDispatchKind;
  telegramUserId: string;
  chatId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  startToken?: string;
  startPayload?: string;
}

export interface TelegramDispatchAction {
  type: 'send_message';
  text: string;
  replyMarkup?: Record<string, unknown>;
}

export interface TelegramDispatchResponse {
  actions: TelegramDispatchAction[];
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
}

export interface UploadCompleteResponse {
  assetId: string;
  status: 'pending' | 'ready' | 'failed';
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  text: string;
  clientMessageId: string;
  createdAt: string;
  eventId?: string;
  replyTo?: ReplyPreviewDto | null;
  attachments: MediaAssetDto[];
}

export interface ReplyPreviewDto {
  id: string;
  author: string;
  text: string;
  isVoice: boolean;
}

export type MediaKind =
  | 'avatar'
  | 'chat_attachment'
  | 'chat_voice'
  | 'story_media'
  | 'poster_cover';
export type MediaVisibility = 'public' | 'private';

export interface MediaVariantDto {
  url: string | null;
  downloadUrl: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  cacheKey?: string | null;
  expiresAt?: string | null;
}

export interface MediaResourceDto {
  id: string;
  kind: MediaKind;
  visibility: MediaVisibility;
  mimeType: string;
  byteSize: number;
  url: string | null;
  downloadUrl: string | null;
  variants: Record<string, MediaVariantDto>;
  durationMs: number | null;
  previewHash: string | null;
  cacheKey: string;
  expiresAt: string | null;
}

export interface MediaAssetDto extends MediaResourceDto {
  status: 'pending' | 'ready' | 'failed';
  fileName: string;
  waveform: number[];
}

export interface WsClientEventMap {
  'session.authenticate': { accessToken: string };
  'chat.subscribe': { chatId: string };
  'chat.unsubscribe': { chatId: string };
  'message.send': {
    chatId: string;
    text: string;
    clientMessageId: string;
    attachmentIds?: string[];
    replyToMessageId?: string;
  };
  'message.edit': {
    chatId: string;
    messageId: string;
    text: string;
  };
  'message.delete': { chatId: string; messageId: string };
  'message.read': { chatId: string; messageId: string };
  'typing.start': { chatId: string };
  'typing.stop': { chatId: string };
  'sync.request': { chatId: string; sinceEventId?: string };
}

export interface WsServerEventMap {
  'session.authenticated': { userId: string };
  'message.created': ChatMessageDto;
  'message.updated': ChatMessageDto;
  'message.deleted': {
    chatId: string;
    messageId: string;
    senderId: string;
    clientMessageId: string;
  };
  'message.attachment_ready': { chatId: string; assetId: string };
  'message.read': { chatId: string; userId: string; messageId: string; readAt: string };
  'typing.changed': { chatId: string; userId: string; isTyping: boolean };
  'chat.updated': { chatId: string };
  'unread.updated': { chatId: string; unreadCount: number };
  'notification.created': {
    userId: string;
    notificationId: string;
    kind: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
  };
  'sync.snapshot': {
    chatId: string;
    sinceEventId?: string;
    reset?: boolean;
    hasMore?: boolean;
    nextEventId?: string | null;
    events: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  };
}
