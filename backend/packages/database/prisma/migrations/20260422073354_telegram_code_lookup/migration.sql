-- AlterTable
ALTER TABLE "TelegramLoginSession" ADD COLUMN     "codeLookup" TEXT;

-- CreateIndex
CREATE INDEX "TelegramLoginSession_codeLookup_status_expiresAt_idx" ON "TelegramLoginSession"("codeLookup", "status", "expiresAt");
