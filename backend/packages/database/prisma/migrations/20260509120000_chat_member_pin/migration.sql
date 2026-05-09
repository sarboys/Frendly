ALTER TABLE "ChatMember"
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinnedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ChatMember_userId_isPinned_pinnedAt_idx"
ON "ChatMember"("userId", "isPinned", "pinnedAt");
