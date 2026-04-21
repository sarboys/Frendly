CREATE INDEX IF NOT EXISTS "ChatMember_userId_idx"
ON "ChatMember"("userId");

CREATE INDEX IF NOT EXISTS "Message_chatId_createdAt_id_idx"
ON "Message"("chatId", "createdAt", "id");

CREATE INDEX IF NOT EXISTS "MediaAsset_ownerId_status_chatId_idx"
ON "MediaAsset"("ownerId", "status", "chatId");

CREATE INDEX IF NOT EXISTS "Notification_userId_kind_readAt_idx"
ON "Notification"("userId", "kind", "readAt");
