import { ChatsService } from '../../src/services/chats.service';

describe('ChatsService unit', () => {
  afterEach(() => {
    delete process.env.CHAT_UNREAD_COUNTER_READS;
  });

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

  it('reads chat unread counts from ChatMember counters when enabled', async () => {
    process.env.CHAT_UNREAD_COUNTER_READS = 'true';
    const queryRaw = jest.fn();
    const findMany = jest.fn().mockResolvedValue([
      {
        chatId: 'chat-1',
        unreadCount: 7,
      },
    ]);
    const service = new ChatsService({
      client: {
        chatMember: {
          findMany,
        },
        $queryRaw: queryRaw,
      },
    } as any);

    const result = await (service as any).getUnreadCountsByChat(
      'user-me',
      ['chat-1', 'chat-2'],
      new Set<string>(),
    );

    expect(result).toEqual(new Map([['chat-1', 7]]));
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        chatId: {
          in: ['chat-1', 'chat-2'],
        },
      },
      select: {
        chatId: true,
        unreadCount: true,
      },
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('maps evening meetup chat phase metadata for the chat list', () => {
    const service = new ChatsService({ client: {} } as any);
    const phase = (service as any).mapEveningChatPhase({
      meetupPhase: 'live',
      meetupMode: 'hybrid',
      currentStep: 2,
      meetupStartsAt: new Date('2026-04-26T16:00:00.000Z'),
      meetupEndsAt: new Date('2026-04-26T18:00:00.000Z'),
      eveningRoute: {
        id: 'r-cozy-circle',
        steps: [
          { sortOrder: 0, venue: 'Brix Wine', endTimeLabel: '20:15' },
          { sortOrder: 1, venue: 'Standup Store', endTimeLabel: '22:00' },
        ],
      },
    });

    expect(phase).toEqual({
      phase: 'live',
      currentStep: 2,
      totalSteps: 2,
      currentPlace: 'Standup Store',
      endTime: '22:00',
      startsInLabel: null,
      routeId: 'r-cozy-circle',
      mode: 'hybrid',
    });
  });
});
