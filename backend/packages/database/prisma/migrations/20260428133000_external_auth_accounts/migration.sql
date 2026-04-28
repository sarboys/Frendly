CREATE TABLE "ExternalAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalAuthAccount_provider_providerUserId_key" ON "ExternalAuthAccount"("provider", "providerUserId");
CREATE INDEX "ExternalAuthAccount_userId_provider_idx" ON "ExternalAuthAccount"("userId", "provider");

ALTER TABLE "ExternalAuthAccount" ADD CONSTRAINT "ExternalAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
