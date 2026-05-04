ALTER TABLE "GeneratedRouteDraftBatch"
  DROP CONSTRAINT IF EXISTS "GeneratedRouteDraftBatch_status_check";

ALTER TABLE "GeneratedRouteDraftBatch"
  ADD CONSTRAINT "GeneratedRouteDraftBatch_status_check"
  CHECK ("status" IN ('pending_manual', 'running', 'completed', 'failed'));
