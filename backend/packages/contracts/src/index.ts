export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export type EventFilter = 'nearby' | 'now' | 'calm' | 'newcomers' | 'date';

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
  attachments: MediaAssetDto[];
}

export interface MediaAssetDto {
  id: string;
  kind: 'avatar' | 'chat_attachment';
  status: 'pending' | 'ready' | 'failed';
  url: string | null;
  mimeType: string;
  byteSize: number;
  fileName: string;
}

export interface WsClientEventMap {
  'session.authenticate': { accessToken: string };
  'chat.subscribe': { chatId: string };
  'chat.unsubscribe': { chatId: string };
  'message.send': { chatId: string; text: string; clientMessageId: string; attachmentIds?: string[] };
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
  'notification.created': { notificationId: string; kind: string };
  'sync.snapshot': { chatId: string; sinceEventId?: string; events: Array<{ id: string; type: string; payload: unknown; createdAt: string }> };
}
