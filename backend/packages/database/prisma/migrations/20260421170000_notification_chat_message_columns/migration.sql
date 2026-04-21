ALTER TABLE "Notification"
ADD COLUMN "chatId" TEXT,
ADD COLUMN "messageId" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_userId_kind_readAt_chatId_idx"
ON "Notification"("userId", "kind", "readAt", "chatId");
