UPDATE "Notification"
SET
  "eventId" = COALESCE("eventId", "payload"->>'eventId'),
  "requestId" = COALESCE("requestId", "payload"->>'requestId'),
  "actorUserId" = COALESCE("actorUserId", "payload"->>'userId');

UPDATE "Notification" AS n
SET "actorUserId" = m."senderId"
FROM "Message" AS m
WHERE n."messageId" = m."id"
  AND n."actorUserId" IS NULL;
