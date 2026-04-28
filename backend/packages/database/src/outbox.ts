export const OUTBOX_EVENT_TYPES = {
  mediaFinalize: 'media.finalize',
  pushDispatch: 'push.dispatch',
  unreadFanout: 'unread.fanout',
  chatUnreadFanout: 'chat.unread_fanout',
  messageNotificationFanout: 'message.notification_fanout',
  notificationCreate: 'notification.create',
  realtimePublish: 'realtime.publish',
  attachmentReady: 'attachment.ready',
  safetySosDelivery: 'safety.sos_delivery',
} as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];
