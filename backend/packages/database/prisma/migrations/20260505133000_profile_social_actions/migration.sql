CREATE TYPE "ProfileReactionKind" AS ENUM ('like', 'super_like');

CREATE TABLE "UserFollow" (
  "id" TEXT NOT NULL,
  "followerUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileReaction" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "kind" "ProfileReactionKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfileReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFollow_followerUserId_targetUserId_key"
  ON "UserFollow"("followerUserId", "targetUserId");

CREATE INDEX "UserFollow_targetUserId_createdAt_idx"
  ON "UserFollow"("targetUserId", "createdAt");

CREATE INDEX "UserFollow_followerUserId_createdAt_idx"
  ON "UserFollow"("followerUserId", "createdAt");

CREATE UNIQUE INDEX "ProfileReaction_actorUserId_targetUserId_kind_key"
  ON "ProfileReaction"("actorUserId", "targetUserId", "kind");

CREATE INDEX "ProfileReaction_targetUserId_kind_createdAt_idx"
  ON "ProfileReaction"("targetUserId", "kind", "createdAt");

CREATE INDEX "ProfileReaction_actorUserId_targetUserId_idx"
  ON "ProfileReaction"("actorUserId", "targetUserId");

ALTER TABLE "UserFollow"
  ADD CONSTRAINT "UserFollow_followerUserId_fkey"
  FOREIGN KEY ("followerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFollow"
  ADD CONSTRAINT "UserFollow_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileReaction"
  ADD CONSTRAINT "ProfileReaction_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileReaction"
  ADD CONSTRAINT "ProfileReaction_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
