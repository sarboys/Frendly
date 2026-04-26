import { PrismaClient } from '@prisma/client';
import { verifyChatUnreadCounters } from '../src/chat-unread-verifier';

const prisma = new PrismaClient();

function resolveSampleSize() {
  const raw = process.env.CHAT_UNREAD_VERIFY_SAMPLE_SIZE;
  const parsed = raw == null ? 1_000 : Number(raw);
  if (!Number.isFinite(parsed)) {
    return 1_000;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), 100_000));
}

async function main() {
  const report = await verifyChatUnreadCounters(prisma, {
    sampleSize: resolveSampleSize(),
  });

  console.log(
    `[chat-unread-verify] checked=${report.checkedCount} mismatches=${report.mismatchCount}`,
  );

  for (const mismatch of report.mismatches.slice(0, 50)) {
    console.log(
      [
        '[chat-unread-verify] mismatch',
        `member=${mismatch.memberId}`,
        `chat=${mismatch.chatId}`,
        `user=${mismatch.userId}`,
        `stored=${mismatch.storedUnreadCount}`,
        `actual=${mismatch.actualUnreadCount}`,
      ].join(' '),
    );
  }

  if (report.mismatchCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[chat-unread-verify] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
