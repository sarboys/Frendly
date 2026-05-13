import { SubscriptionService } from '../../src/services/subscription.service';

describe('SubscriptionService unit', () => {
  const tokensService = {
    spendTokens: jest.fn(),
  };

  beforeEach(() => {
    tokensService.spendTokens.mockReset();
  });

  it('loads only fields needed for the current subscription response', async () => {
    const subscription = {
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-04-28T00:00:00.000Z'),
      renewsAt: new Date('2026-05-28T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const findFirst = jest.fn().mockResolvedValue(subscription);
    const service = new SubscriptionService(
      {
        client: {
          userSubscription: {
            findFirst,
          },
        },
      } as any,
      tokensService as any,
    );

    await expect(service.getCurrent('user-me')).resolves.toEqual({
      plan: 'month',
      status: 'active',
      startedAt: '2026-04-28T00:00:00.000Z',
      renewsAt: '2026-05-28T00:00:00.000Z',
      trialEndsAt: null,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      orderBy: { createdAt: 'desc' },
      select: {
        plan: true,
        status: true,
        startedAt: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });
  });

  it('returns matching active subscription without reading it again', async () => {
    const subscription = {
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-04-28T00:00:00.000Z'),
      renewsAt: new Date('2026-05-28T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const findFirst = jest.fn().mockResolvedValue(subscription);
    const create = jest.fn();
    const service = new SubscriptionService(
      {
        client: {
          userSubscription: {
            findFirst,
            create,
          },
        },
      } as any,
      tokensService as any,
    );

    await expect(
      service.subscribe('user-me', {
        plan: 'month',
      }),
    ).resolves.toEqual({
      plan: 'month',
      status: 'active',
      startedAt: '2026-04-28T00:00:00.000Z',
      renewsAt: '2026-05-28T00:00:00.000Z',
      trialEndsAt: null,
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('extends the current active subscription after a confirmed paid payment', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-04-28T00:00:00.000Z').getTime());
    const current = {
      id: 'sub-1',
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-04-01T00:00:00.000Z'),
      renewsAt: new Date('2026-05-28T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const findFirst = jest.fn().mockResolvedValue(current);
    const update = jest.fn().mockResolvedValue({
      ...current,
      renewsAt: new Date('2026-06-27T00:00:00.000Z'),
      trialEndsAt: null,
    });
    const create = jest.fn();
    const service = new SubscriptionService(
      {
        client: {
          userSubscription: {
            findFirst,
            update,
            create,
          },
        },
      } as any,
      tokensService as any,
    );

    await service.activatePaidSubscription('user-me', 'month', 'order-db-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        plan: 'month',
        status: 'active',
        renewsAt: new Date('2026-06-27T00:00:00.000Z'),
        trialEndsAt: null,
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('spends tokens and activates Frendly+ subscription', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-13T10:00:00.000Z').getTime());
    const prismaClient: any = {
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          plan: 'month',
          status: 'active',
          startedAt: new Date('2026-05-13T10:00:00.000Z'),
          renewsAt: new Date('2026-06-12T10:00:00.000Z'),
          trialEndsAt: null,
        }),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
    };
    tokensService.spendTokens.mockResolvedValue({ id: 'ledger-1' });
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
    );

    await expect(
      service.subscribeWithTokens('user-1', { plan: 'month' }),
    ).resolves.toMatchObject({
      plan: 'month',
      status: 'active',
      startedAt: '2026-05-13T10:00:00.000Z',
      renewsAt: '2026-06-12T10:00:00.000Z',
      trialEndsAt: null,
    });

    expect(tokensService.spendTokens).toHaveBeenCalledWith(
      'user-1',
      {
        amount: 799,
        reason: 'subscription_spend',
      },
      prismaClient,
    );
  });

  it('spends tokens and extends an active Frendly+ subscription', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-13T10:00:00.000Z').getTime());
    const current = {
      id: 'sub-1',
      plan: 'month',
      status: 'active',
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
      renewsAt: new Date('2026-06-01T00:00:00.000Z'),
      trialEndsAt: null,
    };
    const prismaClient: any = {
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue({
          ...current,
          renewsAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
    };
    tokensService.spendTokens.mockResolvedValue({ id: 'ledger-1' });
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
    );

    await service.subscribeWithTokens('user-1', { plan: 'month' });

    expect(tokensService.spendTokens).toHaveBeenCalledWith(
      'user-1',
      {
        amount: 799,
        reason: 'subscription_spend',
      },
      prismaClient,
    );
    expect(prismaClient.userSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        plan: 'month',
        status: 'active',
        renewsAt: new Date('2026-07-01T00:00:00.000Z'),
        trialEndsAt: null,
      },
    });
    expect(prismaClient.userSubscription.create).not.toHaveBeenCalled();
  });
});
