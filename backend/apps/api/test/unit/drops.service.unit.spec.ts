import { DropsService } from '../../src/services/drops.service';

describe('DropsService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      drop: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      dropTicket: {
        count: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
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
      dropWinner: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      dropReferral: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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

  it('returns finished drop winners in detail response', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.findUnique.mockResolvedValue({
      id: 'drop-1',
      title: 'Главный Drop',
      description: 'Описание',
      type: 'main_monthly',
      status: 'finished',
      prizes: [{ title: 'iPhone' }],
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T20:00:00.000Z'),
      drawAt: new Date('2026-06-30T21:00:00.000Z'),
      conditions: {},
      maxTicketsPerUser: 30,
      requiresVerified: true,
      requiresFrendlyPlus: false,
      minAge: null,
      region: null,
      seedHash: 'seed-hash',
      secretSeed: 'secret-seed',
      seedRevealedAt: new Date('2026-06-30T21:05:00.000Z'),
      cancelReason: null,
    });
    prismaClient.dropTicket.count.mockResolvedValue(1);
    prismaClient.dropTicket.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      verified: true,
      profile: { birthDate: null, city: 'Москва' },
    });
    prismaClient.dropUserRestriction.findUnique.mockResolvedValue(null);
    prismaClient.dropWinner.findMany.mockResolvedValue([
      {
        id: 'winner-1',
        status: 'pending_verification',
        position: 1,
        reserve: false,
        prize: { title: 'iPhone' },
        ticket: { code: 'ABC123' },
        user: {
          id: 'user-1',
          displayName: 'Анна',
          profile: { city: 'Москва' },
        },
      },
    ]);

    await expect(service.getDrop('user-1', 'drop-1')).resolves.toMatchObject({
      id: 'drop-1',
      secretSeed: 'secret-seed',
      winners: [
        {
          id: 'winner-1',
          status: 'pending_verification',
          position: 1,
          reserve: false,
          userId: 'user-1',
          name: 'Анна',
          city: 'Москва',
          ticket: 'ABC123',
          prize: 'iPhone',
        },
      ],
    });
  });

  it('lists admin participants grouped by user', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.dropTicket.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        status: 'active',
        user: {
          displayName: 'Анна',
          verified: true,
          status: 'active',
          profile: { city: 'Москва' },
        },
      },
      {
        userId: 'user-1',
        status: 'winner',
        user: {
          displayName: 'Анна',
          verified: true,
          status: 'active',
          profile: { city: 'Москва' },
        },
      },
      {
        userId: 'user-2',
        status: 'used_in_draw',
        user: {
          displayName: 'Олег',
          verified: false,
          status: 'active',
          profile: { city: null },
        },
      },
    ]);

    await expect(service.listDropParticipants('drop-1')).resolves.toEqual({
      items: [
        {
          userId: 'user-1',
          name: 'Анна',
          city: 'Москва',
          verified: true,
          userStatus: 'active',
          ticketCount: 2,
          winnerTicketCount: 1,
        },
        {
          userId: 'user-2',
          name: 'Олег',
          city: null,
          verified: false,
          userStatus: 'active',
          ticketCount: 1,
          winnerTicketCount: 0,
        },
      ],
    });
  });

  it('binds a referral code to the current user once', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.dropReferral.findUnique
      .mockResolvedValueOnce({
        id: 'ref-1',
        code: 'abc123',
        inviterUserId: 'inviter-1',
        invitedUserId: null,
        status: 'created',
      })
      .mockResolvedValueOnce(null);
    prismaClient.dropReferral.updateMany.mockResolvedValue({ count: 1 });
    prismaClient.dropReferral.findUnique.mockResolvedValueOnce({
      id: 'ref-1',
      code: 'abc123',
      inviterUserId: 'inviter-1',
      invitedUserId: 'user-2',
      status: 'registered',
    });

    await expect(service.bindReferralCode('user-2', 'abc123')).resolves.toEqual({
      code: 'abc123',
      inviterUserId: 'inviter-1',
      invitedUserId: 'user-2',
      status: 'registered',
    });

    expect(prismaClient.dropReferral.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ref-1',
        invitedUserId: null,
      },
      data: {
        invitedUserId: 'user-2',
        status: 'registered',
      },
    });
  });

  it('promotes a reserve winner and releases the rejected winning ticket', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.dropWinner.findUnique
      .mockResolvedValueOnce({
        id: 'reserve-1',
        dropId: 'drop-1',
        ticketId: 'ticket-reserve',
        reserve: true,
        position: 1,
        status: 'pending_verification',
      })
      .mockResolvedValueOnce({
        id: 'winner-1',
        dropId: 'drop-1',
        ticketId: 'ticket-main',
        reserve: false,
        position: 1,
        status: 'rejected',
      });
    prismaClient.dropWinner.aggregate.mockResolvedValue({ _max: { position: 3 } });
    prismaClient.dropWinner.update.mockResolvedValueOnce({}).mockResolvedValueOnce({
      id: 'reserve-1',
      reserve: false,
      position: 1,
      status: 'pending_verification',
    });

    await expect(
      service.chooseReserveWinner('reserve-1', {
        replacedWinnerId: 'winner-1',
        reason: 'winner expired',
      }),
    ).resolves.toMatchObject({
      id: 'reserve-1',
      reserve: false,
      position: 1,
    });

    expect(prismaClient.dropWinner.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'winner-1' },
      data: {
        status: 'rejected',
        rejectedReason: 'winner expired',
        reserve: true,
        position: 4,
      },
    });
    expect(prismaClient.dropTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-main' },
      data: { status: 'used_in_draw' },
    });
    expect(prismaClient.dropTicket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-reserve' },
      data: { status: 'winner' },
    });
    expect(prismaClient.dropWinner.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'reserve-1' },
      data: {
        reserve: false,
        position: 1,
        status: 'pending_verification',
      },
    });
  });

  it('returns active assigned tickets to the free pool when a drop is cancelled', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.findUnique.mockResolvedValue({
      id: 'drop-1',
      status: 'active',
    });
    prismaClient.drop.update.mockResolvedValue({
      id: 'drop-1',
      title: 'Drop',
      description: 'Описание',
      type: 'free',
      status: 'cancelled',
      prizes: [],
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T20:00:00.000Z'),
      drawAt: new Date('2026-06-30T21:00:00.000Z'),
      conditions: {},
      maxTicketsPerUser: 10,
      requiresVerified: true,
      requiresFrendlyPlus: false,
      minAge: null,
      region: null,
      seedHash: null,
      secretSeed: null,
      seedRevealedAt: null,
      cancelReason: 'rules changed',
    });

    await expect(service.cancelDrop('drop-1', 'rules changed')).resolves.toMatchObject({
      id: 'drop-1',
      status: 'cancelled',
      cancelReason: 'rules changed',
    });

    expect(prismaClient.dropTicket.updateMany).toHaveBeenCalledWith({
      where: {
        dropId: 'drop-1',
        status: 'active',
      },
      data: {
        dropId: null,
        assignedAt: null,
      },
    });
  });
});
