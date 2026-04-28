import { MatchesService } from '../../src/services/matches.service';

describe('MatchesService unit', () => {
  it('loads only the primary photo preview for match list users', async () => {
    const favoriteFindMany = jest
      .fn()
      .mockResolvedValueOnce([{ targetUserId: 'peer-1' }])
      .mockResolvedValueOnce([
        {
          targetUserId: 'peer-1',
          eventId: 'event-1',
          event: { title: 'Кофе' },
        },
      ])
      .mockResolvedValueOnce([
        {
          sourceUserId: 'peer-1',
          targetUserId: 'user-me',
          eventId: 'event-1',
        },
      ]);
    const userFindMany = jest.fn().mockResolvedValue([
      {
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
      },
    ]);
    const currentUserFindUnique = jest.fn().mockResolvedValue({
      onboarding: { interests: ['coffee'] },
    });
    const service = new MatchesService({
      client: {
        eventFavorite: {
          findMany: favoriteFindMany,
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

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          displayName: true,
          profile: expect.objectContaining({
            select: expect.objectContaining({
              avatarUrl: true,
              area: true,
              vibe: true,
              photos: expect.objectContaining({
                take: 1,
                select: expect.objectContaining({
                  id: true,
                  sortOrder: true,
                  mediaAsset: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      kind: true,
                      mimeType: true,
                      byteSize: true,
                      durationMs: true,
                      publicUrl: true,
                    }),
                  }),
                }),
              }),
            }),
          }),
          onboarding: {
            select: {
              interests: true,
            },
          },
        }),
      }),
    );
    expect(currentUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      select: {
        onboarding: {
          select: {
            interests: true,
          },
        },
      },
    });
    expect(favoriteFindMany.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        select: {
          targetUserId: true,
          eventId: true,
          event: {
            select: {
              title: true,
            },
          },
        },
      }),
    );
    expect(favoriteFindMany.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        select: {
          sourceUserId: true,
          eventId: true,
        },
      }),
    );
    expect(result.items[0]!.avatarUrl).toBe('https://cdn.test/photo-1.jpg');
    expect(result.items[0]!.photos).toHaveLength(1);
  });

  it('reuses current user onboarding across match batches', async () => {
    const firstTargetPage = Array.from({ length: 20 }, (_, index) => ({
      targetUserId: `peer-empty-${index}`,
    }));
    const favoriteFindMany = jest
      .fn()
      .mockResolvedValueOnce(firstTargetPage)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ targetUserId: 'peer-final' }])
      .mockResolvedValueOnce([
        {
          targetUserId: 'peer-final',
          eventId: 'event-1',
          event: { title: 'Кофе' },
        },
      ])
      .mockResolvedValueOnce([
        {
          sourceUserId: 'peer-final',
          targetUserId: 'user-me',
          eventId: 'event-1',
        },
      ]);
    const currentUserFindUnique = jest.fn().mockResolvedValue({
      onboarding: { interests: ['coffee'] },
    });
    const service = new MatchesService({
      client: {
        eventFavorite: {
          findMany: favoriteFindMany,
        },
        user: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              {
                id: 'peer-final',
                displayName: 'Peer',
                profile: {
                  avatarUrl: null,
                  area: null,
                  vibe: null,
                  photos: [],
                },
                onboarding: { interests: ['coffee'] },
                settings: { discoverable: true },
              },
            ]),
          findUnique: currentUserFindUnique,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    const result = await service.listMatches('user-me', { limit: 1 });

    expect(currentUserFindUnique).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
  });
});
