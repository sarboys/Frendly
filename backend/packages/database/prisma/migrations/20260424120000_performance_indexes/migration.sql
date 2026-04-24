CREATE INDEX IF NOT EXISTS "UserBlock_blockedUserId_userId_idx"
ON "UserBlock"("blockedUserId", "userId");

CREATE INDEX IF NOT EXISTS "UserSubscription_userId_status_renewsAt_idx"
ON "UserSubscription"("userId", "status", "renewsAt");

CREATE INDEX IF NOT EXISTS "UserSubscription_userId_status_trialEndsAt_idx"
ON "UserSubscription"("userId", "status", "trialEndsAt");

CREATE INDEX IF NOT EXISTS "Chat_kind_updatedAt_id_idx"
ON "Chat"("kind", "updatedAt", "id");

CREATE INDEX IF NOT EXISTS "MessageAttachment_mediaAssetId_idx"
ON "MessageAttachment"("mediaAssetId");

CREATE INDEX IF NOT EXISTS "MediaAsset_chatId_kind_status_idx"
ON "MediaAsset"("chatId", "kind", "status");

CREATE INDEX IF NOT EXISTS "PushToken_userId_disabledAt_idx"
ON "PushToken"("userId", "disabledAt");

CREATE INDEX IF NOT EXISTS "OutboxEvent_status_availableAt_createdAt_idx"
ON "OutboxEvent"("status", "availableAt", "createdAt");

CREATE INDEX IF NOT EXISTS "OutboxEvent_status_lockedAt_idx"
ON "OutboxEvent"("status", "lockedAt");
