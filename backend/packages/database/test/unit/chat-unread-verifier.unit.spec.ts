import { verifyChatUnreadCounters } from '../../src/chat-unread-verifier';

describe('verifyChatUnreadCounters', () => {
  it('reports mismatched unread counters without changing data', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        member_id: 'member-1',
        chat_id: 'chat-1',
        user_id: 'user-1',
        stored_unread_count: 1,
        actual_unread_count: BigInt(3),
      },
    ]);
    const executeRaw = jest.fn();

    const report = await verifyChatUnreadCounters(
      {
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
      } as any,
      {
        sampleSize: 100,
      },
    );

    expect(report).toEqual({
      checkedCount: 1,
      mismatchCount: 1,
      mismatches: [
        {
          memberId: 'member-1',
          chatId: 'chat-1',
          userId: 'user-1',
          storedUnreadCount: 1,
          actualUnreadCount: 3,
        },
      ],
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
