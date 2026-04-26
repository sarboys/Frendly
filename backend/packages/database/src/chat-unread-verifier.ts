import { Prisma } from '@prisma/client';

export type ChatUnreadCounterMismatch = {
  memberId: string;
  chatId: string;
  userId: string;
  storedUnreadCount: number;
  actualUnreadCount: number;
};

export type ChatUnreadCounterReport = {
  checkedCount: number;
  mismatchCount: number;
  mismatches: ChatUnreadCounterMismatch[];
};

type ChatUnreadCounterRow = {
  member_id: string;
  chat_id: string;
  user_id: string;
  stored_unread_count: bigint | number;
  actual_unread_count: bigint | number;
};

type ChatUnreadCounterClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
};

export async function verifyChatUnreadCounters(
  client: ChatUnreadCounterClient,
  options: { sampleSize?: number } = {},
): Promise<ChatUnreadCounterReport> {
  const sampleSize = normalizeSampleSize(options.sampleSize);
  const rows = await client.$queryRaw<ChatUnreadCounterRow[]>`
    SELECT
      cm."id" AS member_id,
      cm."chatId" AS chat_id,
      cm."userId" AS user_id,
      cm."unreadCount" AS stored_unread_count,
      COUNT(m."id") AS actual_unread_count
    FROM (
      SELECT "id", "chatId", "userId", "lastReadMessageId", "lastReadAt", "unreadCount"
      FROM "ChatMember"
      ORDER BY "id" ASC
      LIMIT ${sampleSize}
    ) cm
    LEFT JOIN "Message" last_read
      ON last_read."chatId" = cm."chatId"
      AND last_read."id" = cm."lastReadMessageId"
    LEFT JOIN "Message" m
      ON m."chatId" = cm."chatId"
      AND m."senderId" <> cm."userId"
      AND (
        COALESCE(cm."lastReadAt", last_read."createdAt") IS NULL
        OR m."createdAt" > COALESCE(cm."lastReadAt", last_read."createdAt")
      )
    GROUP BY cm."id", cm."chatId", cm."userId", cm."unreadCount"
  `;

  const mismatches = rows
    .filter((row) => Number(row.stored_unread_count) !== Number(row.actual_unread_count))
    .map((row) => ({
      memberId: row.member_id,
      chatId: row.chat_id,
      userId: row.user_id,
      storedUnreadCount: Number(row.stored_unread_count),
      actualUnreadCount: Number(row.actual_unread_count),
    }));

  return {
    checkedCount: rows.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

function normalizeSampleSize(raw?: number) {
  if (raw == null || !Number.isFinite(raw)) {
    return 1_000;
  }

  return Math.max(1, Math.min(Math.trunc(raw), 100_000));
}
