import { backfillChatUnreadCounts } from '../../src/chat-unread-backfill';

describe('backfillChatUnreadCounts', () => {
  it('processes chat members in cursor batches and updates stored counters', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'member-1' }, { id: 'member-2' }])
      .mockResolvedValueOnce([{ id: 'member-3' }])
      .mockResolvedValueOnce([]);
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          member_id: 'member-1',
          unread_count: BigInt(2),
        },
        {
          member_id: 'member-2',
          unread_count: BigInt(0),
        },
      ])
      .mockResolvedValueOnce([
        {
          member_id: 'member-3',
          unread_count: BigInt(5),
        },
      ]);
    const executeRaw = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const report = await backfillChatUnreadCounts(
      {
        chatMember: {
          findMany,
        },
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
      } as any,
      {
        batchSize: 2,
      },
    );

    expect(report).toEqual({
      batchCount: 2,
      processedCount: 3,
      updatedCount: 2,
    });
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {},
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          gt: 'member-2',
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(findMany).toHaveBeenNthCalledWith(3, {
      where: {
        id: {
          gt: 'member-3',
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });
});
