import { StoriesService } from '../../src/services/stories.service';

const story = (id: string, authorId: string, createdAt: Date) => ({
  id,
  eventId: 'event-1',
  authorId,
  caption: `story ${id}`,
  emoji: '*',
  createdAt,
  author: {
    displayName: `User ${authorId}`,
    profile: {
      avatarUrl: null,
    },
  },
  mediaAsset: null,
});

describe('StoriesService', () => {
  it('returns the existing story when media create is retried', async () => {
    const existingStory = story(
      'story-existing',
      'user-me',
      new Date('2026-01-01T00:01:00Z'),
    );
    const eventStoryFindFirst = jest.fn().mockResolvedValue(existingStory);
    const client = {
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ hostId: 'host-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventStory: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockRejectedValue({
          code: 'P2002',
          meta: { target: ['mediaAssetId'] },
        }),
        findFirst: eventStoryFindFirst,
      },
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          ownerId: 'user-me',
          kind: 'story_media',
          status: 'ready',
        }),
      },
    };
    const service = new StoriesService({ client } as any);

    await expect(
      service.createStory('user-me', 'event-1', {
        mediaAssetId: 'asset-1',
      }),
    ).resolves.toMatchObject({
      id: 'story-existing',
      eventId: 'event-1',
      authorId: 'user-me',
    });

    expect(eventStoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mediaAssetId: 'asset-1',
          eventId: 'event-1',
          authorId: 'user-me',
        },
      }),
    );
  });

  it('returns an existing media story retry before applying rate limits', async () => {
    const existingStory = story(
      'story-existing',
      'user-me',
      new Date('2026-01-01T00:01:00Z'),
    );
    const eventStoryFindFirst = jest.fn().mockResolvedValue(existingStory);
    const eventStoryCount = jest.fn().mockResolvedValue(10);
    const mediaAssetFindFirst = jest.fn();
    const eventStoryCreate = jest.fn();
    const client = {
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ hostId: 'host-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventStory: {
        count: eventStoryCount,
        create: eventStoryCreate,
        findFirst: eventStoryFindFirst,
      },
      mediaAsset: {
        findFirst: mediaAssetFindFirst,
      },
    };
    const service = new StoriesService({ client } as any);

    await expect(
      service.createStory('user-me', 'event-1', {
        mediaAssetId: 'asset-1',
      }),
    ).resolves.toMatchObject({
      id: 'story-existing',
      eventId: 'event-1',
      authorId: 'user-me',
    });

    expect(eventStoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mediaAssetId: 'asset-1',
          eventId: 'event-1',
          authorId: 'user-me',
        },
      }),
    );
    expect(eventStoryCount).not.toHaveBeenCalled();
    expect(mediaAssetFindFirst).not.toHaveBeenCalled();
    expect(eventStoryCreate).not.toHaveBeenCalled();
  });

  it('starts media asset validation while recent story count is still loading', async () => {
    let resolveCount!: (value: number) => void;
    const eventStoryCount = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveCount = resolve;
        }),
    );
    const mediaAssetFindFirst = jest.fn().mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-me',
      kind: 'story_media',
      status: 'ready',
    });
    const createdStory = story(
      'story-new',
      'user-me',
      new Date('2026-01-01T00:01:00Z'),
    );
    const client = {
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ hostId: 'host-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventStory: {
        count: eventStoryCount,
        create: jest.fn().mockResolvedValue(createdStory),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      mediaAsset: {
        findFirst: mediaAssetFindFirst,
      },
    };
    const service = new StoriesService({ client } as any);

    const resultPromise = service.createStory('user-me', 'event-1', {
      mediaAssetId: 'asset-1',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(eventStoryCount).toHaveBeenCalledTimes(1);
    expect(mediaAssetFindFirst).toHaveBeenCalledTimes(1);
    expect(mediaAssetFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'asset-1',
        ownerId: 'user-me',
        kind: 'story_media',
        status: 'ready',
      },
      select: {
        id: true,
      },
    });

    resolveCount(0);

    await expect(resultPromise).resolves.toMatchObject({
      id: 'story-new',
    });
  });

  it('filters blocked story authors in the database query', async () => {
    const userBlockFindMany = jest.fn().mockResolvedValue([
      {
        userId: 'viewer-1',
        blockedUserId: 'blocked-author',
      },
    ]);
    const eventStoryFindMany = jest.fn().mockResolvedValue([
      story('story-2', 'allowed-author-2', new Date('2026-01-01T00:02:00Z')),
      story('story-1', 'allowed-author-1', new Date('2026-01-01T00:01:00Z')),
    ]);
    const client = {
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ hostId: 'host-1' }),
      },
      userBlock: {
        findMany: userBlockFindMany,
      },
      eventStory: {
        findMany: eventStoryFindMany,
      },
    };
    const service = new StoriesService({ client } as any);

    const result = await service.listStories('viewer-1', 'event-1', {
      limit: 1,
    });

    expect(userBlockFindMany).toHaveBeenCalledTimes(1);
    expect(eventStoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'event-1',
          authorId: {
            notIn: ['blocked-author'],
          },
        }),
        select: {
          id: true,
          eventId: true,
          authorId: true,
          caption: true,
          emoji: true,
          createdAt: true,
          author: {
            select: {
              displayName: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
          mediaAsset: {
            select: {
              id: true,
              kind: true,
              objectKey: true,
              mimeType: true,
              byteSize: true,
              durationMs: true,
              publicUrl: true,
            },
          },
        },
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.authorId).toBe('allowed-author-2');
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('uses story cursor payload without reading the cursor story again', async () => {
    const firstStory = story(
      'story-2',
      'allowed-author-2',
      new Date('2026-01-01T00:02:00Z'),
    );
    const secondStory = story(
      'story-1',
      'allowed-author-1',
      new Date('2026-01-01T00:01:00Z'),
    );
    const eventStoryFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstStory, secondStory])
      .mockResolvedValueOnce([]);
    const eventStoryFindFirst = jest.fn().mockResolvedValue({
      id: firstStory.id,
      createdAt: firstStory.createdAt,
    });
    const client = {
      eventParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ hostId: 'host-1' }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventStory: {
        findMany: eventStoryFindMany,
        findFirst: eventStoryFindFirst,
      },
    };
    const service = new StoriesService({ client } as any);

    const firstPage = await service.listStories('viewer-1', 'event-1', {
      limit: 1,
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listStories('viewer-1', 'event-1', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(eventStoryFindFirst).not.toHaveBeenCalled();
    expect(eventStoryFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        createdAt: {
          lt: firstStory.createdAt,
        },
      },
      {
        createdAt: firstStory.createdAt,
        id: {
          lt: firstStory.id,
        },
      },
    ]);
  });
});
