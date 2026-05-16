import { ChatsService } from '../../src/services/chats.service';
import { ChatKind, MediaAssetKind } from '@prisma/client';

describe('ChatsService unit', () => {
  const makeChatListItem = (
    id: string,
    updatedAt: Date,
  ) => ({
    id,
    kind: ChatKind.meetup,
    title: `Chat ${id}`,
    emoji: '*',
    updatedAt,
    event: {
      id: `event-${id}`,
      hostId: 'host-user',
      startsAt: new Date('2026-04-26T17:00:00.000Z'),
      durationMinutes: 120,
      isAfterDark: false,
      afterDarkGlow: null,
      liveState: {
        status: 'idle',
      },
    },
    sourceEvent: null,
    members: [],
    messages: [],
    eveningRoute: null,
    eveningSession: null,
  });

  const makeMessage = (
    id: string,
    createdAt: Date,
  ) => ({
    id,
    chatId: 'chat-1',
    senderId: 'user-peer',
    sender: {
      id: 'user-peer',
      displayName: 'Peer',
      profile: {
        avatarUrl: null,
      },
    },
    text: `Message ${id}`,
    clientMessageId: `client-${id}`,
    createdAt,
    attachments: [],
    replyTo: null,
  });
  const makeSocialClient = (overrides: any = {}) => ({
    userFollow: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.userFollow,
    },
    profileReaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.profileReaction,
    },
  });
  const emptySocialPreview = () => ({
    followers: 0,
    likes: 0,
    superLikes: 0,
    iFollow: false,
    iLike: false,
    iSuper: false,
  });

  afterEach(() => {
    delete process.env.CHAT_UNREAD_COUNTER_READS;
    jest.restoreAllMocks();
  });

  it('reads chat unread counts from ChatMember counters by default', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(4),
      },
    ]);
    const chatMemberFindMany = jest.fn().mockResolvedValue([
      {
        chatId: 'chat-1',
        unreadCount: 4,
      },
    ]);
    const notificationGroupBy = jest.fn();
    const service = new ChatsService({
      client: {
        chatMember: {
          findMany: chatMemberFindMany,
        },
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
    expect(chatMemberFindMany).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(notificationGroupBy).not.toHaveBeenCalled();
  });

  it('can fall back to raw chat unread counts when counter reads are explicitly disabled', async () => {
    process.env.CHAT_UNREAD_COUNTER_READS = 'false';
    const queryRaw = jest.fn();
    queryRaw.mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(7),
      },
    ]);
    const findMany = jest.fn();
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
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
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

  it('maps event meetup chats to done phase 24 hours after start', () => {
    jest.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-04-27T18:00:00.000Z').getTime(),
    );
    const service = new ChatsService({ client: {} } as any);

    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-26T17:59:00.000Z'),
        durationMinutes: 120,
        liveState: { status: 'idle' },
      }),
    ).toBe('done');
    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-26T17:00:00.000Z'),
        durationMinutes: 120,
        liveState: { status: 'live' },
      }),
    ).toBe('done');
    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-26T19:00:00.000Z'),
        durationMinutes: 120,
        liveState: { status: 'idle' },
      }),
    ).toBe('live');
    expect(
      (service as any).phaseFromEvent({
        startsAt: new Date('2026-04-27T17:00:00.000Z'),
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
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(chatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
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
    expect(chatFindMany.mock.calls[0]?.[0].select.eveningSession.select._count)
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

  it('exposes pinned state and sorts pinned chats first', async () => {
    const newerChat = makeChatListItem(
      'chat-newer',
      new Date('2026-04-24T12:00:00.000Z'),
    ) as any;
    const pinnedChat = makeChatListItem(
      'chat-pinned',
      new Date('2026-04-23T10:00:00.000Z'),
    ) as any;
    const chatMemberFindMany = jest.fn().mockResolvedValue([
      {
        chatId: 'chat-newer',
        unreadCount: 0,
        isPinned: false,
        pinnedAt: null,
      },
      {
        chatId: 'chat-pinned',
        unreadCount: 2,
        isPinned: true,
        pinnedAt: new Date('2026-04-24T13:00:00.000Z'),
      },
    ]);

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([newerChat, pinnedChat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: chatMemberFindMany,
        },
        ...makeSocialClient(),
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(result.items.map((item) => item.id)).toEqual([
      'chat-pinned',
      'chat-newer',
    ]);
    expect(result.items[0]).toMatchObject({
      id: 'chat-pinned',
      isPinned: true,
      unread: 2,
    });
    expect(result.items[1]).toMatchObject({
      id: 'chat-newer',
      isPinned: false,
      unread: 0,
    });
    expect(chatMemberFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        chatId: {
          in: ['chat-newer', 'chat-pinned'],
        },
      },
      select: {
        chatId: true,
        unreadCount: true,
        isPinned: true,
        pinnedAt: true,
      },
    });
  });

  it('exposes last message timestamp for chat list sorting', async () => {
    const messageCreatedAt = new Date('2026-04-24T12:34:00.000Z');
    const chat = {
      ...makeChatListItem('chat-with-message', messageCreatedAt),
      messages: [makeMessage('message-1', messageCreatedAt)],
    } as any;

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([chat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([
            {
              chatId: 'chat-with-message',
              unreadCount: 0,
              isPinned: false,
              pinnedAt: null,
            },
          ]),
        },
        ...makeSocialClient(),
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(result.items[0]).toMatchObject({
      id: 'chat-with-message',
      lastMessageId: 'message-1',
      lastMessageAt: '2026-04-24T12:34:00.000Z',
    });
  });

  it('updates pinned state for the current chat member', async () => {
    const update = jest.fn().mockResolvedValue({
      chatId: 'chat-1',
      isPinned: true,
      pinnedAt: new Date('2026-04-24T13:00:00.000Z'),
    });
    const service = new ChatsService({
      client: {
        chatMember: {
          update,
        },
      },
    } as any);

    const result = await service.setPinned('user-me', 'chat-1', true);

    expect(update).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'chat-1',
          userId: 'user-me',
        },
      },
      data: {
        isPinned: true,
        pinnedAt: expect.any(Date),
      },
      select: {
        chatId: true,
        isPinned: true,
        pinnedAt: true,
      },
    });
    expect(result).toEqual({
      id: 'chat-1',
      isPinned: true,
      pinnedAt: '2026-04-24T13:00:00.000Z',
    });
  });

  it('deletes a meetup chat by leaving the linked event for non-host members', async () => {
    const deleteParticipant = jest.fn().mockResolvedValue({ count: 1 });
    const attendanceUpsert = jest.fn().mockResolvedValue({});
    const deleteChatMember = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.meetup,
              event: {
                id: 'event-1',
                hostId: 'host-1',
              },
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            eventParticipant: {
              deleteMany: deleteParticipant,
            },
            eventAttendance: {
              upsert: attendanceUpsert,
            },
            chatMember: {
              deleteMany: deleteChatMember,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'meetup',
      eventId: 'event-1',
    });
    expect(deleteParticipant).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        userId: 'user-me',
      },
    });
    expect(attendanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId_userId: {
            eventId: 'event-1',
            userId: 'user-me',
          },
        },
        update: expect.objectContaining({
          status: 'left',
          leftAt: expect.any(Date),
        }),
      }),
    );
    expect(deleteChatMember).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
  });

  it('deletes an evening meetup chat by leaving the linked session for non-host members', async () => {
    const updateParticipant = jest.fn().mockResolvedValue({ count: 1 });
    const deleteChatMember = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.meetup,
              event: null,
              eveningSession: {
                id: 'session-1',
                hostUserId: 'host-1',
              },
              community: null,
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            eveningSessionParticipant: {
              updateMany: updateParticipant,
            },
            chatMember: {
              deleteMany: deleteChatMember,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'meetup',
      eventId: null,
      sessionId: 'session-1',
    });
    expect(updateParticipant).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        userId: 'user-me',
      },
      data: {
        status: 'left',
        leftAt: expect.any(Date),
      },
    });
    expect(deleteChatMember).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
  });

  it('lets a meetup host hide their hosted meetup chat', async () => {
    const deleteChatMember = jest.fn().mockResolvedValue({ count: 1 });
    const deleteParticipant = jest.fn();
    const attendanceUpsert = jest.fn();
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.meetup,
              event: {
                id: 'event-1',
                hostId: 'user-me',
              },
              eveningSession: null,
              community: null,
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            eventParticipant: {
              deleteMany: deleteParticipant,
            },
            eventAttendance: {
              upsert: attendanceUpsert,
            },
            chatMember: {
              deleteMany: deleteChatMember,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'meetup',
      eventId: 'event-1',
    });
    expect(deleteChatMember).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
    expect(deleteParticipant).not.toHaveBeenCalled();
    expect(attendanceUpsert).not.toHaveBeenCalled();
  });

  it('deletes a direct chat only for the current user', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.direct,
              event: null,
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            chatMember: {
              deleteMany,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'direct',
      eventId: null,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
  });

  it('deletes a community chat by leaving the club for non-owner members', async () => {
    const deleteCommunityMember = jest.fn().mockResolvedValue({ count: 1 });
    const deleteChatMember = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.community,
              event: null,
              eveningSession: null,
              community: {
                id: 'community-1',
                createdById: 'owner-1',
              },
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            communityMember: {
              deleteMany: deleteCommunityMember,
            },
            chatMember: {
              deleteMany: deleteChatMember,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'community',
      eventId: null,
      communityId: 'community-1',
    });
    expect(deleteCommunityMember).toHaveBeenCalledWith({
      where: {
        communityId: 'community-1',
        userId: 'user-me',
      },
    });
    expect(deleteChatMember).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
  });

  it('lets a community owner hide their club chat without leaving the club', async () => {
    const deleteCommunityMember = jest.fn();
    const deleteChatMember = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ChatsService({
      client: {
        chatMember: {
          findUnique: jest.fn().mockResolvedValue({
            chat: {
              id: 'chat-1',
              kind: ChatKind.community,
              event: null,
              eveningSession: null,
              community: {
                id: 'community-1',
                createdById: 'user-me',
              },
            },
          }),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            communityMember: {
              deleteMany: deleteCommunityMember,
            },
            chatMember: {
              deleteMany: deleteChatMember,
            },
          }),
        ),
      },
    } as any);
    jest
      .spyOn(service as any, 'scheduleChatPayloadCleanup')
      .mockImplementation(() => undefined);

    const result = await service.deleteChat('user-me', 'chat-1');

    expect(result).toEqual({
      id: 'chat-1',
      kind: 'community',
      eventId: null,
      communityId: 'community-1',
    });
    expect(deleteChatMember).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        userId: 'user-me',
      },
    });
    expect(deleteCommunityMember).not.toHaveBeenCalled();
  });

  it('cleans chat messages and media when a deleted chat has no members left', async () => {
    const chatMemberCount = jest.fn().mockResolvedValue(0);
    const mediaAssetFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'asset-1' }, { id: 'asset-2' }]);
    const notificationDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const realtimeEventDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const messageDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const mediaAssetDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const chatDelete = jest.fn().mockResolvedValue({});
    const service = new ChatsService({
      client: {
        $transaction: jest.fn((callback: any) =>
          callback({
            chatMember: {
              count: chatMemberCount,
            },
            mediaAsset: {
              findMany: mediaAssetFindMany,
              deleteMany: mediaAssetDeleteMany,
            },
            notification: {
              deleteMany: notificationDeleteMany,
            },
            realtimeEvent: {
              deleteMany: realtimeEventDeleteMany,
            },
            message: {
              deleteMany: messageDeleteMany,
            },
            chat: {
              delete: chatDelete,
            },
          }),
        ),
      },
    } as any);

    await (service as any).cleanupChatPayloadIfEmpty('chat-1', ChatKind.direct);

    expect(chatMemberCount).toHaveBeenCalledWith({
      where: { chatId: 'chat-1' },
    });
    expect(messageDeleteMany).toHaveBeenCalledWith({
      where: { chatId: 'chat-1' },
    });
    expect(mediaAssetDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['asset-1', 'asset-2'] },
        chatId: 'chat-1',
        kind: {
          in: [MediaAssetKind.chat_attachment, MediaAssetKind.chat_voice],
        },
      },
    });
    expect(chatDelete).toHaveBeenCalledWith({
      where: { id: 'chat-1' },
    });
  });

  it('maps paid affiche ticket summary for meetup chats', async () => {
    const chat = makeChatListItem(
      'chat-affiche',
      new Date('2026-04-24T10:00:00.000Z'),
    ) as any;
    chat.event.sourceExternalContentItem = {
      id: 'affiche-1',
      priceFrom: 2500,
      priceMode: 'paid',
      actionUrl: 'https://affiliate.example/show',
      sourceProvider: 'Ticketland',
      venueName: 'Live Arena',
    };
    chat.members = [
      {
        userId: 'user-me',
        user: {
          id: 'user-me',
          displayName: 'Ты',
          online: true,
        },
      },
    ];

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([chat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...makeSocialClient(),
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(result.items[0]).toMatchObject({
      id: 'chat-affiche',
      ticketUrl: 'https://affiliate.example/show',
      ticketSourceKind: 'affiche',
      ticketSourceId: 'affiche-1',
      ticketPriceFrom: 2500,
      ticketProvider: 'Ticketland',
      ticketVenue: 'Live Arena',
    });
  });

  it('does not expose ticket summary for free affiche meetup chats', async () => {
    const chat = makeChatListItem(
      'chat-affiche-free',
      new Date('2026-04-24T10:00:00.000Z'),
    ) as any;
    chat.event.sourceExternalContentItem = {
      id: 'affiche-free',
      priceFrom: 0,
      priceMode: 'free',
      actionUrl: 'https://free.example/show',
      sourceProvider: 'KudaGo',
      venueName: 'Гараж',
    };
    chat.members = [
      {
        userId: 'user-me',
        user: {
          id: 'user-me',
          displayName: 'Ты',
          online: true,
        },
      },
    ];

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([chat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...makeSocialClient(),
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(result.items[0]).toMatchObject({
      id: 'chat-affiche-free',
      ticketUrl: null,
      ticketSourceKind: null,
      ticketSourceId: null,
      ticketPriceFrom: null,
      ticketProvider: null,
      ticketVenue: null,
    });
  });

  it('exposes meetup member profiles with user ids for direct chat actions', async () => {
    const chat = makeChatListItem(
      'chat-members',
      new Date('2026-04-24T10:00:00.000Z'),
    ) as any;
    chat.members = [
      {
        userId: 'user-me',
        user: {
          id: 'user-me',
          displayName: 'Сергей',
          online: true,
        },
      },
      {
        userId: 'user-sonya',
        user: {
          id: 'user-sonya',
          displayName: 'Соня М',
          online: false,
        },
      },
    ];

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([chat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...makeSocialClient({
          userFollow: {
            groupBy: jest.fn().mockResolvedValue([
              { targetUserId: 'user-sonya', _count: { _all: 5 } },
            ]),
            findMany: jest.fn().mockResolvedValue([
              { targetUserId: 'user-sonya' },
            ]),
          },
          profileReaction: {
            groupBy: jest.fn().mockResolvedValue([
              {
                targetUserId: 'user-sonya',
                kind: 'like',
                _count: { _all: 9 },
              },
              {
                targetUserId: 'user-sonya',
                kind: 'super_like',
                _count: { _all: 1 },
              },
            ]),
            findMany: jest.fn().mockResolvedValue([
              { targetUserId: 'user-sonya', kind: 'super_like' },
            ]),
          },
        }),
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', { limit: 20 });

    expect(result.items[0]).toMatchObject({
      id: 'chat-members',
      memberProfiles: [
        {
          userId: 'user-me',
          name: 'Сергей',
          online: true,
          isCurrentUser: true,
        },
        {
          userId: 'user-sonya',
          name: 'Соня М',
          online: false,
          isCurrentUser: false,
          social: {
            followers: 5,
            likes: 9,
            superLikes: 1,
            iFollow: true,
            iLike: false,
            iSuper: true,
          },
        },
      ],
    });
  });

  it('can skip social previews for compact meetup chat lists', async () => {
    const chat = makeChatListItem(
      'chat-compact',
      new Date('2026-04-24T10:00:00.000Z'),
    ) as any;
    chat.members = [
      {
        userId: 'user-me',
        user: {
          id: 'user-me',
          displayName: 'Сергей',
          online: true,
        },
      },
      {
        userId: 'user-sonya',
        user: {
          id: 'user-sonya',
          displayName: 'Соня М',
          online: false,
        },
      },
    ];
    const socialClient = makeSocialClient();

    const service = new ChatsService({
      client: {
        chat: {
          findMany: jest.fn().mockResolvedValue([chat]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...socialClient,
      },
    } as any);

    const result = await service.listChats('user-me', 'meetup', {
      limit: 20,
      includeSocial: false,
    } as any);

    expect(socialClient.userFollow.groupBy).not.toHaveBeenCalled();
    expect(socialClient.userFollow.findMany).not.toHaveBeenCalled();
    expect(socialClient.profileReaction.groupBy).not.toHaveBeenCalled();
    expect(socialClient.profileReaction.findMany).not.toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({
      id: 'chat-compact',
      memberProfiles: [
        {
          userId: 'user-me',
          name: 'Сергей',
          online: true,
          isCurrentUser: true,
          social: emptySocialPreview(),
        },
        {
          userId: 'user-sonya',
          name: 'Соня М',
          online: false,
          isCurrentUser: false,
          social: emptySocialPreview(),
        },
      ],
    });
  });

  it('uses chat list cursor payload without reading the cursor chat again', async () => {
    const firstChat = makeChatListItem(
      'chat-2',
      new Date('2026-04-24T10:00:00.000Z'),
    );
    const secondChat = makeChatListItem(
      'chat-1',
      new Date('2026-04-23T10:00:00.000Z'),
    );
    const chatFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstChat, secondChat])
      .mockResolvedValueOnce([]);
    const chatFindUnique = jest.fn().mockResolvedValue({
      id: firstChat.id,
      updatedAt: firstChat.updatedAt,
    });
    const service = new ChatsService({
      client: {
        chat: {
          findMany: chatFindMany,
          findUnique: chatFindUnique,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        chatMember: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      },
    } as any);

    const firstPage = await service.listChats('user-me', 'meetup', { limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listChats('user-me', 'meetup', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(chatFindUnique).not.toHaveBeenCalled();
    expect(chatFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        updatedAt: {
          lt: firstChat.updatedAt,
        },
      },
      {
        updatedAt: firstChat.updatedAt,
        id: {
          lt: firstChat.id,
        },
      },
    ]);
  });

  it('wraps chat list responses with a stable ETag', async () => {
    const service = new ChatsService({ client: {} } as any);
    const payload = {
      items: [
        {
          id: 'chat-1',
          lastMessageId: 'message-1',
          unread: 2,
          isPinned: false,
        },
      ],
      nextCursor: null,
    };
    jest.spyOn(service, 'listChats').mockResolvedValue(payload as any);

    const first = await service.listChatsWithCache(
      'user-me',
      'meetup',
      { limit: 20 },
      undefined,
    );
    const second = await service.listChatsWithCache(
      'user-me',
      'meetup',
      { limit: 20 },
      undefined,
    );

    expect(first).toEqual({
      etag: expect.stringMatching(/^W\/"chat-list-[a-f0-9]{32}"$/),
      response: payload,
    });
    expect(second).toEqual(first);
  });

  it('returns not modified when a chat list ETag matches If-None-Match', async () => {
    const service = new ChatsService({ client: {} } as any);
    const payload = {
      items: [{ id: 'chat-1', lastMessageId: 'message-1', unread: 0 }],
      nextCursor: null,
    };
    jest.spyOn(service, 'listChats').mockResolvedValue(payload as any);

    const first = await service.listChatsWithCache(
      'user-me',
      'direct',
      { limit: 20 },
      undefined,
    );
    const fresh = await service.listChatsWithCache(
      'user-me',
      'direct',
      { limit: 20 },
      `W/"stale", ${first.etag}`,
    );
    const stale = await service.listChatsWithCache(
      'user-me',
      'direct',
      { limit: 20 },
      'W/"stale"',
    );

    expect(fresh).toEqual({
      etag: first.etag,
      notModified: true,
    });
    expect(stale).toEqual({
      etag: first.etag,
      response: payload,
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

  it('starts latest event lookup while message page is still loading', async () => {
    let resolveMessages!: (value: any[]) => void;
    const messageFindMany = jest.fn(
      () =>
        new Promise<any[]>((resolve) => {
          resolveMessages = resolve;
        }),
    );
    const realtimeEventFindFirst = jest.fn().mockResolvedValue({ id: BigInt(7) });
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
          findMany: jest.fn().mockResolvedValue([]),
        },
        message: {
          findMany: messageFindMany,
        },
        realtimeEvent: {
          findFirst: realtimeEventFindFirst,
        },
      },
    } as any);

    const resultPromise = service.getMessages('user-me', 'chat-1', { limit: 20 });

    await new Promise((resolve) => setImmediate(resolve));

    expect(messageFindMany).toHaveBeenCalledTimes(1);
    expect(realtimeEventFindFirst).toHaveBeenCalledTimes(1);

    resolveMessages([]);

    await expect(resultPromise).resolves.toEqual({
      currentUserId: 'user-me',
      items: [],
      nextCursor: null,
      lastEventId: '7',
    });
  });

  it('uses message cursor payload without reading the cursor message again', async () => {
    const newerMessage = makeMessage(
      'message-2',
      new Date('2026-04-24T10:00:00.000Z'),
    );
    const olderMessage = makeMessage(
      'message-1',
      new Date('2026-04-24T09:00:00.000Z'),
    );
    const messageFindMany = jest
      .fn()
      .mockResolvedValueOnce([newerMessage, olderMessage])
      .mockResolvedValueOnce([]);
    const messageFindFirst = jest.fn().mockResolvedValue({
      id: newerMessage.id,
      createdAt: newerMessage.createdAt,
    });
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
          findMany: jest.fn().mockResolvedValue([]),
        },
        message: {
          findFirst: messageFindFirst,
          findMany: messageFindMany,
        },
        realtimeEvent: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    } as any);

    const firstPage = await service.getMessages('user-me', 'chat-1', { limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.getMessages('user-me', 'chat-1', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(messageFindFirst).not.toHaveBeenCalled();
    expect(messageFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        createdAt: {
          lt: newerMessage.createdAt,
        },
      },
      {
        createdAt: newerMessage.createdAt,
        id: {
          lt: newerMessage.id,
        },
      },
    ]);
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
