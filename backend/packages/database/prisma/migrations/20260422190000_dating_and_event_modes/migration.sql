ALTER TYPE "EventPriceMode" ADD VALUE IF NOT EXISTS 'host_pays';
ALTER TYPE "EventPriceMode" ADD VALUE IF NOT EXISTS 'fifty_fifty';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'DatingActionKind'
  ) THEN
    CREATE TYPE "DatingActionKind" AS ENUM ('pass', 'like', 'super_like');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DatingAction" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" "DatingActionKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DatingAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DatingAction_actorUserId_targetUserId_key"
  ON "DatingAction"("actorUserId", "targetUserId");

CREATE INDEX IF NOT EXISTS "DatingAction_targetUserId_action_createdAt_idx"
  ON "DatingAction"("targetUserId", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "DatingAction_actorUserId_action_createdAt_idx"
  ON "DatingAction"("actorUserId", "action", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'DatingAction_actorUserId_fkey'
      AND table_name = 'DatingAction'
  ) THEN
    ALTER TABLE "DatingAction"
      ADD CONSTRAINT "DatingAction_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'DatingAction_targetUserId_fkey'
      AND table_name = 'DatingAction'
  ) THEN
    ALTER TABLE "DatingAction"
      ADD CONSTRAINT "DatingAction_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
