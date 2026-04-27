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
    const service = new MatchesService({
      client: {
        eventFavorite: {
          findMany: favoriteFindMany,
        },
        user: {
          findMany: userFindMany,
          findUnique: jest.fn().mockResolvedValue({
            onboarding: { interests: ['coffee'] },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    const result = await service.listMatches('user-me');

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          profile: expect.objectContaining({
            include: expect.objectContaining({
              photos: expect.objectContaining({
                take: 1,
              }),
            }),
          }),
        }),
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
