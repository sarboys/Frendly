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

  it('does not create a direct chat with a hidden peer', async () => {
    const chatCreate = jest.fn();
    const service = new PeopleService({
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-hidden',
            settings: {
              discoverable: false,
            },
          }),
        },
        chat: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: chatCreate,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await expect(
      service.createOrGetDirectChat('user-me', 'user-hidden'),
    ).rejects.toMatchObject({
      code: 'user_not_found',
    });
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it('does not mask unexpected direct chat create failures as conflicts', async () => {
    const createError = new Error('database unavailable');
    const service = new PeopleService({
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-peer',
            settings: {
              discoverable: true,
            },
          }),
        },
        chat: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue(createError),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await expect(
      service.createOrGetDirectChat('user-me', 'user-peer'),
    ).rejects.toBe(createError);
  });

  it('returns the duplicate direct chat when concurrent create hits directKey unique constraint', async () => {
    const duplicateChat = { id: 'chat-existing', directKey: 'user-me:user-peer' };
    const service = new PeopleService({
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-peer',
            settings: {
              discoverable: true,
            },
          }),
        },
        chat: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(duplicateChat),
          create: jest.fn().mockRejectedValue({
            code: 'P2002',
            meta: { target: ['directKey'] },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await expect(
      service.createOrGetDirectChat('user-me', 'user-peer'),
    ).resolves.toBe(duplicateChat);
  });
});
