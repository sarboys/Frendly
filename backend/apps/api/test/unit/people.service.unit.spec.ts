import { PeopleService } from '../../src/services/people.service';

describe('PeopleService unit', () => {
  it('caps people search query before building contains filters', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new PeopleService({
      client: {
        onboardingPreferences: {
          findUnique: jest.fn().mockResolvedValue({
            interests: [],
          }),
        },
        user: {
          findMany: userFindMany,
          findUnique: jest.fn(),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await service.listPeople('user-me', {
      q: `  ${'аня'.repeat(30)}  `,
    });

    const where = userFindMany.mock.calls[0][0].where as any;
    const searchCondition = where.OR.find(
      (condition: any) => condition.displayName?.contains != null,
    );

    expect(searchCondition.displayName.contains).toHaveLength(64);
    expect(searchCondition.displayName.contains).toBe('аня'.repeat(30).slice(0, 64));
  });

  it('loads only primary profile photo data for people summaries', async () => {
    const userFindMany = jest.fn().mockResolvedValue([
      {
        id: 'user-peer',
        displayName: 'Аня',
        online: true,
        verified: false,
        profile: {
          age: 27,
          area: 'Центр',
          vibe: 'Спокойно',
          avatarUrl: null,
          photos: [],
        },
        onboarding: {
          interests: ['кино'],
        },
        settings: {
          showAge: true,
        },
      },
    ]);
    const service = new PeopleService({
      client: {
        onboardingPreferences: {
          findUnique: jest.fn().mockResolvedValue({
            interests: ['кино'],
          }),
        },
        user: {
          findMany: userFindMany,
          findUnique: jest.fn(),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await service.listPeople('user-me', {});

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
  });
});
