WITH ranked_push_tokens AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "deviceId"
      ORDER BY ("disabledAt" IS NULL) DESC, "updatedAt" DESC, "id" DESC
    ) AS row_number
  FROM "PushToken"
  WHERE "deviceId" IS NOT NULL
)
DELETE FROM "PushToken"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_push_tokens
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_userId_deviceId_unique_idx"
ON "PushToken"("userId", "deviceId")
WHERE "deviceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PushToken_userId_disabledAt_updatedAt_id_idx"
ON "PushToken"("userId", "disabledAt", "updatedAt" DESC, "id" DESC);
