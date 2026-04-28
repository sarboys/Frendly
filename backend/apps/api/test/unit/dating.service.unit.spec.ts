import { DatingService } from '../../src/services/dating.service';

describe('DatingService unit', () => {
  it('does not load all prior dating actions before discover query', async () => {
    const datingActionFindMany = jest.fn().mockImplementation(() => {
      throw new Error('should not load all prior dating actions');
    });
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              onboarding: {
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: datingActionFindMany,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await expect(service.listDiscover('user-me')).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(datingActionFindMany).not.toHaveBeenCalled();
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          datingActionsReceived: {
            none: {
              actorUserId: 'user-me',
            },
          },
        }),
      }),
    );
  });

  it('limits discover profiles to opposite gender when self gender is known', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'male',
              },
              onboarding: {
                gender: 'male',
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn(),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.listDiscover('user-me');

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { profile: { is: { gender: 'female' } } },
            {
              profile: { is: { gender: null } },
              onboarding: { is: { gender: 'female' } },
            },
            {
              profile: { is: null },
              onboarding: { is: { gender: 'female' } },
            },
          ],
        }),
      }),
    );
  });

  it('limits incoming likes to opposite gender when self gender is known', async () => {
    const datingActionFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'female',
              },
              onboarding: {
                gender: 'female',
                interests: [],
              },
            }),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: datingActionFindMany,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.listLikes('user-me');

    expect(datingActionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUser: expect.objectContaining({
            OR: expect.arrayContaining([
              { profile: { is: { gender: 'male' } } },
              {
                profile: { is: { gender: null } },
                onboarding: { is: { gender: 'male' } },
              },
              {
                profile: { is: null },
                onboarding: { is: { gender: 'male' } },
              },
            ]),
          }),
        }),
      }),
    );
  });

  it('does not match stale onboarding gender when profile gender conflicts', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'male',
              },
              onboarding: {
                gender: 'male',
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn(),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.listDiscover('user-me');

    const where = userFindMany.mock.calls[0][0].where;
    expect(where.OR).not.toContainEqual({
      onboarding: { is: { gender: 'female' } },
    });
  });

  it('does not return dating profiles when self gender is unknown', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: null,
              },
              onboarding: {
                gender: null,
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn(),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.listDiscover('user-me');

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ id: '__dating_gender_missing__' }],
        }),
      }),
    );
  });

  it('bounds profile photos in dating list queries', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const datingActionFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'male',
              },
              onboarding: {
                gender: 'male',
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: datingActionFindMany,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.listDiscover('user-me');
    await service.listLikes('user-me');

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          displayName: true,
          verified: true,
          online: true,
          profile: expect.objectContaining({
            select: expect.objectContaining({
              age: true,
              area: true,
              bio: true,
              vibe: true,
              avatarUrl: true,
              photos: expect.objectContaining({
                take: 6,
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
    expect(datingActionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          actorUserId: true,
          actorUser: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              displayName: true,
              verified: true,
              online: true,
              profile: expect.objectContaining({
                select: expect.objectContaining({
                  age: true,
                  area: true,
                  bio: true,
                  vibe: true,
                  avatarUrl: true,
                  photos: expect.objectContaining({
                    take: 6,
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
        }),
      }),
    );
  });

  it('starts previous dating action lookup while target profile is still loading', async () => {
    let resolveTarget!: (value: any) => void;
    const userFindFirst = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveTarget = resolve;
        }),
    );
    const datingActionFindUnique = jest.fn().mockResolvedValue(null);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              displayName: 'Никита',
              profile: {
                gender: 'male',
              },
              onboarding: {
                gender: 'male',
                interests: [],
              },
            }),
            findFirst: userFindFirst,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findUnique: datingActionFindUnique,
            upsert: jest.fn().mockResolvedValue({}),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    const resultPromise = service.recordAction('user-me', {
      targetUserId: 'user-sonya',
      action: 'pass',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(userFindFirst).toHaveBeenCalledTimes(1);
    expect(datingActionFindUnique).toHaveBeenCalledTimes(1);

    resolveTarget({
      id: 'user-sonya',
      displayName: 'Соня',
      verified: true,
      online: true,
      profile: {
        age: 26,
        area: 'Замоскворечье',
        bio: 'Люблю тихие ужины.',
        vibe: 'Спокойно',
        avatarUrl: null,
        photos: [],
      },
      onboarding: {
        interests: [],
      },
    });

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      action: 'pass',
      matched: false,
    });
  });

  it('creates a central notification when a user receives a dating like', async () => {
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-like' });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    let client: any;
    client = {
      $transaction: jest.fn((callback) => callback(client)),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'Никита',
          profile: {
            gender: 'male',
          },
          onboarding: {
            gender: 'male',
            interests: [],
          },
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-sonya',
          displayName: 'Соня',
          verified: true,
          online: true,
          profile: {
            age: 26,
            area: 'Замоскворечье',
            bio: 'Люблю тихие ужины.',
            vibe: 'Спокойно',
            avatarUrl: null,
            photos: [],
          },
          onboarding: {
            interests: [],
          },
        }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      datingAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      notification: {
        create: notificationCreate,
      },
      outboxEvent: {
        createMany: outboxCreateMany,
      },
    };
    const service = new DatingService(
      {
        client,
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await service.recordAction('user-me', {
      targetUserId: 'user-sonya',
      action: 'like',
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-sonya',
        actorUserId: 'user-me',
        kind: 'like',
        title: 'Новый лайк',
        dedupeKey: 'dating_like:user-sonya:user-me',
        payload: expect.objectContaining({
          userId: 'user-me',
          userName: 'Никита',
        }),
      }),
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: [
        {
          type: 'push.dispatch',
          payload: {
            userId: 'user-sonya',
            notificationId: 'notif-like',
          },
        },
        {
          type: 'notification.create',
          payload: {
            notificationId: 'notif-like',
          },
        },
      ],
    });
  });

  it('treats an existing dating like notification as idempotent', async () => {
    const notificationCreate = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['dedupeKey'] },
    });
    const outboxCreateMany = jest.fn();
    let client: any;
    client = {
      $transaction: jest.fn((callback) => callback(client)),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'Никита',
          profile: {
            gender: 'male',
          },
          onboarding: {
            gender: 'male',
            interests: [],
          },
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-sonya',
          displayName: 'Соня',
          verified: true,
          online: true,
          profile: {
            age: 26,
            area: 'Замоскворечье',
            bio: 'Люблю тихие ужины.',
            vibe: 'Спокойно',
            avatarUrl: null,
            photos: [],
          },
          onboarding: {
            interests: [],
          },
        }),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      datingAction: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      notification: {
        create: notificationCreate,
      },
      outboxEvent: {
        createMany: outboxCreateMany,
      },
    };
    const service = new DatingService(
      {
        client,
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
      } as any,
    );

    await expect(
      service.recordAction('user-me', {
        targetUserId: 'user-sonya',
        action: 'like',
      }),
    ).resolves.toMatchObject({
      ok: true,
      action: 'like',
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'dating_like:user-sonya:user-me',
      }),
    });
    expect(outboxCreateMany).not.toHaveBeenCalled();
  });
});
