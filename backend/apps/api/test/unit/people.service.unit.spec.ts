import { PeopleService } from '../../src/services/people.service';

describe('PeopleService unit', () => {
  const makePerson = (id: string, displayName: string) => ({
    id,
    displayName,
    online: true,
    verified: false,
    profile: {
      age: 27,
      area: 'Center',
      vibe: 'Calm',
      avatarUrl: null,
      photos: [],
    },
    onboarding: {
      interests: [],
    },
    settings: {
      showAge: true,
    },
  });
  const makeSocialClient = (overrides: any = {}) => ({
    userFollow: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.userFollow,
    },
    profileReaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.profileReaction,
    },
  });

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
        ...makeSocialClient(),
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

  it('adds bounded social previews to people summaries', async () => {
    const userFindMany = jest.fn().mockResolvedValue([
      makePerson('user-anna', 'Аня'),
      makePerson('user-boris', 'Борис'),
    ]);
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
        ...makeSocialClient({
          userFollow: {
            groupBy: jest.fn().mockResolvedValue([
              { targetUserId: 'user-anna', _count: { _all: 7 } },
            ]),
            findMany: jest.fn().mockResolvedValue([
              { targetUserId: 'user-anna' },
            ]),
          },
          profileReaction: {
            groupBy: jest.fn().mockResolvedValue([
              {
                targetUserId: 'user-anna',
                kind: 'like',
                _count: { _all: 12 },
              },
              {
                targetUserId: 'user-anna',
                kind: 'super_like',
                _count: { _all: 2 },
              },
            ]),
            findMany: jest.fn().mockResolvedValue([
              { targetUserId: 'user-anna', kind: 'like' },
            ]),
          },
        }),
      },
    } as any);

    const result = await service.listPeople('user-me', {});

    expect(result.items[0]).toMatchObject({
      id: 'user-anna',
      social: {
        followers: 7,
        likes: 12,
        superLikes: 2,
        iFollow: true,
        iLike: true,
        iSuper: false,
      },
    });
    expect(result.items[1]).toMatchObject({
      id: 'user-boris',
      social: {
        followers: 0,
        likes: 0,
        superLikes: 0,
        iFollow: false,
        iLike: false,
        iSuper: false,
      },
    });
  });

  it('uses people cursor payload without reading the cursor user again', async () => {
    const firstPerson = makePerson('user-anna', 'Anna');
    const secondPerson = makePerson('user-boris', 'Boris');
    const userFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstPerson, secondPerson])
      .mockResolvedValueOnce([]);
    const userFindUnique = jest.fn().mockResolvedValue({
      id: firstPerson.id,
      displayName: firstPerson.displayName,
    });
    const service = new PeopleService({
      client: {
        onboardingPreferences: {
          findUnique: jest.fn().mockResolvedValue({
            interests: [],
          }),
        },
        user: {
          findMany: userFindMany,
          findUnique: userFindUnique,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...makeSocialClient(),
      },
    } as any);

    const firstPage = await service.listPeople('user-me', { limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listPeople('user-me', {
      cursor: firstPage.nextCursor!,
      limit: 1,
    });

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(userFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        displayName: {
          gt: firstPerson.displayName,
        },
      },
      {
        displayName: firstPerson.displayName,
        id: {
          gt: firstPerson.id,
        },
      },
    ]);
  });

  it('loads only fields needed for a person profile', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'user-peer',
      displayName: 'Аня',
      online: true,
      verified: false,
      profile: {
        age: 27,
        birthDate: null,
        gender: 'female',
        city: 'Москва',
        area: 'Центр',
        bio: 'Кино и кофе',
        vibe: 'Спокойно',
        rating: 0,
        meetupCount: 0,
        avatarUrl: null,
        photos: [],
      },
      onboarding: {
        interests: ['кино'],
        intent: 'dating',
      },
      settings: {
        discoverable: true,
        showAge: true,
      },
    });
    const service = new PeopleService({
      client: {
        user: {
          findUnique: userFindUnique,
        },
        userFollow: {
          count: jest.fn().mockResolvedValue(0),
        },
        profileReaction: {
          count: jest.fn().mockResolvedValue(0),
        },
      },
    } as any);

    await expect(service.getPersonProfile('user-peer', 'user-peer')).resolves.toMatchObject({
      id: 'user-peer',
      interests: ['кино'],
      intent: 'dating',
      photos: [],
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-peer' },
      select: {
        id: true,
        displayName: true,
        verified: true,
        online: true,
        profile: {
          select: {
            age: true,
            birthDate: true,
            gender: true,
            city: true,
            area: true,
            bio: true,
            vibe: true,
            rating: true,
            meetupCount: true,
            avatarUrl: true,
            photos: {
              select: {
                id: true,
                sortOrder: true,
                mediaAsset: {
                  select: {
                    id: true,
                    kind: true,
                    mimeType: true,
                    byteSize: true,
                    durationMs: true,
                    publicUrl: true,
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        onboarding: {
          select: {
            interests: true,
            intent: true,
          },
        },
        settings: {
          select: {
            discoverable: true,
            showAge: true,
          },
        },
      },
    });
  });

  it('returns social counts and viewer flags with a person profile', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({
      id: 'user-peer',
      displayName: 'Аня',
      online: true,
      verified: false,
      profile: {
        age: 27,
        birthDate: null,
        gender: 'female',
        city: 'Москва',
        area: 'Центр',
        bio: 'Кино и кофе',
        vibe: 'Спокойно',
        rating: 0,
        meetupCount: 0,
        avatarUrl: null,
        photos: [],
      },
      onboarding: {
        interests: ['кино'],
        intent: 'dating',
      },
      settings: {
        discoverable: true,
        showAge: true,
      },
    });
    const service = new PeopleService({
      client: {
        user: {
          findUnique: userFindUnique,
        },
        userFollow: {
          count: jest.fn().mockResolvedValue(12),
          findUnique: jest.fn().mockResolvedValue({ id: 'follow-1' }),
        },
        profileReaction: {
          count: jest
            .fn()
            .mockResolvedValueOnce(34)
            .mockResolvedValueOnce(5),
          findMany: jest.fn().mockResolvedValue([
            { kind: 'like' },
            { kind: 'super_like' },
          ]),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    } as any);

    await expect(
      service.getPersonProfile('user-me', 'user-peer'),
    ).resolves.toMatchObject({
      id: 'user-peer',
      social: {
        followers: 12,
        likes: 34,
        superLikes: 5,
        iFollow: true,
        iLike: true,
        iSuper: true,
      },
    });
  });

  it('keeps profile like and super-like as independent reactions', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new PeopleService({
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-peer',
            settings: { discoverable: true },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        profileReaction: {
          upsert: jest.fn().mockResolvedValue({}),
          create,
          count: jest
            .fn()
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1),
          findMany: jest.fn().mockResolvedValue([
            { kind: 'like' },
            { kind: 'super_like' },
          ]),
        },
        userFollow: {
          count: jest.fn().mockResolvedValue(0),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    } as any);

    await service.setProfileReaction('user-me', 'user-peer', 'like');
    await service.setProfileReaction('user-me', 'user-peer', 'super_like');

    expect((service as any).prismaService.client.profileReaction.upsert)
      .toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            actorUserId_targetUserId_kind: {
              actorUserId: 'user-me',
              targetUserId: 'user-peer',
              kind: 'like',
            },
          },
        }),
      );
    expect((service as any).prismaService.client.profileReaction.upsert)
      .toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            actorUserId_targetUserId_kind: {
              actorUserId: 'user-me',
              targetUserId: 'user-peer',
              kind: 'super_like',
            },
          },
        }),
      );
  });

  it('rejects profile social actions on yourself', async () => {
    const service = new PeopleService({ client: {} } as any);

    await expect(
      service.setFollow('user-me', 'user-me', true),
    ).rejects.toMatchObject({
      code: 'self_social_action_not_allowed',
    });
    await expect(
      service.setProfileReaction('user-me', 'user-me', 'like'),
    ).rejects.toMatchObject({
      code: 'self_social_action_not_allowed',
    });
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
        ...makeSocialClient(),
      },
    } as any);

    await expect(
      service.createOrGetDirectChat('user-me', 'user-hidden'),
    ).rejects.toMatchObject({
      code: 'user_not_found',
    });
    expect(chatCreate).not.toHaveBeenCalled();
  });

  it('starts existing direct chat lookup while peer visibility is still loading', async () => {
    let resolvePeer!: (value: any) => void;
    const userFindUnique = jest.fn(
      () =>
        new Promise((resolve) => {
          resolvePeer = resolve;
        }),
    );
    const chatFindUnique = jest.fn().mockResolvedValue({
      id: 'chat-existing',
      directKey: 'user-me:user-peer',
    });
    const service = new PeopleService({
      client: {
        user: {
          findUnique: userFindUnique,
        },
        chat: {
          findUnique: chatFindUnique,
          create: jest.fn(),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ...makeSocialClient(),
      },
    } as any);

    const resultPromise = service.createOrGetDirectChat('user-me', 'user-peer');

    await new Promise((resolve) => setImmediate(resolve));

    expect(userFindUnique).toHaveBeenCalledTimes(1);
    expect(chatFindUnique).toHaveBeenCalledTimes(1);

    resolvePeer({
      id: 'user-peer',
      settings: {
        discoverable: true,
      },
    });

    await expect(resultPromise).resolves.toEqual({
      id: 'chat-existing',
      directKey: 'user-me:user-peer',
    });
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
