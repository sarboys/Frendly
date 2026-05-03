CREATE INDEX IF NOT EXISTS "DatingAction_actor_action_updatedAt_target_idx"
ON "DatingAction"("actorUserId", "action", "updatedAt" DESC, "targetUserId");

CREATE INDEX IF NOT EXISTS "DatingAction_target_action_actor_idx"
ON "DatingAction"("targetUserId", "action", "actorUserId");
