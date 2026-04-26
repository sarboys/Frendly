import { PrismaClient } from '@prisma/client';
import { backfillChatUnreadCounts } from '../src/chat-unread-backfill';

const prisma = new PrismaClient();

const DEFAULT_BATCH_SIZE = 500;

async function main() {
  const report = await backfillChatUnreadCounts(prisma, {
    batchSize: resolveBatchSize(),
    onProgress: (event) => {
      console.log(
        `[chat-unread-backfill] processed=${event.processedCount} updated=${event.updatedCount} cursor=${event.cursor}`,
      );
    },
  });

  console.log(
    `[chat-unread-backfill] done processed=${report.processedCount} updated=${report.updatedCount} batches=${report.batchCount}`,
  );
}

function resolveBatchSize() {
  const raw = process.env.CHAT_UNREAD_BACKFILL_BATCH_SIZE;
  const parsed = raw == null ? DEFAULT_BATCH_SIZE : Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BATCH_SIZE;
  }

  return parsed;
}

main()
  .catch((error) => {
    console.error('[chat-unread-backfill] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
