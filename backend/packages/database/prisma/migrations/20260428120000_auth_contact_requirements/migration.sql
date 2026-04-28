ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'google';
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'yandex';

ALTER TABLE "User" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Session"
ADD COLUMN "provider" "AuthProvider" NOT NULL DEFAULT 'session';
