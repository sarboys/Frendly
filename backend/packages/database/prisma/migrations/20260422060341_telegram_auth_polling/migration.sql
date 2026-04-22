-- CreateEnum
CREATE TYPE "TelegramLoginSessionStatus" AS ENUM ('pending_bot', 'awaiting_contact', 'code_issued', 'consumed', 'failed');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('dev', 'phone_otp', 'telegram');

-- CreateEnum
CREATE TYPE "AuthAuditKind" AS ENUM ('start', 'verify', 'refresh', 'logout');

-- CreateEnum
CREATE TYPE "AuthAuditResult" AS ENUM ('issued', 'success', 'rejected', 'conflict', 'rate_limited', 'revoked');

-- CreateTable
CREATE TABLE "TelegramAccount" (
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TelegramLoginSession" (
    "id" TEXT NOT NULL,
    "loginSessionId" TEXT NOT NULL,
    "startToken" TEXT NOT NULL,
    "status" "TelegramLoginSessionStatus" NOT NULL DEFAULT 'pending_bot',
    "telegramUserId" TEXT,
    "chatId" TEXT,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "codeSalt" TEXT,
    "codeHash" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "lastCodeIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAuditEvent" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "kind" "AuthAuditKind" NOT NULL,
    "result" "AuthAuditResult" NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "telegramUserId" TEXT,
    "loginSessionId" TEXT,
    "sessionId" TEXT,
    "maskedPhone" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramBotState" (
    "id" TEXT NOT NULL,
    "lastUpdateId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramBotState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_telegramUserId_key" ON "TelegramAccount"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLoginSession_loginSessionId_key" ON "TelegramLoginSession"("loginSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLoginSession_startToken_key" ON "TelegramLoginSession"("startToken");

-- CreateIndex
CREATE INDEX "TelegramLoginSession_status_expiresAt_idx" ON "TelegramLoginSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TelegramLoginSession_telegramUserId_status_idx" ON "TelegramLoginSession"("telegramUserId", "status");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_provider_kind_createdAt_idx" ON "AuthAuditEvent"("provider", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_loginSessionId_createdAt_idx" ON "AuthAuditEvent"("loginSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_telegramUserId_createdAt_idx" ON "AuthAuditEvent"("telegramUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_userId_createdAt_idx" ON "AuthAuditEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
