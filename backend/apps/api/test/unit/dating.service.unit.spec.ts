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

  it('creates a central notification when a user receives a dating like', async () => {
    const notificationCreate = jest.fn().mockResolvedValue({ id: 'notif-like' });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 2 });
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
            upsert: jest.fn().mockResolvedValue({}),
          },
          notification: {
            create: notificationCreate,
          },
          outboxEvent: {
            createMany: outboxCreateMany,
          },
        },
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
});
