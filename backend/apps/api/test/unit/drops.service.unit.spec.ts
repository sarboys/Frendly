import { DropsService } from '../../src/services/drops.service';

jest.mock('@aws-sdk/client-s3', () => {
  const mockS3Send = jest.fn();
  return {
    PutObjectCommand: jest.fn((input) => ({ input })),
    S3Client: jest.fn(() => ({ send: mockS3Send })),
    __mockS3Send: mockS3Send,
  };
});

describe('DropsService unit', () => {
  const s3Mock = jest.requireMock('@aws-sdk/client-s3') as {
    __mockS3Send: jest.Mock;
  };

  beforeEach(() => {
    s3Mock.__mockS3Send.mockReset();
    s3Mock.__mockS3Send.mockResolvedValue({});
  });

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
        groupBy: jest.fn().mockResolvedValue([]),
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
        groupBy: jest.fn().mockResolvedValue([]),
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

  it('creates drop with image URL', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.create.mockResolvedValue({
      id: 'drop-1',
      title: 'Июньский Drop',
      description: 'Описание',
      imageUrl: 'https://cdn.frendly.test/drop.jpg',
      type: 'main_monthly',
      status: 'draft',
      prizes: [{ title: 'iPhone' }],
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T20:59:00.000Z'),
      drawAt: new Date('2026-07-01T09:00:00.000Z'),
      conditions: {},
      maxTicketsPerUser: 30,
      requiresVerified: true,
      requiresFrendlyPlus: false,
      minAge: null,
      region: null,
      seedHash: null,
      secretSeed: null,
      seedRevealedAt: null,
      cancelReason: null,
    });

    await service.createDrop({
      title: 'Июньский Drop',
      description: 'Описание',
      imageUrl: 'https://cdn.frendly.test/drop.jpg',
      type: 'main_monthly',
      prizes: [{ title: 'iPhone' }],
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '2026-06-30T20:59:00.000Z',
      drawAt: '2026-07-01T09:00:00.000Z',
      maxTicketsPerUser: 30,
    });

    expect(prismaClient.drop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: 'https://cdn.frendly.test/drop.jpg',
        }),
      }),
    );
  });

  it('caches ticket history for repeated reads', async () => {
    const { service, prismaClient } = makeService();
    const createdAt = new Date('2026-06-09T12:00:00.000Z');
    prismaClient.dropRewardEvent.findMany.mockResolvedValue([
      {
        id: 'reward-1',
        source: 'daily_login',
        status: 'active',
        title: 'Ежедневный вход',
        ticketCount: 1,
        cancellationReason: null,
        createdAt,
        relatedType: 'daily_login',
        relatedId: '2026-06-09',
      },
    ]);

    const result = await service.listHistory('user-1', { month: '2026-06' });
    const cachedResult = await service.listHistory('user-1', {
      month: '2026-06',
    });

    expect(result).toEqual({
      items: [
        {
          id: 'reward-1',
          source: 'daily_login',
          status: 'active',
          title: 'Ежедневный вход',
          ticketCount: 1,
          cancellationReason: null,
          relatedType: 'daily_login',
          relatedId: '2026-06-09',
          createdAt: createdAt.toISOString(),
        },
      ],
    });
    expect(cachedResult).toBe(result);
    expect(prismaClient.dropRewardEvent.findMany).toHaveBeenCalledTimes(1);
  });

  it('uploads drop images with immutable public cache headers', async () => {
    const { service } = makeService();

    await expect(
      service.uploadDropImageFile({
        originalname: 'drop.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('drop'),
      } as Express.Multer.File),
    ).resolves.toMatchObject({
      imageUrl: expect.stringContaining('/drop-images/'),
      objectKey: expect.stringContaining('drop-images/'),
    });

    expect(s3Mock.__mockS3Send).toHaveBeenCalledTimes(1);
    expect(s3Mock.__mockS3Send.mock.calls[0]?.[0].input).toMatchObject({
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

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

  it('returns detailed user-facing conditions for every monthly task', async () => {
    const { service, prismaClient, rewardService } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      verified: true,
      status: 'active',
    });
    rewardService.getProgress.mockResolvedValue({
      monthKey: '2026-06',
      earned: 0,
      reserved: 0,
      availableTickets: 0,
      max: 30,
      nextResetAt: '2026-07-01T00:00:00.000Z',
    });

    const result = await service.getTasks('user-1');
    const bySource = new Map(result.tasks.map((task) => [task.source, task]));

    expect([...bySource.keys()]).toEqual([
      'verification',
      'daily_login',
      'host_meeting',
      'visit_meeting',
      'referral',
      'subscription',
      'boost',
    ]);
    for (const task of result.tasks) {
      expect(task.conditionDetails).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`+${task.rewardTickets}`),
        ]),
      );
    }
    expect(bySource.get('daily_login')).toMatchObject({
      monthlyLimit: 7,
      conditionDetails: expect.arrayContaining([
        expect.stringContaining('по Москве'),
        expect.stringContaining('7'),
      ]),
    });
    expect(bySource.get('host_meeting')).toMatchObject({
      monthlyLimit: 5,
      conditionDetails: expect.arrayContaining([
        expect.stringContaining('6 часов'),
        expect.stringContaining('3 гостя'),
        expect.stringContaining('2 гостя'),
      ]),
    });
    expect(bySource.get('visit_meeting')).toMatchObject({
      monthlyLimit: 10,
      conditionDetails: expect.arrayContaining([
        expect.stringContaining('до старта'),
        expect.stringContaining('присутствие'),
      ]),
    });
    expect(bySource.get('boost')).toMatchObject({
      monthlyLimit: 5,
      conditionDetails: expect.arrayContaining([
        expect.stringContaining('активации продвижения'),
      ]),
    });
  });

  it('marks the subscription task completed after an active subscription reward', async () => {
    const { service, prismaClient, rewardService } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      verified: true,
      status: 'active',
    });
    rewardService.getProgress.mockResolvedValue({
      monthKey: '2026-06',
      earned: 5,
      reserved: 5,
      availableTickets: 5,
      max: 30,
      nextResetAt: '2026-07-01T00:00:00.000Z',
    });
    prismaClient.dropRewardEvent.findMany.mockResolvedValue([
      {
        source: 'subscription',
        status: 'active',
        ticketCount: 5,
        idempotencyKey: 'subscription:user-1:ledger-1',
      },
    ]);

    const result = await service.getTasks('user-1');
    const bySource = new Map(result.tasks.map((task) => [task.source, task]));

    expect(bySource.get('subscription')).toMatchObject({
      status: 'completed',
      progress: 5,
    });
  });

  it('keeps the subscription task pending while the reward waits for confirmation', async () => {
    const { service, prismaClient, rewardService } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      verified: true,
      status: 'active',
    });
    rewardService.getProgress.mockResolvedValue({
      monthKey: '2026-06',
      earned: 0,
      reserved: 5,
      availableTickets: 0,
      max: 30,
      nextResetAt: '2026-07-01T00:00:00.000Z',
    });
    prismaClient.dropRewardEvent.findMany.mockResolvedValue([
      {
        source: 'subscription',
        status: 'pending',
        ticketCount: 5,
        idempotencyKey: 'subscription:user-1:payment-order-1',
      },
    ]);

    const result = await service.getTasks('user-1');
    const bySource = new Map(result.tasks.map((task) => [task.source, task]));

    expect(bySource.get('subscription')).toMatchObject({
      status: 'pending',
      progress: 5,
    });
  });

  it('completes the daily login task only for the current Moscow date', async () => {
    const { service, prismaClient, rewardService } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      verified: true,
      status: 'active',
    });
    rewardService.localDateKey.mockReturnValue('2026-06-09');
    rewardService.getProgress.mockResolvedValue({
      monthKey: '2026-06',
      earned: 1,
      reserved: 1,
      availableTickets: 1,
      max: 30,
      nextResetAt: '2026-07-01T00:00:00.000Z',
    });
    prismaClient.dropRewardEvent.findMany.mockResolvedValueOnce([
      {
        source: 'daily_login',
        status: 'active',
        ticketCount: 1,
        idempotencyKey: 'daily_login:user-1:2026-06-08',
      },
    ]);

    const previousDayResult = await service.getTasks('user-1');
    const previousDayBySource = new Map(
      previousDayResult.tasks.map((task) => [task.source, task]),
    );

    expect(previousDayBySource.get('daily_login')).toMatchObject({
      status: 'available',
      progress: 1,
    });

    prismaClient.dropRewardEvent.findMany.mockResolvedValueOnce([
      {
        source: 'daily_login',
        status: 'active',
        ticketCount: 1,
        idempotencyKey: 'daily_login:user-1:2026-06-09',
      },
    ]);

    const todayResult = await service.getTasks('user-1');
    const todayBySource = new Map(
      todayResult.tasks.map((task) => [task.source, task]),
    );

    expect(todayBySource.get('daily_login')).toMatchObject({
      status: 'completed',
      progress: 1,
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

  it('serves drop detail from cache when available', async () => {
    const cache = {
      getJson: jest.fn().mockResolvedValue({
        id: 'drop-1',
        myTickets: 2,
      }),
      setJson: jest.fn(),
      delete: jest.fn(),
    };
    const dropFindUnique = jest.fn();
    const service = new DropsService(
      {
        client: {
          drop: {
            findUnique: dropFindUnique,
          },
        },
      } as any,
      {} as any,
      undefined,
      cache as any,
    );

    await expect(service.getDrop('user-1', 'drop-1')).resolves.toMatchObject({
      id: 'drop-1',
      myTickets: 2,
    });
    expect(dropFindUnique).not.toHaveBeenCalled();
    expect(cache.getJson).toHaveBeenCalledWith('drops:detail:v1:user-1:drop-1');
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
          frozen: false,
          freezeReason: null,
          ticketCount: 2,
          winnerTicketCount: 1,
        },
        {
          userId: 'user-2',
          name: 'Олег',
          city: null,
          verified: false,
          userStatus: 'active',
          frozen: false,
          freezeReason: null,
          ticketCount: 1,
          winnerTicketCount: 0,
        },
      ],
      nextCursor: null,
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

  it('filters admin drops and returns table counts without leaking secret seed before finish', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.findMany.mockResolvedValue([
      {
        id: 'drop-1',
        title: 'Free Drop',
        description: 'Описание',
        type: 'free',
        status: 'active',
        prizes: [{ title: 'Prize' }],
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-30T20:00:00.000Z'),
        drawAt: new Date('2026-06-30T21:00:00.000Z'),
        conditions: {},
        maxTicketsPerUser: 10,
        requiresVerified: true,
        requiresFrendlyPlus: false,
        minAge: null,
        region: null,
        seedHash: 'seed-hash',
        secretSeed: 'secret-seed',
        seedRevealedAt: null,
        cancelReason: null,
      },
    ]);
    prismaClient.dropTicket.groupBy.mockResolvedValue([
      { dropId: 'drop-1', _count: { _all: 3 } },
    ]);
    prismaClient.dropTicket.findMany.mockResolvedValue([
      { dropId: 'drop-1', userId: 'user-1' },
      { dropId: 'drop-1', userId: 'user-2' },
    ]);
    prismaClient.dropWinner.groupBy.mockResolvedValue([
      { dropId: 'drop-1', _count: { _all: 1 } },
    ]);

    await expect(
      service.listAdminDrops({
        status: 'active',
        type: 'free',
        q: 'Drop',
        limit: '10',
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'drop-1',
          ticketCount: 3,
          participantCount: 2,
          winnerCount: 1,
          secretSeed: null,
        }),
      ],
      nextCursor: null,
    });

    expect(prismaClient.drop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { status: 'active' },
            { type: 'free' },
            {
              OR: [
                { title: { contains: 'Drop', mode: 'insensitive' } },
                { description: { contains: 'Drop', mode: 'insensitive' } },
              ],
            },
          ],
        },
        take: 11,
      }),
    );
  });

  it('returns admin drop detail with winners and hides secret seed before finish', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.drop.findUnique.mockResolvedValue({
      id: 'drop-1',
      title: 'Active Drop',
      description: 'Описание',
      type: 'free',
      status: 'active',
      prizes: [{ title: 'Prize' }],
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T20:00:00.000Z'),
      drawAt: new Date('2026-06-30T21:00:00.000Z'),
      conditions: {},
      maxTicketsPerUser: 10,
      requiresVerified: true,
      requiresFrendlyPlus: false,
      minAge: null,
      region: null,
      seedHash: 'seed-hash',
      secretSeed: 'secret-seed',
      seedRevealedAt: null,
      cancelReason: null,
    });
    prismaClient.dropTicket.groupBy.mockResolvedValue([
      { dropId: 'drop-1', _count: { _all: 2 } },
    ]);
    prismaClient.dropTicket.findMany.mockResolvedValue([
      { dropId: 'drop-1', userId: 'user-1' },
    ]);
    prismaClient.dropWinner.groupBy.mockResolvedValue([]);
    prismaClient.dropWinner.findMany.mockResolvedValue([
      {
        id: 'winner-1',
        status: 'pending_verification',
        position: 1,
        reserve: false,
        prize: { title: 'Prize' },
        rejectedReason: null,
        createdAt: new Date('2026-06-30T21:01:00.000Z'),
        updatedAt: new Date('2026-06-30T21:01:00.000Z'),
        ticket: { id: 'ticket-1', code: 'ABC123' },
        user: {
          id: 'user-1',
          displayName: 'Анна',
          profile: { city: 'Москва' },
        },
      },
    ]);

    await expect(service.getAdminDrop('drop-1')).resolves.toMatchObject({
      id: 'drop-1',
      ticketCount: 2,
      participantCount: 1,
      secretSeed: null,
      winners: [
        {
          id: 'winner-1',
          status: 'pending_verification',
          reserve: false,
          userId: 'user-1',
          ticketId: 'ticket-1',
          ticket: 'ABC123',
          rejectedReason: null,
        },
      ],
    });
  });
});
