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
        aggregate: jest.fn(),
      },
      dropTicket: {
        count: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      event: {
        findUnique: jest.fn(),
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
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-1',
        source: 'visit_meeting',
      }),
    );
    expect(grantReward).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'guest-2',
        source: 'visit_meeting',
      }),
    );
  });
});
