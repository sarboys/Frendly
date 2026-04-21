import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import { buildMessageNotificationBatch } from '../../src/chat-notification-batch';

describe('buildMessageNotificationBatch', () => {
  it('builds batched notifications, outbox payloads and realtime payloads for recipients', () => {
    const now = new Date('2026-04-21T12:30:00.000Z');
    const ids = ['notification-1', 'notification-2'];
    let index = 0;

    const result = buildMessageNotificationBatch({
      recipientUserIds: ['user-anya', 'user-sonya'],
      actorUserId: 'user-me',
      chatId: 'mc1',
      messageId: 'm100',
      body: 'Привет всем',
      now,
      createId: () => ids[index++]!,
    });

    expect(result.notifications).toEqual([
      {
        id: 'notification-1',
        userId: 'user-anya',
        actorUserId: 'user-me',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Привет всем',
        chatId: 'mc1',
        messageId: 'm100',
        payload: {
          chatId: 'mc1',
          messageId: 'm100',
        },
        readAt: null,
        createdAt: now,
      },
      {
        id: 'notification-2',
        userId: 'user-sonya',
        actorUserId: 'user-me',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Привет всем',
        chatId: 'mc1',
        messageId: 'm100',
        payload: {
          chatId: 'mc1',
          messageId: 'm100',
        },
        readAt: null,
        createdAt: now,
      },
    ]);

    expect(result.outboxEvents).toEqual([
      {
        type: OUTBOX_EVENT_TYPES.pushDispatch,
        payload: {
          userId: 'user-anya',
          notificationId: 'notification-1',
        },
      },
      {
        type: OUTBOX_EVENT_TYPES.pushDispatch,
        payload: {
          userId: 'user-sonya',
          notificationId: 'notification-2',
        },
      },
    ]);

    expect(result.realtimeEvents).toEqual([
      {
        userId: 'user-anya',
        notificationId: 'notification-1',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Привет всем',
        payload: {
          chatId: 'mc1',
          messageId: 'm100',
        },
        createdAt: '2026-04-21T12:30:00.000Z',
        readAt: null,
      },
      {
        userId: 'user-sonya',
        notificationId: 'notification-2',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Привет всем',
        payload: {
          chatId: 'mc1',
          messageId: 'm100',
        },
        createdAt: '2026-04-21T12:30:00.000Z',
        readAt: null,
      },
    ]);
  });
});
