DROP INDEX IF EXISTS "OutboxEvent_status_availableAt_createdAt_idx";
DROP INDEX IF EXISTS "OutboxEvent_status_lockedAt_idx";

ALTER TABLE "OutboxEvent" SET (
  autovacuum_vacuum_scale_factor = 0.005,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_analyze_threshold = 1000,
  autovacuum_vacuum_cost_limit = 1000,
  autovacuum_vacuum_cost_delay = 1
);
