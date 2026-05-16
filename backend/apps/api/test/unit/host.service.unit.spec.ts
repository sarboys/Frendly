import { HostService } from '../../src/services/host.service';

describe('HostService unit', () => {
  const makeDashboardEvent = (
    id: string,
    startsAt: Date,
  ) => ({
    id,
    title: `Event ${id}`,
    emoji: '*',
    startsAt,
    durationMinutes: 120,
    place: 'Center',
    distanceKm: 1,
    vibe: 'Calm',
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
    description: 'Description',
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
    hostId: 'host-user',
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    updatedAt: new Date('2026-04-24T00:00:00.000Z'),
    participants: [],
    _count: {
      participants: 0,
    },
    liveState: null,
  });

  const makeDashboardRequest = (
    id: string,
    createdAt: Date,
  ) => ({
    id,
    eventId: 'event-1',
    note: null,
    status: 'pending',
    compatibilityScore: 80,
    createdAt,
    reviewedAt: null,
    event: {
      id: 'event-1',
      title: 'Event',
    },
    user: {
      id: `guest-${id}`,
      displayName: 'Guest',
      profile: {
        avatarUrl: null,
      },
    },
  });

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
        select: expect.objectContaining({
          participants: expect.objectContaining({
            where: {
              userId: {
                notIn: [],
              },
            },
            take: 6,
            select: {
              userId: true,
              user: {
                select: {
                  displayName: true,
                },
              },
            },
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
          liveState: {
            select: {
              status: true,
            },
          },
        }),
      }),
    );
    expect(eventFindMany.mock.calls[0]?.[0].select).toEqual(
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
        select: expect.objectContaining({
          id: true,
          eventId: true,
          note: true,
          status: true,
          compatibilityScore: true,
          createdAt: true,
          reviewedAt: true,
          event: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        }),
        take: 2,
      }),
    );
  });

  it('uses host dashboard cursor payloads without reading cursor rows again', async () => {
    const firstEvent = makeDashboardEvent(
      'event-1',
      new Date('2026-04-28T18:00:00.000Z'),
    );
    const secondEvent = makeDashboardEvent(
      'event-2',
      new Date('2026-04-29T18:00:00.000Z'),
    );
    const firstRequest = makeDashboardRequest(
      'request-1',
      new Date('2026-04-24T10:00:00.000Z'),
    );
    const secondRequest = makeDashboardRequest(
      'request-2',
      new Date('2026-04-25T10:00:00.000Z'),
    );
    const eventFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstEvent, secondEvent])
      .mockResolvedValueOnce([]);
    const requestFindMany = jest
      .fn()
      .mockResolvedValueOnce([firstRequest, secondRequest])
      .mockResolvedValueOnce([]);
    const eventFindUnique = jest.fn().mockResolvedValue({
      id: firstEvent.id,
      startsAt: firstEvent.startsAt,
    });
    const requestFindUnique = jest.fn().mockResolvedValue({
      id: firstRequest.id,
      createdAt: firstRequest.createdAt,
    });
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
        findMany: eventFindMany,
        findUnique: eventFindUnique,
      },
      eventJoinRequest: {
        count: jest.fn().mockResolvedValue(2),
        findMany: requestFindMany,
        findUnique: requestFindUnique,
      },
      userBlock: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          meetups_count: BigInt(2),
          fill_rate: 50,
        },
      ]),
    };
    const service = new HostService({ client } as any);

    const firstPage = await service.getDashboard('host-user', {
      eventsLimit: 1,
      requestsLimit: 1,
    });
    expect(firstPage.nextEventsCursor).toEqual(expect.any(String));
    expect(firstPage.nextRequestsCursor).toEqual(expect.any(String));

    await service.getDashboard('host-user', {
      eventsCursor: firstPage.nextEventsCursor!,
      eventsLimit: 1,
      requestsCursor: firstPage.nextRequestsCursor!,
      requestsLimit: 1,
    });

    expect(eventFindUnique).not.toHaveBeenCalled();
    expect(requestFindUnique).not.toHaveBeenCalled();
    expect(eventFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        startsAt: {
          gt: firstEvent.startsAt,
        },
      },
      {
        startsAt: firstEvent.startsAt,
        id: {
          gt: firstEvent.id,
        },
      },
    ]);
    expect(requestFindMany.mock.calls[1][0].where.OR).toEqual([
      {
        createdAt: {
          gt: firstRequest.createdAt,
        },
      },
      {
        createdAt: firstRequest.createdAt,
        id: {
          gt: firstRequest.id,
        },
      },
    ]);
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
        select: expect.objectContaining({
          participants: expect.objectContaining({
            where: {
              userId: {
                notIn: ['blocked-user'],
              },
            },
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                  verified: true,
                  online: true,
                  profile: {
                    select: {
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          }),
          attendances: {
            where: {
              userId: {
                notIn: ['blocked-user'],
              },
            },
            select: {
              userId: true,
              status: true,
              checkedInAt: true,
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
            select: {
              id: true,
              eventId: true,
              userId: true,
              note: true,
              status: true,
              compatibilityScore: true,
              createdAt: true,
              reviewedAt: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                  profile: {
                    select: {
                      avatarUrl: true,
                    },
                  },
                },
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
          liveState: {
            select: {
              status: true,
            },
          },
          chat: {
            select: {
              id: true,
            },
          },
        }),
      }),
    );
    expect(result.event.going).toBe(7);
  });

  it('finishes live meetup with only host-selected attendees checked in', async () => {
    const liveState = {
      status: 'finished',
      startedAt: new Date('2026-04-28T18:00:00.000Z'),
      finishedAt: new Date('2026-04-28T20:00:00.000Z'),
    };
    const eventFindFirst = jest.fn().mockResolvedValue({
      id: 'event-1',
      participants: [
        { userId: 'host-user' },
        { userId: 'guest-present' },
        { userId: 'guest-absent' },
      ],
    });
    const liveStateUpsert = jest.fn().mockResolvedValue(liveState);
    const attendanceUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const attendanceUpsert = jest.fn().mockResolvedValue({});
    const service = new HostService({
      client: {
        event: {
          findFirst: eventFindFirst,
        },
        eventLiveState: {
          upsert: liveStateUpsert,
        },
        eventAttendance: {
          updateMany: attendanceUpdateMany,
          upsert: attendanceUpsert,
        },
        $transaction: jest.fn((callback) =>
          callback({
            eventLiveState: {
              upsert: liveStateUpsert,
            },
            eventAttendance: {
              updateMany: attendanceUpdateMany,
              upsert: attendanceUpsert,
            },
          }),
        ),
      },
    } as any);

    const result = await service.finishLive('host-user', 'event-1', [
      'guest-present',
      'guest-present',
    ]);

    expect(eventFindFirst).toHaveBeenCalledWith({
      where: { id: 'event-1', hostId: 'host-user' },
      select: {
        id: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });
    expect(attendanceUpdateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        userId: {
          in: ['host-user', 'guest-absent'],
        },
      },
      data: {
        status: 'not_checked_in',
        checkedInAt: null,
        checkedInById: null,
        checkInMethod: null,
        leftAt: null,
      },
    });
    expect(attendanceUpsert).toHaveBeenCalledTimes(1);
    expect(attendanceUpsert).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: 'event-1',
          userId: 'guest-present',
        },
      },
      update: expect.objectContaining({
        status: 'checked_in',
        checkedInById: 'host-user',
        checkInMethod: 'host_manual',
        leftAt: null,
      }),
      create: expect.objectContaining({
        eventId: 'event-1',
        userId: 'guest-present',
        status: 'checked_in',
        checkedInById: 'host-user',
        checkInMethod: 'host_manual',
        leftAt: null,
      }),
      select: {
        id: true,
      },
    });
    expect(result).toMatchObject({
      eventId: 'event-1',
      status: 'finished',
      attendedUserIds: ['guest-present'],
    });
  });

  it('treats missing finish attendees as an empty host selection', async () => {
    const eventFindFirst = jest.fn().mockResolvedValue({
      id: 'event-1',
      participants: [{ userId: 'guest-present' }, { userId: 'guest-absent' }],
    });
    const liveStateUpsert = jest.fn().mockResolvedValue({
      status: 'finished',
      startedAt: null,
      finishedAt: new Date('2026-04-28T20:00:00.000Z'),
    });
    const attendanceUpdateMany = jest.fn().mockResolvedValue({ count: 2 });
    const attendanceUpsert = jest.fn().mockResolvedValue({});
    const service = new HostService({
      client: {
        event: {
          findFirst: eventFindFirst,
        },
        $transaction: jest.fn((callback) =>
          callback({
            eventLiveState: {
              upsert: liveStateUpsert,
            },
            eventAttendance: {
              updateMany: attendanceUpdateMany,
              upsert: attendanceUpsert,
            },
          }),
        ),
      },
    } as any);

    const result = await service.finishLive('host-user', 'event-1');

    expect(attendanceUpdateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        userId: {
          in: ['guest-present', 'guest-absent'],
        },
      },
      data: {
        status: 'not_checked_in',
        checkedInAt: null,
        checkedInById: null,
        checkInMethod: null,
        leftAt: null,
      },
    });
    expect(attendanceUpsert).not.toHaveBeenCalled();
    expect(result.attendedUserIds).toEqual([]);
  });
});
