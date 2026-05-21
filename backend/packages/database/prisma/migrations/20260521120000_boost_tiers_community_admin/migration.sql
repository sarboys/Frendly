ALTER TABLE "Community"
  ADD COLUMN "rules" TEXT;

ALTER TABLE "CommunityNewsItem"
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CommunityJoinRequest" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityJoinRequest_communityId_userId_key"
  ON "CommunityJoinRequest"("communityId", "userId");

CREATE INDEX "CommunityJoinRequest_communityId_status_createdAt_id_idx"
  ON "CommunityJoinRequest"("communityId", "status", "createdAt", "id");

CREATE INDEX "CommunityJoinRequest_userId_status_createdAt_id_idx"
  ON "CommunityJoinRequest"("userId", "status", "createdAt", "id");

ALTER TABLE "CommunityJoinRequest"
  ADD CONSTRAINT "CommunityJoinRequest_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityJoinRequest"
  ADD CONSTRAINT "CommunityJoinRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityJoinRequest"
  ADD CONSTRAINT "CommunityJoinRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
