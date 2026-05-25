import { DropsRewardService } from '../../src/services/drops-reward.service';

describe('DropsRewardService unit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      dropRewardEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      dropTicket: {
        count: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      event: {
        findUnique: jest.fn(),
      },
      dropReferral: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
      ...overrides.prismaClient,
    };
    return {
      service: new DropsRewardService({ client: prismaClient } as any),
      prismaClient,
    };
  };

  it('claims daily login once for the Moscow calendar day', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-06-09T10:00:00.000Z').getTime());
    const { service, prismaClient } = makeService();
    prismaClient.dropRewardEvent.findUnique.mockResolvedValue(null);
    prismaClient.dropTicket.count.mockResolvedValue(8);
    prismaClient.dropRewardEvent.aggregate.mockResolvedValue({
      _sum: { ticketCount: 2 },
    });
    prismaClient.dropRewardEvent.create.mockResolvedValue({
      id: 'reward-1',
      userId: 'user-1',
      source: 'daily_login',
      status: 'active',
      ticketCount: 1,
      title: 'Ежедневный вход',
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    });

    await expect(service.claimDailyLogin('user-1')).resolves.toMatchObject({
      id: 'reward-1',
      source: 'daily_login',
      status: 'active',
      ticketCount: 1,
      alreadyClaimed: false,
    });

    expect(prismaClient.dropRewardEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        source: 'daily_login',
        status: 'active',
        ticketCount: 1,
        monthKey: '2026-06',
        idempotencyKey: 'daily_login:user-1:2026-06-09',
      }),
      select: expect.any(Object),
    });
    expect(prismaClient.dropTicket.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-1',
          rewardEventId: 'reward-1',
          source: 'daily_login',
          status: 'active',
          monthKey: '2026-06',
        }),
      ],
    });
  });

  it('keeps Prisma transaction bound to its client when granting daily login', async () => {
    const { service, prismaClient } = makeService({
      prismaClient: {
        $transaction: async function (this: unknown, callback: any) {
          if (this !== prismaClient) {
            throw new TypeError('unbound transaction client');
          }
          return callback(prismaClient);
        },
      },
    });
    prismaClient.dropRewardEvent.findUnique.mockResolvedValue(null);
    prismaClient.dropTicket.count.mockResolvedValue(0);
    prismaClient.dropRewardEvent.aggregate.mockResolvedValue({
      _sum: { ticketCount: 0 },
    });
    prismaClient.dropRewardEvent.create.mockResolvedValue({
      id: 'reward-1',
      userId: 'user-1',
      source: 'daily_login',
      status: 'active',
      ticketCount: 1,
      title: 'Ежедневный вход',
      description: null,
      relatedType: null,
      relatedId: null,
      cancellationReason: null,
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    });

    await expect(service.claimDailyLogin('user-1')).resolves.toMatchObject({
      id: 'reward-1',
      alreadyClaimed: false,
    });
  });

  it('returns the existing reward when the same idempotency key is retried', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.dropRewardEvent.findUnique.mockResolvedValue({
      id: 'reward-existing',
      userId: 'user-1',
      source: 'daily_login',
      status: 'active',
      ticketCount: 1,
      title: 'Ежедневный вход',
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    });

    await expect(service.claimDailyLogin('user-1')).resolves.toMatchObject({
      id: 'reward-existing',
      alreadyClaimed: true,
    });

    expect(prismaClient.dropRewardEvent.create).not.toHaveBeenCalled();
    expect(prismaClient.dropTicket.createMany).not.toHaveBeenCalled();
  });

  it('rejects rewards above the 30 ticket monthly limit', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.dropRewardEvent.findUnique.mockResolvedValue(null);
    prismaClient.dropTicket.count.mockResolvedValue(30);

    await expect(
      service.grantReward({
        userId: 'user-1',
        source: 'daily_login',
        idempotencyKey: 'daily_login:user-1:2026-06-09',
        ticketCount: 1,
        title: 'Ежедневный вход',
        taskMonthlyLimit: 7,
      }),
    ).rejects.toMatchObject({
      code: 'drops_monthly_limit_reached',
    });

    expect(prismaClient.dropRewardEvent.create).not.toHaveBeenCalled();
    expect(prismaClient.dropTicket.createMany).not.toHaveBeenCalled();
  });

  it('continues meeting visitor rewards when the host reward is blocked', async () => {
    const { service, prismaClient } = makeService();
    const now = new Date('2026-06-09T20:00:00.000Z');
    prismaClient.event.findUnique.mockResolvedValue({
      id: 'event-1',
      title: 'Кофе',
      hostId: 'host-1',
      startsAt: new Date('2026-06-09T18:00:00.000Z'),
      createdAt: new Date('2026-06-09T08:00:00.000Z'),
      canceledAt: null,
      participants: [
        { userId: 'guest-1', joinedAt: new Date('2026-06-09T10:00:00.000Z') },
        { userId: 'guest-2', joinedAt: new Date('2026-06-09T10:05:00.000Z') },
        { userId: 'guest-3', joinedAt: new Date('2026-06-09T10:10:00.000Z') },
      ],
      attendances: [{ userId: 'guest-1' }, { userId: 'guest-2' }],
    });
    const grantReward = jest
      .spyOn(service, 'grantReward')
      .mockImplementation(async (input: any) => {
        if (input.source === 'host_meeting') {
          throw new Error('limit reached');
        }
        return {
          id: `reward-${input.userId}`,
          source: input.source,
          status: 'active',
          ticketCount: input.ticketCount,
          title: input.title,
          description: null,
          relatedType: null,
          relatedId: null,
          cancellationReason: null,
          createdAt: now.toISOString(),
          alreadyClaimed: false,
        };
      });

    await expect(service.evaluateMeetingRewards('event-1', now)).resolves.toEqual({
      granted: 2,
    });

    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'host-1',
        source: 'host_meeting',
        taskMonthlyLimit: 5,
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-1',
        source: 'visit_meeting',
        taskMonthlyLimit: 10,
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-2',
        source: 'visit_meeting',
        taskMonthlyLimit: 10,
      }),
    );
  });

  it('skips host meeting rewards when the meeting conditions are not met', async () => {
    const { service, prismaClient } = makeService();
    const now = new Date('2026-06-09T20:00:00.000Z');
    prismaClient.event.findUnique.mockResolvedValue({
      id: 'event-1',
      title: 'Кофе',
      hostId: 'host-1',
      startsAt: new Date('2026-06-09T18:00:00.000Z'),
      createdAt: new Date('2026-06-09T14:00:00.000Z'),
      canceledAt: null,
      participants: [
        { userId: 'guest-1', joinedAt: new Date('2026-06-09T15:00:00.000Z') },
        { userId: 'guest-2', joinedAt: new Date('2026-06-09T15:05:00.000Z') },
      ],
      attendances: [{ userId: 'guest-1' }],
    });
    const grantReward = jest.spyOn(service, 'grantReward').mockResolvedValue({
      id: 'reward-guest-1',
      source: 'visit_meeting',
      status: 'active',
      ticketCount: 2,
      title: 'Посещение встречи',
      description: null,
      relatedType: 'event',
      relatedId: 'event-1',
      cancellationReason: null,
      createdAt: now.toISOString(),
      alreadyClaimed: false,
    });

    await expect(service.evaluateMeetingRewards('event-1', now)).resolves.toEqual({
      granted: 1,
    });

    expect(grantReward).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'host-1',
        source: 'host_meeting',
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-1',
        source: 'visit_meeting',
      }),
    );
  });

  it('grants referral rewards after the invited user is verified', async () => {
    const { service, prismaClient } = makeService();
    const now = new Date('2026-06-09T10:00:00.000Z');
    prismaClient.user.findUnique.mockResolvedValue({ verified: true });
    prismaClient.dropReferral.findMany = jest.fn().mockResolvedValue([
      {
        inviterUserId: 'inviter-1',
        invitedUserId: 'user-1',
      },
    ]);
    const grantReferralReward = jest
      .spyOn(service, 'grantReferralReward')
      .mockResolvedValue({} as any);

    await expect(service.handleUserVerified('user-1', now)).resolves.toEqual({
      verification: null,
      referralCount: 1,
    });

    expect(grantReferralReward).toHaveBeenCalledWith(
      'inviter-1',
      'user-1',
      now,
      prismaClient,
    );
  });

  it('uses task monthly limits for subscription and boost rewards', async () => {
    const { service } = makeService();
    const now = new Date('2026-06-09T10:00:00.000Z');
    const grantReward = jest.spyOn(service, 'grantReward').mockResolvedValue({} as any);

    await service.grantSubscriptionReward('user-1', 'subscription-1', now);
    await service.grantBoostReward('user-1', 'promotion-1', 'event-1', now);

    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'subscription',
        ticketCount: 5,
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'boost',
        ticketCount: 1,
        taskMonthlyLimit: 5,
      }),
    );
  });

  it('activates pending rewards and tickets after confirmation', async () => {
    const { service, prismaClient } = makeService();
    const now = new Date('2026-06-10T10:00:00.000Z');
    prismaClient.dropRewardEvent.findUnique.mockResolvedValue({
      id: 'reward-1',
      userId: 'user-1',
      source: 'referral',
      status: 'pending',
      ticketCount: 3,
      title: 'Приглашенный друг',
      description: null,
      relatedType: 'user',
      relatedId: 'user-2',
      cancellationReason: null,
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    });
    prismaClient.dropRewardEvent.update.mockResolvedValue({
      id: 'reward-1',
      userId: 'user-1',
      source: 'referral',
      status: 'active',
      ticketCount: 3,
      title: 'Приглашенный друг',
      description: null,
      relatedType: 'user',
      relatedId: 'user-2',
      cancellationReason: null,
      createdAt: new Date('2026-06-09T10:00:00.000Z'),
    });

    await expect(service.confirmReward('reward-1', now)).resolves.toMatchObject({
      id: 'reward-1',
      status: 'active',
      ticketCount: 3,
    });

    expect(prismaClient.dropTicket.updateMany).toHaveBeenCalledWith({
      where: {
        rewardEventId: 'reward-1',
        status: 'pending',
      },
      data: {
        status: 'active',
      },
    });
    expect(prismaClient.dropRewardEvent.update).toHaveBeenCalledWith({
      where: { id: 'reward-1' },
      data: {
        status: 'active',
        confirmedAt: now,
      },
      select: expect.any(Object),
    });
  });
});
