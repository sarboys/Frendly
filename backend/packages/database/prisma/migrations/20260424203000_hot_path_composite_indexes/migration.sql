CREATE INDEX IF NOT EXISTS "EventParticipant_eventId_joinedAt_id_idx"
ON "EventParticipant"("eventId", "joinedAt", "id");

CREATE INDEX IF NOT EXISTS "EventFavorite_sourceUserId_targetUserId_idx"
ON "EventFavorite"("sourceUserId", "targetUserId");

CREATE INDEX IF NOT EXISTS "EventFavorite_targetUserId_sourceUserId_idx"
ON "EventFavorite"("targetUserId", "sourceUserId");

CREATE INDEX IF NOT EXISTS "CommunityMember_communityId_joinedAt_id_idx"
ON "CommunityMember"("communityId", "joinedAt", "id");

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_id_idx"
ON "Notification"("userId", "createdAt", "id");
