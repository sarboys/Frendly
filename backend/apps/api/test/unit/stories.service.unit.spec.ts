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
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.authorId).toBe('allowed-author-2');
    expect(result.nextCursor).toEqual(expect.any(String));
  });
});
