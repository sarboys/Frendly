import { decodeCursor } from '@big-break/database';
import { DatingService } from '../../src/services/dating.service';

const plusAccess = {
  hasPremiumAccess: jest.fn().mockResolvedValue(true),
};

describe('DatingService unit', () => {
  it('returns cached first discover page without Prisma reads', async () => {
    const cached = {
      items: [],
      nextCursor: null,
    };
    const redisCache = {
      getJson: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(cached),
      setJson: jest.fn(),
      increment: jest.fn(),
    };
    const userFindUnique = jest.fn();
    const userFindMany = jest.fn();
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: userFindUnique,
            findMany: userFindMany,
          },
          userBlock: {
            findMany: jest.fn(),
          },
          datingAction: {
            findMany: jest.fn(),
          },
        },
      } as any,
      {} as any,
      plusAccess as any,
      undefined,
      redisCache as any,
    );

    await expect(service.listDiscover('user-me')).resolves.toEqual(cached);
    expect(redisCache.getJson).toHaveBeenCalledWith(
      expect.stringContaining('dating:discover:v1:'),
    );
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(userFindMany).not.toHaveBeenCalled();
  });

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

  it('uses explicit discover gender when self gender is unknown', async () => {
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

    await service.listDiscover('user-me', { gender: 'female' } as any);

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

  it('returns locked incoming likes without Frendly+ when settings require Plus', async () => {
    const datingActionFindMany = jest.fn();
    const datingActionCount = jest.fn().mockResolvedValue(3);
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
            count: datingActionCount,
            findMany: datingActionFindMany,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
        getPlusBenefitRules: jest.fn().mockResolvedValue({
          incomingLikesRequiresPlus: true,
        }),
      } as any,
    );

    await expect(service.listLikes('user-me')).resolves.toEqual({
      items: [
        expect.objectContaining({ locked: true }),
        expect.objectContaining({ locked: true }),
        expect.objectContaining({ locked: true }),
      ],
      nextCursor: null,
    });
    expect(datingActionCount).toHaveBeenCalledTimes(1);
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
    expect(decodeCursor(result.nextCursor!)).toEqual({
      value: 'user-011',
      createdAt: '1970-01-01T00:00:00.000Z',
      cycle: 'fresh',
      buffer: [],
    });
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

  it('keeps dating profile photos on CDN URLs', async () => {
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
                        publicUrl:
                          'https://cdn.frendly.tech/avatars/user-anya/photo.jpg',
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
      avatarUrl: 'https://cdn.frendly.tech/avatars/user-anya/photo.jpg',
      primaryPhoto: {
        id: 'photo-1',
        url: 'https://cdn.frendly.tech/avatars/user-anya/photo.jpg',
      },
      photos: [
        {
          id: 'photo-1',
          url: 'https://cdn.frendly.tech/avatars/user-anya/photo.jpg',
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

  it('spends 50 tokens for a second free super like in the Moscow day', async () => {
    const upsert = jest.fn();
    const spendTokens = jest.fn().mockResolvedValue({ id: 'dating-spend-1' });
    const transaction = jest.fn((callback) =>
      callback({
        datingAction: {
          upsert,
        },
        datingUsageEvent: {
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue({}),
        },
        notification: {
          create: jest.fn().mockResolvedValue({ id: 'notif-super-like' }),
        },
        outboxEvent: {
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      }),
    );
    const service = new DatingService(
      {
        client: {
          $transaction: transaction,
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
          datingUsageEvent: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue({}),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
      {
        spendTokens,
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
      chargedTokens: 50,
      superLikeQuota: {
        freeLimit: 1,
        freeRemaining: 0,
        paidCost: 50,
        premium: false,
      },
    });
    expect(spendTokens).toHaveBeenCalledWith(
      'user-me',
      { amount: 50, reason: 'dating_spend' },
      expect.anything(),
    );
    expect(upsert).toHaveBeenCalled();
  });

  it('returns remaining premium super likes after a free super like', async () => {
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
        upsert: jest.fn().mockResolvedValue({}),
      },
      datingUsageEvent: {
        count: jest.fn().mockResolvedValue(9),
        create: jest.fn().mockResolvedValue({}),
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
        limit: 10,
        freeLimit: 10,
        remaining: 0,
        freeRemaining: 0,
        paidCost: 50,
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
          userId: 'user-me',
          userName: 'Никита',
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

  it('rejects the 101st free swipe in one hour', async () => {
    const upsert = jest.fn();
    const service = new DatingService(
      {
        client: {
          $transaction: jest.fn((callback) =>
            callback({
              datingUsageEvent: {
                count: jest.fn().mockResolvedValue(100),
                create: jest.fn(),
              },
              datingAction: {
                upsert,
              },
            }),
          ),
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser()),
            findFirst: jest.fn().mockResolvedValue(datingUser('user-sonya')),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
        getPlusBenefitRules: jest.fn().mockResolvedValue({
          freeSwipeHourlyLimit: 100,
          plusSwipeHourlyLimit: null,
          freeSuperLikeDailyLimit: 1,
          plusSuperLikeDailyLimit: 10,
          paidSuperLikeTokenCost: 50,
        }),
      } as any,
      {
        spendTokens: jest.fn(),
      } as any,
    );

    await expect(
      service.recordAction('user-me', {
        targetUserId: 'user-sonya',
        action: 'pass',
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'dating_swipe_rate_limited',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns dating limits from subscription benefit rules', async () => {
    const service = new DatingService(
      {
        client: {
          datingUsageEvent: {
            count: jest
              .fn()
              .mockResolvedValueOnce(12)
              .mockResolvedValueOnce(1)
              .mockResolvedValueOnce(0),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
        getPlusBenefitRules: jest.fn().mockResolvedValue({
          freeSwipeHourlyLimit: 100,
          plusSwipeHourlyLimit: null,
          freeSuperLikeDailyLimit: 2,
          plusSuperLikeDailyLimit: 12,
          paidSuperLikeTokenCost: 40,
        }),
      } as any,
    );

    await expect(service.getLimits('user-me')).resolves.toMatchObject({
      hourlySwipes: {
        unlimited: false,
        limit: 100,
        remaining: 88,
      },
      superLikes: {
        freeLimit: 2,
        freeRemaining: 1,
        paidCost: 40,
      },
    });
  });

  it('does not rate limit Frendly Plus swipes', async () => {
    const datingActionFindUnique = jest.fn().mockResolvedValue(null);
    const tx = {
      datingUsageEvent: {
        count: jest.fn().mockResolvedValue(50),
        create: jest.fn().mockResolvedValue({}),
      },
      datingAction: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DatingService(
      {
        client: {
          $transaction: jest.fn((callback) => callback(tx)),
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser()),
            findFirst: jest.fn().mockResolvedValue(datingUser('user-sonya')),
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
      {
        spendTokens: jest.fn(),
      } as any,
    );

    await expect(
      service.recordAction('user-me', {
        targetUserId: 'user-sonya',
        action: 'pass',
      }),
    ).resolves.toMatchObject({
      ok: true,
      action: 'pass',
    });
    expect(tx.datingUsageEvent.count).not.toHaveBeenCalled();
  });

  it('rewinds the latest free pass by charging 25 tokens', async () => {
    const spendTokens = jest.fn().mockResolvedValue({ id: 'dating-rewind-1' });
    const tx = {
      datingUsageEvent: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
      datingAction: {
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DatingService(
      {
        client: {
          $transaction: jest.fn((callback) => callback(tx)),
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser()),
            findFirst: jest.fn().mockResolvedValue(datingUser('user-sonya')),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'action-pass',
              targetUserId: 'user-sonya',
              action: 'pass',
            }),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
      {
        spendTokens,
      } as any,
    );

    await expect(service.rewindLastPass('user-me')).resolves.toMatchObject({
      ok: true,
      action: 'rewind',
      chargedTokens: 25,
      peer: {
        userId: 'user-sonya',
      },
      rewindQuota: {
        freeLimit: 0,
        freeRemaining: 0,
        paidCost: 25,
      },
    });
    expect(spendTokens).toHaveBeenCalledWith(
      'user-me',
      { amount: 25, reason: 'dating_spend' },
      expect.anything(),
    );
    expect(tx.datingAction.delete).toHaveBeenCalledWith({
      where: { id: 'action-pass' },
    });
  });

  it('rejects rewind when the latest action is not a pass', async () => {
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser()),
          },
          userBlock: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          datingAction: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'action-like',
              targetUserId: 'user-sonya',
              action: 'like',
            }),
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
      {
        spendTokens: jest.fn(),
      } as any,
    );

    await expect(service.rewindLastPass('user-me')).rejects.toMatchObject({
      statusCode: 409,
      code: 'dating_rewind_unavailable',
    });
  });

  it('returns dating limits for a free user', async () => {
    const usageCount = jest
      .fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const service = new DatingService(
      {
        client: {
          datingUsageEvent: {
            count: usageCount,
          },
        },
      } as any,
      {} as any,
      {
        hasPremiumAccess: jest.fn().mockResolvedValue(false),
      } as any,
      {
        spendTokens: jest.fn(),
      } as any,
    );

    await expect(service.getLimits('user-me')).resolves.toMatchObject({
      premium: false,
      hourlySwipes: {
        unlimited: false,
        limit: 100,
        remaining: 88,
      },
      superLikes: {
        freeLimit: 1,
        freeRemaining: 0,
        paidCost: 50,
      },
      rewinds: {
        freeLimit: 0,
        freeRemaining: 0,
        paidCost: 25,
      },
    });
  });

  it('ranks profiles with common interests before lower score profiles', async () => {
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser(['coffee'])),
            findMany: jest.fn().mockResolvedValue([
              datingUser('user-low', { interests: ['cinema'] }),
              datingUser('user-high', { interests: ['coffee'] }),
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

    const result = await service.listDiscover('user-me', { limit: 2 });

    expect(result.items.map((item: { userId: string }) => item.userId)).toEqual(
      ['user-high', 'user-low'],
    );
  });

  it('keeps common interest profiles before otherwise stronger profiles', async () => {
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser(['coffee'])),
            findMany: jest.fn().mockResolvedValue([
              datingUser('user-no-common', {
                interests: ['cinema'],
                verified: true,
                online: true,
                createdAt: new Date(),
              }),
              datingUser('user-common', {
                interests: ['coffee'],
                verified: false,
                online: false,
                createdAt: new Date('2026-05-01T00:00:00.000Z'),
              }),
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

    const result = await service.listDiscover('user-me', { limit: 2 });

    expect(result.items.map((item: { userId: string }) => item.userId)).toEqual(
      ['user-common', 'user-no-common'],
    );
  });

  it('returns match percent and common interests in discover payload', async () => {
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue(selfUser(['Coffee', 'Vinyl'])),
            findMany: jest.fn().mockResolvedValue([
              datingUser('user-common', {
                interests: ['coffee', 'cinema'],
                verified: true,
                online: true,
              }),
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

    const result = await service.listDiscover('user-me', { limit: 1 });

    const item = result.items[0] as any;

    expect(item).toEqual(
      expect.objectContaining({
        userId: 'user-common',
        commonInterests: ['coffee'],
        matchPercent: expect.any(Number),
      }),
    );
    expect(item.matchPercent).toBeGreaterThanOrEqual(80);
  });

  it('keeps ranked leftovers in discover cursor buffer', async () => {
    const userFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        datingUser('user-low', { interests: ['cinema'] }),
        datingUser('user-high', { interests: ['coffee'] }),
      ])
      .mockResolvedValueOnce([
        datingUser('user-low', { interests: ['cinema'] }),
      ]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser(['coffee'])),
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

    const firstPage = await service.listDiscover('user-me', { limit: 1 });

    expect(
      firstPage.items.map((item: { userId: string }) => item.userId),
    ).toEqual(['user-high']);
    expect(decodeCursor(firstPage.nextCursor!)).toMatchObject({
      buffer: ['user-low'],
      cycle: 'fresh',
    });

    const secondPage = await service.listDiscover('user-me', {
      limit: 1,
      cursor: firstPage.nextCursor!,
    });

    expect(
      secondPage.items.map((item: { userId: string }) => item.userId),
    ).toEqual(['user-low']);
  });

  it('shows previous pass profiles after fresh candidates are exhausted', async () => {
    const userFindMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([datingUser('user-passed')]);
    const service = new DatingService(
      {
        client: {
          user: {
            findUnique: jest.fn().mockResolvedValue(selfUser(['coffee'])),
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

    const result = await service.listDiscover('user-me', { limit: 1 });

    expect(result.items).toEqual([
      expect.objectContaining({ userId: 'user-passed' }),
    ]);
    expect(userFindMany).toHaveBeenCalledTimes(2);
  });
});

function selfUser(interests: string[] = []) {
  return {
    id: 'user-me',
    displayName: 'Никита',
    profile: {
      gender: 'male',
      city: 'Москва',
      area: 'Центр',
    },
    onboarding: {
      gender: 'male',
      city: 'Москва',
      area: 'Центр',
      interests,
    },
  };
}

function datingUser(
  id: string,
  options: {
    interests?: string[];
    createdAt?: Date;
    verified?: boolean;
    online?: boolean;
  } = {},
) {
  return {
    id,
    displayName: id,
    verified: options.verified ?? true,
    online: options.online ?? false,
    createdAt: options.createdAt ?? new Date('2026-05-01T00:00:00.000Z'),
    profile: {
      age: 26,
      city: 'Москва',
      area: 'Центр',
      bio: 'Люблю тихие ужины.',
      vibe: 'Спокойно',
      avatarUrl: null,
      photos: [],
    },
    onboarding: {
      city: 'Москва',
      area: 'Центр',
      interests: options.interests ?? [],
    },
  };
}
