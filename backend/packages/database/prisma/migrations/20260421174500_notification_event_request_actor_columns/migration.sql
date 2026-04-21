ALTER TABLE "Notification"
ADD COLUMN "eventId" TEXT,
ADD COLUMN "requestId" TEXT,
ADD COLUMN "actorUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_userId_kind_readAt_actorUserId_idx"
ON "Notification"("userId", "kind", "readAt", "actorUserId");

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_eventId_requestId_idx"
ON "Notification"("userId", "readAt", "eventId", "requestId");
