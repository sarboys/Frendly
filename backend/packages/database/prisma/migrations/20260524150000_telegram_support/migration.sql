CREATE TABLE "TelegramSupportToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSupportToken_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "TelegramSupportSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSupportSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramSupportToken_userId_createdAt_idx" ON "TelegramSupportToken"("userId", "createdAt");
CREATE INDEX "TelegramSupportToken_expiresAt_idx" ON "TelegramSupportToken"("expiresAt");

CREATE UNIQUE INDEX "TelegramSupportSession_userId_key" ON "TelegramSupportSession"("userId");
CREATE INDEX "TelegramSupportSession_telegramUserId_chatId_status_idx" ON "TelegramSupportSession"("telegramUserId", "chatId", "status");
CREATE INDEX "TelegramSupportSession_status_lastMessageAt_idx" ON "TelegramSupportSession"("status", "lastMessageAt");

ALTER TABLE "TelegramSupportToken" ADD CONSTRAINT "TelegramSupportToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramSupportSession" ADD CONSTRAINT "TelegramSupportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
