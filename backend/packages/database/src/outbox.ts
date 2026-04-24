export const OUTBOX_EVENT_TYPES = {
  mediaFinalize: 'media.finalize',
  pushDispatch: 'push.dispatch',
  unreadFanout: 'unread.fanout',
  notificationCreate: 'notification.create',
  attachmentReady: 'attachment.ready',
} as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];
