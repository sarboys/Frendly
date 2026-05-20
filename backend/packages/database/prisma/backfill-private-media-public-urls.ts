import { PrismaClient } from '@prisma/client';
import { backfillPrivateMediaPublicUrls } from '../src/private-media-public-url-backfill';

const prisma = new PrismaClient();

const DEFAULT_BATCH_SIZE = 500;

async function main() {
  const report = await backfillPrivateMediaPublicUrls(prisma, {
    batchSize: resolveBatchSize(),
    onProgress: (event) => {
      console.log(
        `[private-media-public-url-backfill] processed=${event.processedCount} updated=${event.updatedCount} cursor=${event.cursor}`,
      );
    },
  });

  console.log(
    `[private-media-public-url-backfill] done processed=${report.processedCount} updated=${report.updatedCount} batches=${report.batchCount}`,
  );
}

function resolveBatchSize() {
  const raw = process.env.PRIVATE_MEDIA_PUBLIC_URL_BACKFILL_BATCH_SIZE;
  const parsed = raw == null ? DEFAULT_BATCH_SIZE : Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BATCH_SIZE;
  }

  return parsed;
}

main()
  .catch((error) => {
    console.error('[private-media-public-url-backfill] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
