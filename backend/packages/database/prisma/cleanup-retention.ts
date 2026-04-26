import { PrismaClient } from '@prisma/client';
import { runRetentionCleanup } from '../src/retention-cleanup';

const prisma = new PrismaClient();

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_OUTBOX_DONE_RETENTION_DAYS = 14;
const DEFAULT_OUTBOX_FAILED_RETENTION_DAYS = 30;
const DEFAULT_AUTH_AUDIT_RETENTION_DAYS = 180;
const DEFAULT_OTP_RETENTION_DAYS = 7;
const DEFAULT_NOTIFICATION_READ_RETENTION_DAYS = 365;

function resolvePositiveInteger(raw: string | undefined, fallback: number) {
  const parsed = raw == null ? fallback : Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(parsed));
}

async function main() {
  const report = await runRetentionCleanup(prisma, {
    batchSize: resolvePositiveInteger(
      process.env.RETENTION_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
    ),
    outboxDoneRetentionDays: resolvePositiveInteger(
      process.env.OUTBOX_DONE_RETENTION_DAYS,
      DEFAULT_OUTBOX_DONE_RETENTION_DAYS,
    ),
    outboxFailedRetentionDays: resolvePositiveInteger(
      process.env.OUTBOX_FAILED_RETENTION_DAYS,
      DEFAULT_OUTBOX_FAILED_RETENTION_DAYS,
    ),
    authAuditRetentionDays: resolvePositiveInteger(
      process.env.AUTH_AUDIT_RETENTION_DAYS,
      DEFAULT_AUTH_AUDIT_RETENTION_DAYS,
    ),
    otpRetentionDays: resolvePositiveInteger(
      process.env.OTP_RETENTION_DAYS,
      DEFAULT_OTP_RETENTION_DAYS,
    ),
    notificationReadRetentionDays: resolvePositiveInteger(
      process.env.NOTIFICATION_READ_RETENTION_DAYS,
      DEFAULT_NOTIFICATION_READ_RETENTION_DAYS,
    ),
    onProgress: ({ label, deleted, total }) => {
      console.log(`[retention] ${label} deleted=${deleted} total=${total}`);
    },
  });

  for (const [label, total] of report.deletedByTask) {
    console.log(`[retention] ${label} done total=${total}`);
  }

  if (report.skippedRealtimeEvents) {
    console.log('[retention] realtime events skipped until sync reset snapshot is fully rolled out');
  }
}

main()
  .catch((error) => {
    console.error('[retention] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
