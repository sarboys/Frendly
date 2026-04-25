ALTER TYPE "NotificationKind" ADD VALUE 'event_invite';
ALTER TYPE "NotificationKind" ADD VALUE 'event_starting';
ALTER TYPE "NotificationKind" ADD VALUE 'subscription_expiring';

ALTER TABLE "Notification"
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key"
ON "Notification"("dedupeKey");

UPDATE "ChatMember" cm
SET "lastReadAt" = m."createdAt"
FROM "Message" m
WHERE cm."lastReadAt" IS NULL
  AND cm."lastReadMessageId" = m."id"
  AND cm."chatId" = m."chatId";
