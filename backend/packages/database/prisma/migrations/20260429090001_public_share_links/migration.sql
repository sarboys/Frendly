-- CreateTable
CREATE TABLE "PublicShare" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "eventId" TEXT,
    "eveningSessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicShare_slug_key" ON "PublicShare"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PublicShare_targetType_targetId_key" ON "PublicShare"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PublicShare_eventId_idx" ON "PublicShare"("eventId");

-- CreateIndex
CREATE INDEX "PublicShare_eveningSessionId_idx" ON "PublicShare"("eveningSessionId");

-- CreateIndex
CREATE INDEX "PublicShare_createdById_createdAt_idx" ON "PublicShare"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_eveningSessionId_fkey" FOREIGN KEY ("eveningSessionId") REFERENCES "EveningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShare" ADD CONSTRAINT "PublicShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
