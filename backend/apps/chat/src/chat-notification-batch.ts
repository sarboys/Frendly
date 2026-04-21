import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import { randomUUID } from 'node:crypto';

interface BuildMessageNotificationBatchParams {
  recipientUserIds: string[];
  actorUserId: string;
  chatId: string;
  messageId: string;
  body: string;
  now: Date;
  createId?: () => string;
}

export function buildMessageNotificationBatch(
  params: BuildMessageNotificationBatchParams,
) {
  const createId = params.createId ?? randomUUID;
  const createdAt = params.now.toISOString();

  const notifications = params.recipientUserIds.map((userId) => {
    const id = createId();

    return {
      id,
      userId,
      actorUserId: params.actorUserId,
      kind: 'message' as const,
      title: 'Новое сообщение',
      body: params.body,
      chatId: params.chatId,
      messageId: params.messageId,
      payload: {
        chatId: params.chatId,
        messageId: params.messageId,
      },
      readAt: null,
      createdAt: params.now,
    };
  });

  return {
    notifications,
    outboxEvents: notifications.map((notification) => ({
      type: OUTBOX_EVENT_TYPES.pushDispatch,
      payload: {
        userId: notification.userId,
        notificationId: notification.id,
      },
    })),
    realtimeEvents: notifications.map((notification) => ({
      userId: notification.userId,
      notificationId: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
      createdAt,
      readAt: null,
    })),
  };
}
