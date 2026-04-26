import { Prisma } from '@prisma/client';

export type ChatUnreadBackfillReport = {
  batchCount: number;
  processedCount: number;
  updatedCount: number;
};

type ChatUnreadBackfillClient = {
  chatMember: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true };
      orderBy: { id: 'asc' };
      take: number;
    }): Promise<Array<{ id: string }>>;
  };
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<number>;
};

type ChatUnreadRow = {
  member_id: string;
  unread_count: bigint | number;
};

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5_000;

export async function backfillChatUnreadCounts(
  client: ChatUnreadBackfillClient,
  options: {
    batchSize?: number;
    onProgress?: (event: {
      batchCount: number;
      processedCount: number;
      cursor: string;
      updatedCount: number;
    }) => void;
  } = {},
): Promise<ChatUnreadBackfillReport> {
  const batchSize = normalizeChatUnreadBackfillBatchSize(options.batchSize);
  let cursor: string | undefined;
  let batchCount = 0;
  let processedCount = 0;
  let updatedCount = 0;

  for (;;) {
    const members = await client.chatMember.findMany({
      where:
        cursor == null
          ? {}
          : {
              id: {
                gt: cursor,
              },
            },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: batchSize,
    });

    if (members.length === 0) {
      break;
    }

    const memberIds = members.map((member) => member.id);
    const rows = await client.$queryRaw<ChatUnreadRow[]>`
      SELECT cm."id" AS member_id, COUNT(m."id") AS unread_count
      FROM "ChatMember" cm
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
      WHERE cm."id" IN (${Prisma.join(memberIds)})
      GROUP BY cm."id"
    `;

    const unreadByMemberId = new Map(
      rows.map((row) => [row.member_id, Number(row.unread_count)]),
    );
    const values = memberIds.map((memberId) =>
      Prisma.sql`(${memberId}, ${unreadByMemberId.get(memberId) ?? 0})`,
    );
    const updated = await client.$executeRaw`
      UPDATE "ChatMember" cm
      SET "unreadCount" = data."unreadCount"
      FROM (VALUES ${Prisma.join(values)}) AS data("id", "unreadCount")
      WHERE cm."id" = data."id"
        AND cm."unreadCount" <> data."unreadCount"
    `;

    batchCount += 1;
    processedCount += members.length;
    updatedCount += updated;
    cursor = members[members.length - 1]!.id;
    options.onProgress?.({
      batchCount,
      processedCount,
      cursor,
      updatedCount,
    });
  }

  return {
    batchCount,
    processedCount,
    updatedCount,
  };
}

export function normalizeChatUnreadBackfillBatchSize(raw?: number) {
  if (raw == null || !Number.isFinite(raw)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.max(1, Math.min(Math.trunc(raw), MAX_BATCH_SIZE));
}
