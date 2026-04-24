import { Prisma } from '@prisma/client';
import { CommunitiesService } from '../../src/services/communities.service';

describe('CommunitiesService unit', () => {
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
        },
      } as any,
      {} as any,
    );

    await service.getCommunity('user-me', 'community-1');

    expect(communityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          news: expect.objectContaining({ take: 3 }),
          meetups: expect.objectContaining({ take: 10 }),
          media: expect.objectContaining({ take: 12 }),
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
