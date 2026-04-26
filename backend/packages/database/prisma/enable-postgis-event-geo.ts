import { PrismaClient } from '@prisma/client';
import {
  createConcurrentIndexes,
  prepareLongRunningDdlSession,
} from '../src/concurrent-indexes';

const prisma = new PrismaClient();

async function main() {
  await prepareLongRunningDdlSession(prisma);

  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');

  const extensionRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = 'postgis'
    ) AS exists
  `;

  if (extensionRows[0]?.exists !== true) {
    throw new Error('postgis extension is not enabled');
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Event"
    ADD COLUMN IF NOT EXISTS "geo" geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN "latitude" IS NULL OR "longitude" IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
      END
    ) STORED
  `);

  await createConcurrentIndexes(
    prisma,
    [
      {
        name: 'Event_geo_gist_idx',
        sql: [
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_geo_gist_idx"',
          'ON "Event" USING GIST ("geo")',
          'WHERE "geo" IS NOT NULL',
        ].join(' '),
      },
    ],
    {
      onProgress: (event) => {
        if (event.action === 'drop-invalid') {
          console.log(`[postgis-event-geo] drop invalid ${event.statement.name}`);
          return;
        }

        console.log(`[postgis-event-geo] ${event.statement.sql}`);
      },
    },
  );

  console.log('[postgis-event-geo] enabled');
}

main()
  .catch((error) => {
    console.error('[postgis-event-geo] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
