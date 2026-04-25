import { ChatsService } from '../../src/services/chats.service';

describe('ChatsService unit', () => {
  it('counts chat unread messages from chat member read state, not notifications', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(4),
      },
    ]);
    const notificationGroupBy = jest.fn();
    const service = new ChatsService({
      client: {
        $queryRaw: queryRaw,
        notification: {
          groupBy: notificationGroupBy,
        },
      },
    } as any);

    const result = await (service as any).getUnreadCountsByChat(
      'user-me',
      ['chat-1', 'chat-2'],
      new Set<string>(),
    );

    expect(result).toEqual(new Map([['chat-1', 4]]));
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(notificationGroupBy).not.toHaveBeenCalled();
  });
});
