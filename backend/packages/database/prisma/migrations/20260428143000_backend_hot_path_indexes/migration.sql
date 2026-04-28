CREATE INDEX "EveningSessionJoinRequest_sessionId_status_createdAt_id_idx"
ON "EveningSessionJoinRequest"("sessionId", "status", "createdAt", "id");

CREATE INDEX "DatingAction_targetUserId_action_actorUserId_idx"
ON "DatingAction"("targetUserId", "action", "actorUserId");
