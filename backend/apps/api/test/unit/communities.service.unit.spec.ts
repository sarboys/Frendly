import { Prisma } from '@prisma/client';
import { CommunitiesService } from '../../src/services/communities.service';

describe('CommunitiesService unit', () => {
  afterEach(() => {
    delete process.env.CHAT_UNREAD_COUNTER_READS;
  });

  it('counts community chat unread messages from chat member read state, not notifications', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(2),
      },
    ]);
    const service = new CommunitiesService(
      {
        client: {
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
          },
          notification: {
            groupBy: jest.fn(),
          },
          $queryRaw: queryRaw,
        },
      } as any,
      {} as any,
    );

    const counters = await (service as any).loadCounters('user-me', [
      {
        communityId: 'community-1',
        chatId: 'chat-1',
      },
    ]);

    expect(counters.unreadByChatId).toEqual(new Map([['chat-1', 2]]));
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const unreadQuery = queryRaw.mock.calls[0][0] as any;
    const unreadSql = Array.isArray(unreadQuery)
      ? unreadQuery.join(' ')
      : unreadQuery.strings.join(' ');
    expect(unreadSql).toContain('"UserBlock"');
    expect(unreadSql).toContain('"blockedUserId"');
    expect(
      (service as any).prismaService.client.notification.groupBy,
    ).not.toHaveBeenCalled();
  });

  it('reads community chat unread counters from ChatMember when enabled', async () => {
    process.env.CHAT_UNREAD_COUNTER_READS = 'true';
    const queryRaw = jest.fn();
    const chatMemberFindMany = jest.fn().mockResolvedValue([
      {
        chatId: 'chat-1',
        unreadCount: 5,
      },
    ]);
    const service = new CommunitiesService(
      {
        client: {
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
          },
          chatMember: {
            findMany: chatMemberFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: queryRaw,
        },
      } as any,
      {} as any,
    );

    const counters = await (service as any).loadCounters('user-me', [
      {
        communityId: 'community-1',
        chatId: 'chat-1',
      },
    ]);

    expect(counters.unreadByChatId).toEqual(new Map([['chat-1', 5]]));
    expect(chatMemberFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-me',
        chatId: {
          in: ['chat-1'],
        },
      },
      select: {
        chatId: true,
        unreadCount: true,
      },
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('falls back to raw community unread counts when counter reads would include blocked senders', async () => {
    process.env.CHAT_UNREAD_COUNTER_READS = 'true';
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(1),
      },
    ]);
    const chatMemberFindMany = jest.fn();
    const service = new CommunitiesService(
      {
        client: {
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
          },
          chatMember: {
            findMany: chatMemberFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([
              {
                userId: 'user-me',
                blockedUserId: 'blocked-user',
              },
            ]),
          },
          $queryRaw: queryRaw,
        },
      } as any,
      {} as any,
    );

    const counters = await (service as any).loadCounters('user-me', [
      {
        communityId: 'community-1',
        chatId: 'chat-1',
      },
    ]);

    expect(counters.unreadByChatId).toEqual(new Map([['chat-1', 1]]));
    expect(chatMemberFindMany).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('loads online counters with groupBy instead of all online member rows',
    async () => {
      const communityFindMany = jest.fn().mockResolvedValue([
        {
          id: 'community-1',
          chatId: 'community-1-chat',
          name: 'City Rituals',
          avatar: '🌿',
          description: 'Клуб',
          privacy: 'public',
          tags: ['city'],
          joinRule: 'Открытое вступление',
          premiumOnly: true,
          mood: 'Городской клуб',
          sharedMediaLabel: '0 медиа',
          _count: { members: 1000 },
          members: [
            {
              user: {
                displayName: 'Аня',
                online: true,
              },
            },
          ],
          news: [],
          meetups: [],
          media: [],
          socialLinks: [],
          chat: {
            messages: [],
          },
        },
      ]);
      const onlineGroupBy = jest.fn().mockResolvedValue([
        {
          communityId: 'community-1',
          _count: { _all: 120 },
        },
      ]);
      const membershipFindMany = jest.fn().mockResolvedValue([
        {
          communityId: 'community-1',
          role: 'member',
        },
      ]);
      const service = new CommunitiesService(
        {
          client: {
            community: {
              findMany: communityFindMany,
              findUnique: jest.fn(),
            },
            communityMember: {
              groupBy: onlineGroupBy,
              findMany: membershipFindMany,
            },
            notification: {
              groupBy: jest.fn().mockResolvedValue([]),
            },
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        } as any,
        {} as any,
      );

      const result = await service.listCommunities('user-me', { limit: 20 });

      expect(result.items[0]!.online).toBe(120);
      expect(onlineGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['communityId'],
          where: {
            communityId: { in: ['community-1'] },
            user: { online: true },
          },
          _count: {
            _all: true,
          },
        }),
      );
      expect(membershipFindMany).toHaveBeenCalledWith({
        where: {
          communityId: { in: ['community-1'] },
          userId: 'user-me',
        },
        select: {
          communityId: true,
          role: true,
        },
      });
    });

  it('returns the existing community when a retry hits the same idempotency key',
    async () => {
      const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`createdById`,`idempotencyKey`)',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );
      const client = {
        community: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'community-existing' }),
        },
        $transaction: jest.fn().mockRejectedValue(duplicateKeyError),
      };
      const service = new CommunitiesService(
        { client } as any,
        {
          hasPremiumAccess: jest.fn().mockResolvedValue(true),
        } as any,
      );
      const communityDetail = {
        id: 'community-existing',
        name: 'Повторный клуб',
      };
      const getCommunity = jest
        .spyOn(service, 'getCommunity')
        .mockResolvedValue(communityDetail as any);

      await expect(
        service.createCommunity(
          'user-me',
          {
            name: 'Повторный клуб',
            avatar: '🌿',
            description: 'Проверяем повторный submit формы',
            privacy: 'public',
            purpose: 'Городской клуб',
          },
          'create-community-key',
        ),
      ).resolves.toBe(communityDetail);

      expect(client.community.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            createdById: 'user-me',
            idempotencyKey: 'create-community-key',
          },
        }),
      );
      expect(getCommunity).toHaveBeenCalledWith(
        'user-me',
        'community-existing',
      );
    });

  it('loads community detail with bounded nested preview data', async () => {
    const communityFindFirst = jest.fn().mockResolvedValue({
      id: 'community-1',
      chatId: 'community-1-chat',
      name: 'City Rituals',
      avatar: '🌿',
      description: 'Клуб',
      privacy: 'public',
      tags: ['city'],
      joinRule: 'Открытое вступление',
      premiumOnly: true,
      mood: 'Городской клуб',
      sharedMediaLabel: '120 медиа',
      _count: { members: 1000 },
      members: [],
      news: [],
      meetups: [],
      media: [],
      socialLinks: [],
      chat: {
        messages: [],
      },
    });
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: communityFindFirst,
          },
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
          },
            notification: {
              groupBy: jest.fn().mockResolvedValue([]),
            },
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        } as any,
      {} as any,
    );

    await service.getCommunity('user-me', 'community-1');

    expect(communityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          news: expect.objectContaining({ take: 3 }),
          meetups: expect.objectContaining({
            take: 10,
            where: {
              OR: [
                { startsAt: null },
                { startsAt: { gte: expect.any(Date) } },
              ],
            },
          }),
          media: expect.objectContaining({ take: 12 }),
        }),
      }),
    );
  });

  it('does not expose private community chat preview to non-members', async () => {
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'community-private',
              chatId: 'community-private-chat',
              name: 'Private table',
              avatar: '🍸',
              description: 'Закрытый клуб',
              privacy: 'private',
              createdById: 'user-owner',
              tags: [],
              joinRule: 'Ручное одобрение',
              premiumOnly: true,
              mood: 'Private dining',
              sharedMediaLabel: '0 медиа',
              _count: { members: 10 },
              members: [],
              news: [],
              meetups: [],
              media: [
                {
                  id: 'private-media-1',
                  emoji: '📸',
                  label: 'Private room',
                  kind: 'photo',
                },
              ],
              socialLinks: [],
              chat: {
                messages: [
                  {
                    sender: {
                      displayName: 'Owner',
                    },
                    text: 'Private invite code is 1234',
                    createdAt: new Date('2026-01-01T10:00:00Z'),
                  },
                ],
              },
            }),
          },
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        },
      } as any,
      {} as any,
    );

    const result = await service.getCommunity(
      'user-non-member',
      'community-private',
    );

    expect(result.joined).toBe(false);
    expect(result.chatPreview).toEqual([]);
    expect(result.media).toEqual([]);
  });

  it('loads community list with only upcoming meetup previews', async () => {
    const communityFindMany = jest.fn().mockResolvedValue([]);
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findMany: communityFindMany,
          },
        },
      } as any,
      {} as any,
    );

    await service.listCommunities('user-me', { limit: 20 });

    expect(communityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          meetups: expect.objectContaining({
            take: 2,
            where: {
              OR: [
                { startsAt: null },
                { startsAt: { gte: expect.any(Date) } },
              ],
            },
          }),
        }),
      }),
    );
  });

  it('returns community media as a cursor page', async () => {
    const mediaFindMany = jest.fn().mockResolvedValue([
      {
        id: 'media-1',
        emoji: '📸',
        label: 'Roof dinner',
        kind: 'photo',
        sortOrder: 0,
      },
      {
        id: 'media-2',
        emoji: '🎞️',
        label: 'Walk reel',
        kind: 'video',
        sortOrder: 1,
      },
      {
        id: 'media-3',
        emoji: '🗂️',
        label: 'Guide',
        kind: 'doc',
        sortOrder: 2,
      },
    ]);
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: jest.fn().mockResolvedValue({ id: 'community-1' }),
          },
          communityMediaItem: {
            findMany: mediaFindMany,
            findUnique: jest.fn(),
          },
        },
      } as any,
      {} as any,
    );

    const result = await service.listCommunityMedia('user-me', 'community-1', {
      limit: 2,
    });

    expect(result.items).toEqual([
      {
        id: 'media-1',
        emoji: '📸',
        label: 'Roof dinner',
        kind: 'photo',
      },
      {
        id: 'media-2',
        emoji: '🎞️',
        label: 'Walk reel',
        kind: 'video',
      },
    ]);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(mediaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { communityId: 'community-1' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        take: 3,
      }),
    );
  });

  it('rejects private community media pages for non-members', async () => {
    const communityFindFirst = jest.fn().mockResolvedValue(null);
    const mediaFindMany = jest.fn();
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: communityFindFirst,
          },
          communityMediaItem: {
            findMany: mediaFindMany,
            findUnique: jest.fn(),
          },
        },
      } as any,
      {} as any,
    );

    await expect(
      service.listCommunityMedia('user-non-member', 'community-private', {
        limit: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'community_not_found',
    });

    expect(mediaFindMany).not.toHaveBeenCalled();
    expect(communityFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'community-private',
        OR: [
          { privacy: 'public' },
          { createdById: 'user-non-member' },
          { members: { some: { userId: 'user-non-member' } } },
        ],
      },
      select: { id: true },
    });
  });

  it('creates a pinned community news item for the owner', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const create = jest.fn().mockResolvedValue({ id: 'news-new' });
    const client = {
      community: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'community-1',
          createdById: 'user-me',
          members: [],
        }),
      },
      communityNewsItem: {
        updateMany,
        create,
      },
      $transaction: jest.fn((callback) => callback({
        communityNewsItem: {
          updateMany,
          create,
        },
      })),
    };
    const service = new CommunitiesService(
      { client } as any,
      {} as any,
    );
    const getCommunity = jest
      .spyOn(service, 'getCommunity')
      .mockResolvedValue({ id: 'community-1', news: [] } as any);

    await service.createCommunityNews(
      'user-me',
      'community-1',
      {
        title: 'Новая встреча',
        body: 'Открыли запись на воскресный brunch.',
        pin: true,
      },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { communityId: 'community-1' },
      data: { sortOrder: { increment: 1 } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        communityId: 'community-1',
        title: 'Новая встреча',
        blurb: 'Открыли запись на воскресный brunch.',
        timeLabel: 'сейчас',
        sortOrder: 0,
      },
      select: { id: true },
    });
    expect(getCommunity).toHaveBeenCalledWith('user-me', 'community-1');
  });

  it(
    'accepts community news without title and body length validation',
    async () => {
      const create = jest.fn().mockResolvedValue({ id: 'news-new' });
      const client = {
        community: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'community-1',
            createdById: 'user-me',
            members: [],
          }),
        },
        communityNewsItem: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create,
        },
        $transaction: jest.fn((callback) => callback({
          communityNewsItem: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create,
          },
        })),
      };
      const service = new CommunitiesService(
        { client } as any,
        {} as any,
      );
      jest
        .spyOn(service, 'getCommunity')
        .mockResolvedValue({ id: 'community-1', news: [] } as any);

      await service.createCommunityNews('user-me', 'community-1', {
        title: 'Я',
        body: 'Ок',
        pin: true,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Я',
            blurb: 'Ок',
          }),
        }),
      );
    },
  );

  it('rejects community news creation for a non-owner', async () => {
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'community-1',
              createdById: 'user-host',
              members: [{ role: 'member' }],
            }),
          },
        },
      } as any,
      {} as any,
    );

    await expect(
      service.createCommunityNews(
        'user-me',
        'community-1',
        {
          title: 'Новая встреча',
          body: 'Открыли запись на воскресный brunch.',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'community_owner_required',
    });
  });
});
