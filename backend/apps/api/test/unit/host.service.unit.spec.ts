import { HostService } from '../../src/services/host.service';

describe('HostService unit', () => {
  it('loads dashboard stats through one aggregate query without all participant rows', async () => {
    const eventFindMany = jest.fn().mockResolvedValueOnce([
      {
        id: 'event-1',
        title: 'Ужин',
        emoji: '🍽️',
        startsAt: new Date('2026-04-28T18:00:00.000Z'),
        durationMinutes: 120,
        place: 'Центр',
        distanceKm: 1,
        vibe: 'Спокойно',
        tone: 'warm',
        joinMode: 'open',
        lifestyle: 'neutral',
        priceMode: 'free',
        priceAmountFrom: null,
        priceAmountTo: null,
        accessMode: 'open',
        genderMode: 'all',
        visibilityMode: 'public',
        hostNote: null,
        description: 'Описание',
        partnerName: null,
        partnerOffer: null,
        isAfterDark: false,
        afterDarkCategory: null,
        afterDarkGlow: null,
        dressCode: null,
        ageRange: null,
        ratioLabel: null,
        consentRequired: false,
        rules: null,
        capacity: 4,
        idempotencyKey: null,
        isCalm: true,
        isNewcomers: true,
        isDate: false,
        sourcePosterId: null,
        hostId: 'user-me',
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
        updatedAt: new Date('2026-04-24T00:00:00.000Z'),
        participants: [],
        _count: {
          participants: 9,
        },
        joinRequests: [],
        liveState: null,
      },
    ]);
    const client = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          displayName: 'Host',
          profile: {
            rating: 4.8,
          },
        }),
      },
      event: {
        findMany: eventFindMany,
        findUnique: jest.fn().mockResolvedValue(null),
      },
      eventJoinRequest: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          meetups_count: BigInt(12),
          fill_rate: 75,
        },
      ]),
    };
    const service = new HostService({ client } as any);

    const result = await service.getDashboard('user-me', {
      eventsLimit: 1,
      requestsLimit: 1,
    });

    expect(result.stats).toMatchObject({
      meetupsCount: 12,
      fillRate: 75,
      rating: 4.8,
    });
    expect(eventFindMany).toHaveBeenCalledTimes(1);
    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        include: expect.objectContaining({
          participants: expect.objectContaining({
            where: {
              userId: {
                notIn: [],
              },
            },
            take: 6,
          }),
          _count: {
            select: {
              participants: {
                where: {
                  userId: {
                    notIn: [],
                  },
                },
              },
            },
          },
        }),
      }),
    );
    expect(eventFindMany.mock.calls[0]?.[0].include).toEqual(
      expect.not.objectContaining({
        joinRequests: expect.anything(),
      }),
    );
    expect(result.events[0]?.going).toBe(9);
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects stale host request reject when another review wins the race', async () => {
    const requestUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new HostService({
      client: {
        eventJoinRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'request-1',
            eventId: 'event-1',
            userId: 'user-guest',
            status: 'pending',
            event: {
              id: 'event-1',
              hostId: 'host-user',
              title: 'Ужин',
            },
            user: {
              id: 'user-guest',
              profile: null,
            },
          }),
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn((callback) =>
          callback({
            eventJoinRequest: {
              updateMany: requestUpdateMany,
            },
            notification: {
              create: jest.fn(),
            },
            outboxEvent: {
              createMany: jest.fn(),
            },
          }),
        ),
      },
    } as any);

    await expect(
      service.rejectRequest('host-user', 'request-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'join_request_already_reviewed',
    });
    expect(requestUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'request-1',
        status: 'pending',
      },
      data: expect.objectContaining({
        status: 'rejected',
        reviewedById: 'host-user',
      }),
    });
  });

  it('filters blocked join requests before host dashboard pagination and count', async () => {
    const requestCount = jest.fn().mockResolvedValue(0);
    const requestFindMany = jest.fn().mockResolvedValue([]);
    const client = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'host-user',
          profile: {
            rating: 5,
          },
        }),
      },
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      eventJoinRequest: {
        count: requestCount,
        findMany: requestFindMany,
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'host-user',
            blockedUserId: 'blocked-user',
          },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          meetups_count: BigInt(0),
          fill_rate: 0,
        },
      ]),
    };
    const service = new HostService({ client } as any);

    await service.getDashboard('host-user', {
      eventsLimit: 1,
      requestsLimit: 1,
    });

    expect(requestCount).toHaveBeenCalledWith({
      where: {
        event: {
          hostId: 'host-user',
        },
        status: 'pending',
        reviewedById: null,
        userId: {
          notIn: ['blocked-user'],
        },
      },
    });
    expect(requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: {
            notIn: ['blocked-user'],
          },
        }),
        take: 2,
      }),
    );
  });

  it('filters blocked attendees and pending requests inside hosted event detail query', async () => {
    const eventFindFirst = jest.fn().mockResolvedValue({
      id: 'event-1',
      title: 'Ужин',
      emoji: '🍽️',
      startsAt: new Date('2026-04-28T18:00:00.000Z'),
      durationMinutes: 120,
      place: 'Центр',
      distanceKm: 1,
      vibe: 'Спокойно',
      tone: 'warm',
      joinMode: 'open',
      lifestyle: 'neutral',
      priceMode: 'free',
      priceAmountFrom: null,
      priceAmountTo: null,
      accessMode: 'open',
      genderMode: 'all',
      visibilityMode: 'public',
      hostNote: null,
      description: 'Описание',
      partnerName: null,
      partnerOffer: null,
      isAfterDark: false,
      afterDarkCategory: null,
      afterDarkGlow: null,
      dressCode: null,
      ageRange: null,
      ratioLabel: null,
      consentRequired: false,
      rules: null,
      capacity: 10,
      idempotencyKey: null,
      isCalm: true,
      isNewcomers: true,
      isDate: false,
      sourcePosterId: null,
      hostId: 'host-user',
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      updatedAt: new Date('2026-04-24T00:00:00.000Z'),
      participants: [],
      attendances: [],
      joinRequests: [],
      liveState: null,
      chat: null,
      _count: {
        participants: 7,
      },
    });
    const service = new HostService({
      client: {
        event: {
          findFirst: eventFindFirst,
        },
        userBlock: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 'host-user',
              blockedUserId: 'blocked-user',
            },
          ]),
        },
      },
    } as any);

    const result = await service.getHostedEvent('host-user', 'event-1');

    expect(eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          participants: expect.objectContaining({
            where: {
              userId: {
                notIn: ['blocked-user'],
              },
            },
          }),
          attendances: {
            where: {
              userId: {
                notIn: ['blocked-user'],
              },
            },
          },
          joinRequests: expect.objectContaining({
            where: {
              status: 'pending',
              reviewedById: null,
              userId: {
                notIn: ['blocked-user'],
              },
            },
          }),
          _count: {
            select: {
              participants: {
                where: {
                  userId: {
                    notIn: ['blocked-user'],
                  },
                },
              },
            },
          },
        }),
      }),
    );
    expect(result.event.going).toBe(7);
  });
});
