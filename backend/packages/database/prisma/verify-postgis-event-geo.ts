import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [extension] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_extension
      WHERE extname = 'postgis'
    ) AS exists
  `;

  if (extension?.exists !== true) {
    throw new Error('postgis extension is not enabled');
  }

  const [column] = await prisma.$queryRaw<Array<{
    exists: boolean;
    generated: string | null;
  }>>`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Event'
          AND column_name = 'geo'
          AND udt_name = 'geography'
      ) AS exists,
      (
        SELECT is_generated
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Event'
          AND column_name = 'geo'
        LIMIT 1
      ) AS generated
  `;

  if (column?.exists !== true) {
    throw new Error('Event.geo geography column is missing');
  }

  if (column.generated !== 'ALWAYS') {
    throw new Error('Event.geo must be a generated column');
  }

  const [index] = await prisma.$queryRaw<Array<{
    exists: boolean;
    valid: boolean;
    ready: boolean;
  }>>`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_class index_class
        JOIN pg_index idx ON idx.indexrelid = index_class.oid
        JOIN pg_class table_class ON table_class.oid = idx.indrelid
        WHERE table_class.relname = 'Event'
          AND index_class.relname = 'Event_geo_gist_idx'
      ) AS exists,
      COALESCE((
        SELECT idx.indisvalid
        FROM pg_class index_class
        JOIN pg_index idx ON idx.indexrelid = index_class.oid
        JOIN pg_class table_class ON table_class.oid = idx.indrelid
        WHERE table_class.relname = 'Event'
          AND index_class.relname = 'Event_geo_gist_idx'
        LIMIT 1
      ), false) AS valid,
      COALESCE((
        SELECT idx.indisready
        FROM pg_class index_class
        JOIN pg_index idx ON idx.indexrelid = index_class.oid
        JOIN pg_class table_class ON table_class.oid = idx.indrelid
        WHERE table_class.relname = 'Event'
          AND index_class.relname = 'Event_geo_gist_idx'
        LIMIT 1
      ), false) AS ready
  `;

  if (index?.exists !== true) {
    throw new Error('Event_geo_gist_idx is missing');
  }

  if (index.valid !== true || index.ready !== true) {
    throw new Error('Event_geo_gist_idx is not ready and valid');
  }

  console.log('[postgis-event-geo] verified');
}

main()
  .catch((error) => {
    console.error('[postgis-event-geo] verify failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
