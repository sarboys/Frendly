CREATE TABLE "EveningRoute" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "vibe" TEXT NOT NULL,
  "blurb" TEXT NOT NULL,
  "totalPriceFrom" INTEGER NOT NULL,
  "totalSavings" INTEGER NOT NULL,
  "durationLabel" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "mood" TEXT NOT NULL,
  "budget" TEXT NOT NULL,
  "format" TEXT,
  "premium" BOOLEAN NOT NULL DEFAULT false,
  "recommendedFor" TEXT,
  "hostsCount" INTEGER NOT NULL DEFAULT 0,
  "chatId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EveningRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EveningRouteStep" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "timeLabel" TEXT NOT NULL,
  "endTimeLabel" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "venue" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "distanceLabel" TEXT NOT NULL,
  "walkMin" INTEGER,
  "perk" TEXT,
  "perkShort" TEXT,
  "ticketPrice" INTEGER,
  "ticketCommission" INTEGER,
  "sponsored" BOOLEAN NOT NULL DEFAULT false,
  "premium" BOOLEAN NOT NULL DEFAULT false,
  "partnerId" TEXT,
  "description" TEXT,
  "vibeTag" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EveningRouteStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserEveningStepAction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "perkUsedAt" TIMESTAMP(3),
  "ticketBoughtAt" TIMESTAMP(3),
  "sentToChatAt" TIMESTAMP(3),
  "chatMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserEveningStepAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EveningRoute_chatId_key" ON "EveningRoute"("chatId");
CREATE INDEX "EveningRoute_goal_mood_budget_id_idx" ON "EveningRoute"("goal", "mood", "budget", "id");
CREATE INDEX "EveningRoute_premium_id_idx" ON "EveningRoute"("premium", "id");
CREATE INDEX "EveningRouteStep_routeId_sortOrder_id_idx" ON "EveningRouteStep"("routeId", "sortOrder", "id");
CREATE UNIQUE INDEX "UserEveningStepAction_userId_stepId_key" ON "UserEveningStepAction"("userId", "stepId");
CREATE INDEX "UserEveningStepAction_userId_routeId_idx" ON "UserEveningStepAction"("userId", "routeId");
CREATE INDEX "UserEveningStepAction_routeId_stepId_idx" ON "UserEveningStepAction"("routeId", "stepId");

ALTER TABLE "EveningRoute"
ADD CONSTRAINT "EveningRoute_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EveningRouteStep"
ADD CONSTRAINT "EveningRouteStep_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "EveningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEveningStepAction"
ADD CONSTRAINT "UserEveningStepAction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEveningStepAction"
ADD CONSTRAINT "UserEveningStepAction_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "EveningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEveningStepAction"
ADD CONSTRAINT "UserEveningStepAction_stepId_fkey"
FOREIGN KEY ("stepId") REFERENCES "EveningRouteStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
