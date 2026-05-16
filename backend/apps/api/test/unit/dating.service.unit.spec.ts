import { decodeCursor } from '@big-break/database';
import { DatingService } from '../../src/services/dating.service';

const plusAccess = {
  hasPremiumAccess: jest.fn().mockResolvedValue(true),
};

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
      plusAccess as any,
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
      plusAccess as any,
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

  it('rejects incoming likes without Frendly+', async () => {
    const datingActionFindMany = jest.fn();
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
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
    );

    await expect(service.listLikes('user-me')).rejects.toMatchObject({
      statusCode: 403,
      code: 'frendly_plus_required',
    });
    expect(datingActionFindMany).not.toHaveBeenCalled();
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
      plusAccess as any,
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
      plusAccess as any,
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

  it('adds approximate profile coordinates for dating radar', async () => {
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
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'user-anya',
                displayName: 'Аня',
                verified: true,
                online: true,
                profile: {
                  age: 27,
                  city: 'Москва',
                  area: 'Патрики',
                  bio: 'Люблю тихие бары.',
                  vibe: 'Спокойно',
                  avatarUrl: null,
                  photos: [],
                },
                onboarding: {
                  interests: ['вино'],
                },
              },
            ]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
      plusAccess as any,
    );

    const result = await service.listDiscover('user-me');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        city: 'Москва',
        area: 'Патрики',
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
    );
  });

  it('filters discover profiles by age, interests and radius', async () => {
    const userFindMany = jest.fn().mockResolvedValue([
      {
        id: 'user-anya',
        displayName: 'Аня',
        verified: true,
        online: true,
        profile: {
          age: 27,
          city: 'Москва',
          area: 'Чистые пруды',
          bio: 'Люблю выставки.',
          vibe: 'Спокойно',
          avatarUrl: null,
          photos: [],
        },
        onboarding: {
          city: 'Москва',
          area: 'Чистые пруды',
          interests: ['Выставки', 'Кофе'],
        },
      },
      {
        id: 'user-sonya',
        displayName: 'Соня',
        verified: true,
        online: true,
        profile: {
          age: 26,
          city: 'Москва',
          area: 'Замоскворечье',
          bio: 'Люблю театр.',
          vibe: 'Спокойно',
          avatarUrl: null,
          photos: [],
        },
        onboarding: {
          city: 'Москва',
          area: 'Замоскворечье',
          interests: ['Театр'],
        },
      },
    ]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'male',
                city: 'Москва',
                area: 'Чистые пруды',
              },
              onboarding: {
                gender: 'male',
                city: 'Москва',
                area: 'Чистые пруды',
                interests: [],
              },
            }),
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
      plusAccess as any,
    );

    const result = await service.listDiscover('user-me', {
      ageMin: 26,
      ageMax: 28,
      radiusKm: 1,
      interests: ['выставки'],
    } as any);

    expect(result.items.map((item) => item.userId)).toEqual(['user-anya']);
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { profile: { is: { age: { gte: 26, lte: 28 } } } },
          ]),
        }),
      }),
    );
  });

  it('moves discover cursor past scanned candidates when post filters return a partial page', async () => {
    const candidates = Array.from({ length: 11 }, (_, index) => {
      const number = index + 1;
      const id = `user-${number.toString().padStart(3, '0')}`;
      return {
        id,
        displayName: `User ${number}`,
        verified: true,
        online: true,
        profile: {
          age: 27,
          city: 'Москва',
          area: 'Патрики',
          bio: 'Люблю планы без спешки.',
          vibe: 'Спокойно',
          avatarUrl: null,
          photos: [],
        },
        onboarding: {
          city: 'Москва',
          area: 'Патрики',
          interests: number === 10 ? ['Вино'] : ['Театр'],
        },
      };
    });
    const datingActionFindMany = jest.fn().mockResolvedValue([]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'user-me',
              profile: {
                gender: 'male',
                city: 'Москва',
                area: 'Чистые пруды',
              },
              onboarding: {
                gender: 'male',
                city: 'Москва',
                area: 'Чистые пруды',
                interests: [],
              },
            }),
            findMany: jest.fn().mockResolvedValue(candidates),
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
      plusAccess as any,
    );

    const result = await service.listDiscover('user-me', {
      limit: 2,
      interests: ['вино'],
    } as any);

    expect(result.items.map((item) => item.userId)).toEqual(['user-010']);
    expect(decodeCursor(result.nextCursor!)).toEqual({ value: 'user-011' });
    expect(datingActionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUserId: {
            in: ['user-010'],
          },
        }),
      }),
    );
  });

  it('keeps dating profile photos when the media asset has no publicUrl', async () => {
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
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'user-anya',
                displayName: 'Аня',
                verified: true,
                online: true,
                profile: {
                  age: 27,
                  city: 'Москва',
                  area: 'Патрики',
                  bio: 'Люблю тихие бары.',
                  vibe: 'Спокойно',
                  avatarUrl: null,
                  photos: [
                    {
                      id: 'photo-1',
                      sortOrder: 0,
                      mediaAsset: {
                        id: 'asset-photo-1',
                        kind: 'avatar',
                        mimeType: 'image/jpeg',
                        byteSize: 1024,
                        durationMs: null,
                        publicUrl: null,
                        variants: null,
                      },
                    },
                  ],
                },
                onboarding: {
                  interests: ['вино'],
                },
              },
            ]),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      } as any,
      {} as any,
      plusAccess as any,
    );

    const result = await service.listDiscover('user-me');

    expect(result.items[0]).toMatchObject({
      avatarUrl: '/media/asset-photo-1',
      primaryPhoto: {
        id: 'photo-1',
        url: '/media/asset-photo-1',
      },
      photos: [
        {
          id: 'photo-1',
          url: '/media/asset-photo-1',
        },
      ],
    });
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
              city: true,
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
                      variants: true,
                    },
                  },
                },
              }),
            }),
          }),
          onboarding: {
            select: {
              city: true,
              area: true,
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
                  city: true,
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
                          variants: true,
                        },
                      },
                    },
                  }),
                }),
              }),
              onboarding: {
                select: {
                  city: true,
                  area: true,
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
      plusAccess as any,
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

  it('rejects a second free super like in the UTC day', async () => {
    const upsert = jest.fn();
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
            count: jest.fn().mockResolvedValue(1),
            upsert,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
    );

    await expect(
      service.recordAction('user-me', {
        targetUserId: 'user-sonya',
        action: 'super_like',
      }),
    ).rejects.toMatchObject({
      statusCode: 402,
      code: 'super_like_limit_reached',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns remaining premium super likes after a super like', async () => {
    const datingActionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({ action: 'like' })
      .mockResolvedValueOnce(null);
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
        findUnique: datingActionFindUnique,
        count: jest.fn().mockResolvedValue(14),
        upsert: jest.fn().mockResolvedValue({}),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-super-like' }),
      },
      outboxEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
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
        action: 'super_like',
      }),
    ).resolves.toMatchObject({
      ok: true,
      action: 'super_like',
      superLikeQuota: {
        limit: 15,
        remaining: 0,
        premium: true,
      },
    });
  });

  it('creates a plain central notification when a user receives a dating like', async () => {
    const notificationCreate = jest
      .fn()
      .mockResolvedValue({ id: 'notif-like' });
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
      plusAccess as any,
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
        payload: {
          source: 'dating',
          action: 'like',
        },
      }),
      select: {
        id: true,
      },
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

  it('creates a dating profile notification when a user receives a super like', async () => {
    const notificationCreate = jest
      .fn()
      .mockResolvedValue({ id: 'notif-super-like' });
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
        count: jest.fn().mockResolvedValue(0),
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
      plusAccess as any,
    );

    await service.recordAction('user-me', {
      targetUserId: 'user-sonya',
      action: 'super_like',
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-sonya',
        actorUserId: 'user-me',
        kind: 'like',
        title: 'Суперлайк',
        dedupeKey: 'dating_super_like:user-sonya:user-me',
        payload: {
          source: 'dating',
          action: 'super_like',
          userId: 'user-me',
          userName: 'Никита',
        },
      }),
      select: {
        id: true,
      },
    });
  });

  it('creates a super like notification when a dating like is upgraded', async () => {
    const notificationCreate = jest
      .fn()
      .mockResolvedValue({ id: 'notif-super-like' });
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
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ action: 'like' })
          .mockResolvedValueOnce(null),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      notification: {
        create: notificationCreate,
      },
      outboxEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new DatingService(
      {
        client,
      } as any,
      {} as any,
      plusAccess as any,
    );

    await service.recordAction('user-me', {
      targetUserId: 'user-sonya',
      action: 'super_like',
    });

    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Суперлайк',
        dedupeKey: 'dating_super_like:user-sonya:user-me',
        payload: expect.objectContaining({
          action: 'super_like',
          userId: 'user-me',
        }),
      }),
      select: {
        id: true,
      },
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
      plusAccess as any,
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
      select: {
        id: true,
      },
    });
    expect(outboxCreateMany).not.toHaveBeenCalled();
  });
});
