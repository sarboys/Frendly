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
  'message.read': { chatId: string; messageId: string };
  'typing.start': { chatId: string };
  'typing.stop': { chatId: string };
  'sync.request': { chatId: string; sinceEventId?: string };
}

export interface WsServerEventMap {
  'session.authenticated': { userId: string };
  'message.created': ChatMessageDto;
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
  'sync.snapshot': { chatId: string; sinceEventId?: string; events: Array<{ id: string; type: string; payload: unknown; createdAt: string }> };
}
