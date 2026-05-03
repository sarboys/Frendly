import { MatchesService } from '../../src/services/matches.service';

describe('MatchesService unit', () => {
  const matchedUser = {
    id: 'peer-1',
    displayName: 'Peer',
    profile: {
      avatarUrl: null,
      area: 'Центр',
      vibe: 'Спокойно',
      photos: [
        {
          id: 'photo-1',
          sortOrder: 1,
          mediaAsset: {
            id: 'asset-1',
            kind: 'profile_photo',
            mimeType: 'image/jpeg',
            byteSize: 1234,
            durationMs: null,
            publicUrl: 'https://cdn.test/photo-1.jpg',
          },
        },
        {
          id: 'photo-2',
          sortOrder: 2,
          mediaAsset: {
            id: 'asset-2',
            kind: 'profile_photo',
            mimeType: 'image/jpeg',
            byteSize: 1234,
            durationMs: null,
            publicUrl: 'https://cdn.test/photo-2.jpg',
          },
        },
      ],
    },
    onboarding: { interests: ['coffee'] },
    settings: { discoverable: true },
  };

  it('lists dating matches from reciprocal positive dating actions', async () => {
    const datingActionFindMany = jest.fn().mockResolvedValue([
      {
        actorUserId: 'user-me',
        targetUserId: 'peer-1',
        updatedAt: new Date('2026-05-03T10:00:00.000Z'),
      },
    ]);
    const userFindMany = jest.fn().mockResolvedValue([matchedUser]);
    const currentUserFindUnique = jest.fn().mockResolvedValue({
      onboarding: { interests: ['coffee'] },
    });
    const service = new MatchesService({
      client: {
        datingAction: {
          findMany: datingActionFindMany,
        },
        eventFavorite: {
          findMany: jest.fn(),
        },
        user: {
          findMany: userFindMany,
          findUnique: currentUserFindUnique,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    const result = await service.listMatches('user-me');

    expect(datingActionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUserId: 'user-me',
          action: {
            in: ['like', 'super_like'],
          },
          targetUser: expect.objectContaining({
            datingActionsSent: {
              some: {
                targetUserId: 'user-me',
                action: {
                  in: ['like', 'super_like'],
                },
              },
            },
          }),
        }),
        orderBy: [{ updatedAt: 'desc' }, { targetUserId: 'asc' }],
        take: 21,
      }),
    );
    expect((service as any).prismaService.client.eventFavorite.findMany).not.toHaveBeenCalled();
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          profile: expect.objectContaining({
            select: expect.objectContaining({
              photos: expect.objectContaining({
                take: 1,
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      userId: 'peer-1',
      avatarUrl: 'https://cdn.test/photo-1.jpg',
      photos: expect.any(Array),
      eventId: null,
      eventTitle: 'Взаимная симпатия',
    });
  });

  it('uses a stable dating action cursor for the next match page', async () => {
    const datingActionFindMany = jest.fn().mockResolvedValue([
      {
        actorUserId: 'user-me',
        targetUserId: 'peer-1',
        updatedAt: new Date('2026-05-03T10:00:00.000Z'),
      },
      {
        actorUserId: 'user-me',
        targetUserId: 'peer-2',
        updatedAt: new Date('2026-05-03T09:00:00.000Z'),
      },
    ]);
    const service = new MatchesService({
      client: {
        datingAction: {
          findMany: datingActionFindMany,
        },
        user: {
          findMany: jest.fn().mockResolvedValue([matchedUser]),
          findUnique: jest.fn().mockResolvedValue({
            onboarding: { interests: ['coffee'] },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    const firstPage = await service.listMatches('user-me', { limit: 1 });
    await service.listMatches('user-me', {
      limit: 1,
      cursor: firstPage.nextCursor!,
    });

    expect(datingActionFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        updatedAt: {
          lt: new Date('2026-05-03T10:00:00.000Z'),
        },
      },
      {
        updatedAt: new Date('2026-05-03T10:00:00.000Z'),
        targetUserId: {
          gt: 'peer-1',
        },
      },
    ]);
  });
});
