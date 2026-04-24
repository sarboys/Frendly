ALTER TYPE "ChatKind" ADD VALUE IF NOT EXISTS 'community';
ALTER TYPE "ChatOrigin" ADD VALUE IF NOT EXISTS 'community';

CREATE TYPE "CommunityPrivacy" AS ENUM ('public', 'private');
CREATE TYPE "CommunityMemberRole" AS ENUM ('owner', 'moderator', 'member');
CREATE TYPE "CommunityMediaKind" AS ENUM ('photo', 'video', 'doc');

CREATE TABLE "Community" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "privacy" "CommunityPrivacy" NOT NULL DEFAULT 'public',
  "tags" JSONB NOT NULL,
  "joinRule" TEXT NOT NULL,
  "premiumOnly" BOOLEAN NOT NULL DEFAULT true,
  "mood" TEXT NOT NULL,
  "sharedMediaLabel" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityMember" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CommunityMemberRole" NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityNewsItem" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "blurb" TEXT NOT NULL,
  "timeLabel" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityNewsItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityMeetupItem" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "timeLabel" TEXT NOT NULL,
  "place" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "going" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),

  CONSTRAINT "CommunityMeetupItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityMediaItem" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "CommunityMediaKind" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityMediaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunitySocialLink" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "CommunitySocialLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Community_chatId_key" ON "Community"("chatId");
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");
CREATE INDEX "Community_createdAt_id_idx" ON "Community"("createdAt", "id");
CREATE INDEX "Community_privacy_createdAt_id_idx" ON "Community"("privacy", "createdAt", "id");
CREATE INDEX "CommunityMember_userId_joinedAt_idx" ON "CommunityMember"("userId", "joinedAt");
CREATE INDEX "CommunityNewsItem_communityId_sortOrder_id_idx" ON "CommunityNewsItem"("communityId", "sortOrder", "id");
CREATE INDEX "CommunityMeetupItem_communityId_sortOrder_id_idx" ON "CommunityMeetupItem"("communityId", "sortOrder", "id");
CREATE INDEX "CommunityMediaItem_communityId_sortOrder_id_idx" ON "CommunityMediaItem"("communityId", "sortOrder", "id");
CREATE INDEX "CommunitySocialLink_communityId_sortOrder_id_idx" ON "CommunitySocialLink"("communityId", "sortOrder", "id");

ALTER TABLE "Community"
ADD CONSTRAINT "Community_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Community"
ADD CONSTRAINT "Community_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMember"
ADD CONSTRAINT "CommunityMember_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMember"
ADD CONSTRAINT "CommunityMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityNewsItem"
ADD CONSTRAINT "CommunityNewsItem_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMeetupItem"
ADD CONSTRAINT "CommunityMeetupItem_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMediaItem"
ADD CONSTRAINT "CommunityMediaItem_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunitySocialLink"
ADD CONSTRAINT "CommunitySocialLink_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
