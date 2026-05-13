-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('tbank');

-- CreateEnum
CREATE TYPE "PaymentProductKind" AS ENUM ('subscription', 'tokens');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('pending', 'confirmed', 'failed', 'expired', 'canceled');

-- CreateEnum
CREATE TYPE "TokenLedgerReason" AS ENUM ('purchase', 'promotion_spend', 'admin_adjustment');

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'tbank',
    "productKind" "PaymentProductKind" NOT NULL,
    "productId" TEXT NOT NULL,
    "amountKopecks" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "orderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "paymentUrl" TEXT,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rawStatus" TEXT,
    "rawNotification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "paymentOrderId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" "TokenLedgerReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPromotion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "chatId" TEXT,
    "optionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_orderId_key" ON "PaymentOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_providerPaymentId_key" ON "PaymentOrder"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_expiresAt_idx" ON "PaymentOrder"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenWallet_userId_key" ON "TokenWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenLedgerEntry_paymentOrderId_key" ON "TokenLedgerEntry"("paymentOrderId");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_walletId_createdAt_idx" ON "TokenLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_reason_createdAt_idx" ON "TokenLedgerEntry"("reason", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPromotion_ledgerEntryId_key" ON "TokenPromotion"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "TokenPromotion_eventId_expiresAt_idx" ON "TokenPromotion"("eventId", "expiresAt");

-- CreateIndex
CREATE INDEX "TokenPromotion_chatId_expiresAt_idx" ON "TokenPromotion"("chatId", "expiresAt");

-- CreateIndex
CREATE INDEX "TokenPromotion_userId_expiresAt_idx" ON "TokenPromotion"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenWallet" ADD CONSTRAINT "TokenWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "TokenWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPromotion" ADD CONSTRAINT "TokenPromotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPromotion" ADD CONSTRAINT "TokenPromotion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPromotion" ADD CONSTRAINT "TokenPromotion_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPromotion" ADD CONSTRAINT "TokenPromotion_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "TokenLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
