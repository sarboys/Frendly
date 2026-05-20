import { DropsService } from '../../src/services/drops.service';

describe('DropsService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      drop: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dropTicket: {
        count: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      dropUserRestriction: {
        findUnique: jest.fn(),
      },
      userSubscription: {
        findFirst: jest.fn(),
      },
      dropRewardEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
      ...overrides.prismaClient,
    };
    const rewardService = {
      monthBounds: jest.fn().mockReturnValue({ monthKey: '2026-06' }),
      localDateKey: jest.fn().mockReturnValue('2026-06-09'),
      getProgress: jest.fn().mockResolvedValue({
        monthKey: '2026-06',
        earned: 0,
        reserved: 0,
        availableTickets: 0,
        max: 30,
        nextResetAt: '2026-06-30T21:00:00.000Z',
      }),
      ...overrides.rewardService,
    };
    return {
      service: new DropsService({ client: prismaClient } as any, rewardService as any),
      prismaClient,
      rewardService,
    };
  };

  it('applies only free active tickets to one active drop', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.findUnique.mockResolvedValue({
      id: 'drop-1',
      type: 'free',
      status: 'active',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T20:00:00.000Z'),
      maxTicketsPerUser: 10,
      requiresVerified: true,
      requiresFrendlyPlus: false,
      minAge: null,
      region: null,
    });
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      verified: true,
      profile: { birthDate: new Date('1995-01-01T00:00:00.000Z'), city: 'Москва' },
    });
    prismaClient.dropUserRestriction.findUnique.mockResolvedValue(null);
    prismaClient.dropTicket.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    prismaClient.dropTicket.findMany.mockResolvedValue([
      { id: 'ticket-2' },
      { id: 'ticket-3' },
    ]);
    prismaClient.dropTicket.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.applyTickets('user-1', 'drop-1', 2),
    ).resolves.toMatchObject({
      dropId: 'drop-1',
      appliedCount: 2,
      userTicketsInDrop: 3,
      availableTickets: 1,
    });

    expect(prismaClient.dropTicket.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'active',
        dropId: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2,
      select: { id: true },
    });
    expect(prismaClient.dropTicket.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['ticket-2', 'ticket-3'] },
        userId: 'user-1',
        status: 'active',
        dropId: null,
      },
      data: {
        dropId: 'drop-1',
        assignedAt: expect.any(Date),
      },
    });
  });

  it('routes unverified users to verification instead of claiming the verification reward', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      verified: false,
      status: 'active',
    });

    const result = await service.getTasks('user-1');
    const verificationTask = result.tasks.find((task) => task.source === 'verification');

    expect(verificationTask?.cta).toEqual({
      label: 'Верификация',
      route: '/verify',
      action: null,
    });
  });
});
