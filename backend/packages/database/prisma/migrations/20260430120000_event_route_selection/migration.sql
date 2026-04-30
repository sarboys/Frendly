ALTER TABLE "Event" ADD COLUMN "eveningRouteId" TEXT;

CREATE INDEX "Event_eveningRouteId_startsAt_id_idx"
ON "Event"("eveningRouteId", "startsAt", "id");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_eveningRouteId_fkey"
FOREIGN KEY ("eveningRouteId") REFERENCES "EveningRoute"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
