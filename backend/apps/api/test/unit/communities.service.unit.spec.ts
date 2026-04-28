import { Prisma } from '@prisma/client';
import { CommunitiesService } from '../../src/services/communities.service';

const flattenSql = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(flattenSql).join(' ');
  }

  if (value != null && typeof value === 'object') {
    const sql = value as { strings?: unknown; values?: unknown };
    const strings = Array.isArray(sql.strings)
      ? sql.strings.map(String).join(' ')
      : '';
    const values = Array.isArray(sql.values)
      ? sql.values.map(flattenSql).join(' ')
      : '';
    return `${strings} ${values}`;
  }

  return String(value ?? '');
};

describe('CommunitiesService unit', () => {
  afterEach(() => {
    delete process.env.CHAT_UNREAD_COUNTER_READS;
  });

  const makeCommunity = (id: string, createdAt: Date) => ({
    id,
    chatId: `${id}-chat`,
    name: `Community ${id}`,
    avatar: '*',
    description: 'Community',
    privacy: 'public',
    createdById: 'owner-user',
    tags: [],
    joinRule: 'Open',
    premiumOnly: false,
    mood: 'Calm',
    sharedMediaLabel: '0 media',
    createdAt,
    _count: { members: 10 },
    members: [],
    news: [],
    meetups: [],
    media: [],
    socialLinks: [],
    chat: {
      messages: [],
    },
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
    const unreadSql = flattenSql(queryRaw.mock.calls[0]);
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

  it('reuses loaded blocked user ids for community unread fallback when counters are enabled', async () => {
    process.env.CHAT_UNREAD_COUNTER_READS = 'true';
    const queryRaw = jest.fn().mockResolvedValue([
      {
        chat_id: 'chat-1',
        unread_count: BigInt(1),
      },
    ]);
    const service = new CommunitiesService(
      {
        client: {
          communityMember: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
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

    await (service as any).loadCounters('user-me', [
      {
        communityId: 'community-1',
        chatId: 'chat-1',
      },
    ]);

    const unreadSql = flattenSql(queryRaw.mock.calls[0]);
    expect(unreadSql).toContain('m."senderId" NOT IN');
    expect(unreadSql).not.toContain('"UserBlock"');
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

  it('uses community list cursor payload without reading the cursor community again', async () => {
    const firstCommunity = makeCommunity(
      'community-1',
      new Date('2026-04-24T10:00:00.000Z'),
    );
    const secondCommunity = makeCommunity(
      'community-2',
      new Date('2026-04-25T10:00:00.000Z'),
    );
    const communityFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstCommunity, secondCommunity])
      .mockResolvedValueOnce([]);
    const communityFindUnique = jest.fn().mockResolvedValue({
      id: firstCommunity.id,
      createdAt: firstCommunity.createdAt,
    });
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findMany: communityFindMany,
            findUnique: communityFindUnique,
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

    const firstPage = await service.listCommunities('user-me', { limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listCommunities('user-me', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(communityFindUnique).not.toHaveBeenCalled();
    expect(communityFindMany.mock.calls[1][0].where).toEqual({
      OR: [
        {
          createdAt: {
            gt: firstCommunity.createdAt,
          },
        },
        {
          createdAt: firstCommunity.createdAt,
          id: {
            gt: firstCommunity.id,
          },
        },
      ],
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

  it('uses community media cursor payload without reading the cursor media row again', async () => {
    const firstMedia = {
      id: 'media-1',
      communityId: 'community-1',
      emoji: '*',
      label: 'First',
      kind: 'photo',
      sortOrder: 0,
    };
    const secondMedia = {
      id: 'media-2',
      communityId: 'community-1',
      emoji: '*',
      label: 'Second',
      kind: 'photo',
      sortOrder: 1,
    };
    const thirdMedia = {
      id: 'media-3',
      communityId: 'community-1',
      emoji: '*',
      label: 'Third',
      kind: 'photo',
      sortOrder: 2,
    };
    const mediaFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstMedia, secondMedia, thirdMedia])
      .mockResolvedValueOnce([]);
    const mediaFindUnique = jest.fn().mockResolvedValue({
      id: secondMedia.id,
      communityId: 'community-1',
      sortOrder: secondMedia.sortOrder,
    });
    const service = new CommunitiesService(
      {
        client: {
          community: {
            findFirst: jest.fn().mockResolvedValue({ id: 'community-1' }),
          },
          communityMediaItem: {
            findMany: mediaFindMany,
            findUnique: mediaFindUnique,
          },
        },
      } as any,
      {} as any,
    );

    const firstPage = await service.listCommunityMedia('user-me', 'community-1', {
      limit: 2,
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listCommunityMedia('user-me', 'community-1', {
      cursor: firstPage.nextCursor!,
      limit: 2,
    });

    expect(mediaFindUnique).not.toHaveBeenCalled();
    expect(mediaFindMany.mock.calls[1][0].where).toEqual({
      AND: [
        { communityId: 'community-1' },
        {
          OR: [
            { sortOrder: { gt: secondMedia.sortOrder } },
            {
              sortOrder: secondMedia.sortOrder,
              id: { gt: secondMedia.id },
            },
          ],
        },
      ],
    });
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
