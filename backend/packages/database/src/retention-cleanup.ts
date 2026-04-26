import { Prisma } from '@prisma/client';

export type RetentionCleanupReport = {
  deletedByTask: Map<string, number>;
  skippedRealtimeEvents: boolean;
};

type RetentionCleanupClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<number>;
};

type DeleteTask = {
  label: string;
  tableName: string;
  where: Prisma.Sql;
};

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_OUTBOX_DONE_RETENTION_DAYS = 14;
const DEFAULT_OUTBOX_FAILED_RETENTION_DAYS = 30;
const DEFAULT_AUTH_AUDIT_RETENTION_DAYS = 180;
const DEFAULT_OTP_RETENTION_DAYS = 7;
const DEFAULT_NOTIFICATION_READ_RETENTION_DAYS = 365;

export async function runRetentionCleanup(
  client: RetentionCleanupClient,
  options: {
    batchSize?: number;
    now?: Date;
    outboxDoneRetentionDays?: number;
    outboxFailedRetentionDays?: number;
    authAuditRetentionDays?: number;
    otpRetentionDays?: number;
    notificationReadRetentionDays?: number;
    onProgress?: (event: { label: string; deleted: number; total: number }) => void;
  } = {},
): Promise<RetentionCleanupReport> {
  const batchSize = resolvePositiveInteger(options.batchSize, DEFAULT_BATCH_SIZE);
  const tasks = buildRetentionTasks(options);
  const deletedByTask = new Map<string, number>();

  for (const task of tasks) {
    let total = 0;

    for (;;) {
      const deleted = await deleteBatch(client, task, batchSize);
      if (deleted === 0) {
        break;
      }

      total += deleted;
      options.onProgress?.({ label: task.label, deleted, total });
    }

    deletedByTask.set(task.label, total);
  }

  return {
    deletedByTask,
    skippedRealtimeEvents: true,
  };
}

function buildRetentionTasks(options: {
  now?: Date;
  outboxDoneRetentionDays?: number;
  outboxFailedRetentionDays?: number;
  authAuditRetentionDays?: number;
  otpRetentionDays?: number;
  notificationReadRetentionDays?: number;
}) {
  const now = options.now ?? new Date();
  const outboxDoneCutoff = daysAgo(
    now,
    resolvePositiveInteger(
      options.outboxDoneRetentionDays,
      DEFAULT_OUTBOX_DONE_RETENTION_DAYS,
    ),
  );
  const outboxFailedCutoff = daysAgo(
    now,
    resolvePositiveInteger(
      options.outboxFailedRetentionDays,
      DEFAULT_OUTBOX_FAILED_RETENTION_DAYS,
    ),
  );
  const authAuditCutoff = daysAgo(
    now,
    resolvePositiveInteger(
      options.authAuditRetentionDays,
      DEFAULT_AUTH_AUDIT_RETENTION_DAYS,
    ),
  );
  const otpCutoff = daysAgo(
    now,
    resolvePositiveInteger(options.otpRetentionDays, DEFAULT_OTP_RETENTION_DAYS),
  );
  const notificationCutoff = daysAgo(
    now,
    resolvePositiveInteger(
      options.notificationReadRetentionDays,
      DEFAULT_NOTIFICATION_READ_RETENTION_DAYS,
    ),
  );

  return [
    {
      label: 'outbox-done',
      tableName: '"OutboxEvent"',
      where: Prisma.sql`
        "status" = 'done'::"OutboxStatus"
        AND COALESCE("processedAt", "createdAt") < ${outboxDoneCutoff}
      `,
    },
    {
      label: 'outbox-failed',
      tableName: '"OutboxEvent"',
      where: Prisma.sql`
        "status" = 'failed'::"OutboxStatus"
        AND "createdAt" < ${outboxFailedCutoff}
      `,
    },
    {
      label: 'auth-audit',
      tableName: '"AuthAuditEvent"',
      where: Prisma.sql`"createdAt" < ${authAuditCutoff}`,
    },
    {
      label: 'phone-otp',
      tableName: '"PhoneOtpChallenge"',
      where: Prisma.sql`
        "createdAt" < ${otpCutoff}
        AND ("consumedAt" IS NOT NULL OR "expiresAt" < NOW())
      `,
    },
    {
      label: 'notification-read',
      tableName: '"Notification"',
      where: Prisma.sql`
        "readAt" IS NOT NULL
        AND "createdAt" < ${notificationCutoff}
      `,
    },
  ] satisfies DeleteTask[];
}

async function deleteBatch(
  client: RetentionCleanupClient,
  task: DeleteTask,
  batchSize: number,
) {
  const rows = await client.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM ${Prisma.raw(task.tableName)}
    WHERE ${task.where}
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT ${batchSize}
  `;

  if (rows.length === 0) {
    return 0;
  }

  await client.$executeRaw`
    DELETE FROM ${Prisma.raw(task.tableName)}
    WHERE "id" IN (${Prisma.join(rows.map((row) => row.id))})
  `;

  return rows.length;
}

function resolvePositiveInteger(raw: number | undefined, fallback: number) {
  if (raw == null || !Number.isFinite(raw)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(raw));
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
