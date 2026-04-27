import { ChatsService } from '../../src/services/chats.service';
import { ChatKind } from '@prisma/client';

describe('ChatsService unit', () => {
  afterEach(() => {
    delete process.env.CHAT_UNREAD_COUNTER_READS;
    jest.restoreAllMocks();
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
      sessionId: null,
      mode: 'hybrid',
      privacy: null,
      joinedCount: null,
      maxGuests: null,
      hostUserId: null,
      hostName: null,
      area: null,
    });
  });

  it('maps evening session discovery metadata for the chat list', () => {
    const service = new ChatsService({ client: {} } as any);
    const phase = (service as any).mapEveningChatPhase({
      meetupPhase: 'soon',
      meetupMode: 'manual',
      currentStep: null,
      eveningSession: {
        id: 'session-1',
        phase: 'scheduled',
        privacy: 'request',
        capacity: 10,
        currentStep: null,
        host: {
          id: 'user-anya',
          displayName: 'Аня К',
        },
        participants: [
          { status: 'joined', user: { displayName: 'Аня К' } },
          { status: 'joined', user: { displayName: 'Марк С' } },
          { status: 'requested', user: { displayName: 'Ира' } },
        ],
        route: {
          id: 'r-cozy-circle',
          area: 'Покровка',
          steps: [
            { sortOrder: 0, venue: 'Brix Wine', endTimeLabel: '20:15' },
            { sortOrder: 1, venue: 'Standup Store', endTimeLabel: '22:00' },
          ],
        },
      },
    });

    expect(phase).toMatchObject({
      phase: 'soon',
      currentStep: null,
      totalSteps: 2,
      currentPlace: null,
      routeId: 'r-cozy-circle',
      sessionId: 'session-1',
      mode: 'manual',
      privacy: 'request',
      joinedCount: 2,
      maxGuests: 10,
      hostUserId: 'user-anya',
      hostName: 'Аня К',
      area: 'Покровка',
    });
  });

  it('maps finished or past event meetup chats to done phase', () => {
    jest.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-04-26T18:00:00.000Z').getTime(),
    );
    const service = new ChatsService({ client: {} } as any);

    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-26T08:33:00.000Z'),
        durationMinutes: 120,
        liveState: { status: 'idle' },
      }),
    ).toBe('done');
    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-26T17:00:00.000Z'),
        durationMinutes: 120,
        liveState: { status: 'finished' },
      }),
    ).toBe('done');
  });

  it('bounds chat list member previews and filters blocked members in the query', async () => {
    const chatFindMany = jest.fn().mockResolvedValue([]);
    const service = new ChatsService({
      client: {
        chat: {
          findMany: chatFindMany,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-me',
              blockedUserId: 'blocked-user',
            },
          ]),
        },
      },
    } as any);

    await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(chatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          eveningSession: expect.objectContaining({
            select: expect.not.objectContaining({
              participants: expect.anything(),
            }),
          }),
          members: expect.objectContaining({
            where: {
              userId: {
                notIn: ['blocked-user'],
              },
            },
            orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
            take: 8,
          }),
          messages: expect.objectContaining({
            where: {
              senderId: {
                notIn: ['blocked-user'],
              },
            },
            take: 1,
          }),
        }),
      }),
    );
    expect(chatFindMany.mock.calls[0]?.[0].include.eveningSession.select._count)
      .toEqual({
        select: {
          participants: {
            where: {
              status: 'joined',
            },
          },
        },
      });
  });

  it('does not expose blocked sender content through reply previews', async () => {
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              kind: ChatKind.meetup,
              event: {
                hostId: 'user-host',
              },
            },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-me',
              blockedUserId: 'blocked-user',
            },
          ]),
        },
        message: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'message-1',
              chatId: 'chat-1',
              senderId: 'user-peer',
              sender: {
                id: 'user-peer',
                displayName: 'Peer',
                profile: {
                  avatarUrl: null,
                },
              },
              text: 'Visible reply',
              clientMessageId: 'client-1',
              createdAt: new Date('2026-04-24T10:00:00.000Z'),
              attachments: [],
              replyTo: {
                id: 'blocked-message',
                chatId: 'chat-1',
                senderId: 'blocked-user',
                sender: {
                  id: 'blocked-user',
                  displayName: 'Blocked',
                },
                text: 'Hidden text',
                clientMessageId: 'client-blocked',
                createdAt: new Date('2026-04-24T09:00:00.000Z'),
                attachments: [],
              },
            },
          ]),
        },
        realtimeEvent: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    } as any);

    await expect(
      service.getMessages('user-me', 'chat-1', { limit: 20 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'message-1',
          text: 'Visible reply',
          replyTo: null,
        },
      ],
    });
  });

  it('checks meetup membership without loading the full member list', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      chat: {
        kind: ChatKind.meetup,
        event: {
          hostId: 'user-host',
        },
      },
    });
    const findFirst = jest.fn();
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique,
          findFirst,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await (service as any).assertMembership('user-me', 'chat-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'chat-1',
          userId: 'user-me',
        },
      },
      select: {
        chat: {
          select: {
            kind: true,
            event: {
              select: {
                hostId: true,
              },
            },
          },
        },
      },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('does not advance read markers to messages from blocked senders', async () => {
    const memberUpdate = jest.fn();
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              kind: ChatKind.meetup,
              event: {
                hostId: 'user-host',
              },
            },
          }),
          update: memberUpdate,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'user-me',
              blockedUserId: 'blocked-user',
            },
          ]),
        },
        message: {
          findFirst: jest.fn((args) =>
            args.where.senderId?.notIn?.includes('blocked-user')
              ? Promise.resolve(null)
              : Promise.resolve({
                  id: 'message-blocked',
                  senderId: 'blocked-user',
                }),
          ),
        },
        notification: {
          updateMany: jest.fn(),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            chatMember: {
              update: memberUpdate,
            },
            notification: {
              updateMany: jest.fn(),
            },
          }),
        ),
      },
    } as any);

    await expect(
      service.markRead('user-me', 'chat-1', 'message-blocked'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'message_not_found',
    });
    expect(memberUpdate).not.toHaveBeenCalled();
  });
});
