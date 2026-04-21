UPDATE "Notification"
SET
  "chatId" = COALESCE("chatId", "payload"->>'chatId'),
  "messageId" = COALESCE("messageId", "payload"->>'messageId')
WHERE "kind" = 'message';
