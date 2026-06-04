import { SubscriptionService } from '../../src/services/subscription.service';

describe('SubscriptionService unit', () => {
  const tokensService = {
    spendTokens: jest.fn(),
  };
  const dropsRewardService = {
    grantSubscriptionReward: jest.fn(),
  };

  beforeEach(() => {
    tokensService.spendTokens.mockReset();
    dropsRewardService.grantSubscriptionReward.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads only fields needed for the current subscription response', async () => {
    const previousCacheFlag =
      process.env.API_CURRENT_SUBSCRIPTION_CACHE_IN_TESTS;
    process.env.API_CURRENT_SUBSCRIPTION_CACHE_IN_TESTS = 'true';
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-13T10:00:00.000Z').getTime());
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

    try {
      await expect(service.getCurrent('user-me')).resolves.toEqual({
        plan: 'month',
        status: 'active',
        startedAt: '2026-04-28T00:00:00.000Z',
        renewsAt: '2026-05-28T00:00:00.000Z',
        trialEndsAt: null,
      });
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
      expect(findFirst).toHaveBeenCalledTimes(1);
    } finally {
      if (previousCacheFlag == null) {
        delete process.env.API_CURRENT_SUBSCRIPTION_CACHE_IN_TESTS;
      } else {
        process.env.API_CURRENT_SUBSCRIPTION_CACHE_IN_TESTS =
          previousCacheFlag;
      }
    }
  });

  it('returns matching active subscription without reading it again', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-13T10:00:00.000Z').getTime());
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
      dropsRewardService as any,
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
    expect(dropsRewardService.grantSubscriptionReward).toHaveBeenCalledWith(
      'user-1',
      'ledger-1',
      expect.any(Date),
      prismaClient,
    );
  });

  it('uses month, quarter and year plans in the fallback catalog', async () => {
    const service = new SubscriptionService(
      {
        client: {},
      } as any,
      tokensService as any,
    );

    await expect(service.getPlans()).resolves.toMatchObject({
      plans: [
        {
          id: 'month',
          label: 'Месячный',
          priceRub: 799,
          priceMonthlyRub: 799,
          tokenCost: 799,
          tokenMonthlyCost: 799,
          durationDays: 30,
        },
        {
          id: 'quarter',
          label: '3 месяца',
          priceRub: 1797,
          priceMonthlyRub: 599,
          tokenCost: 1797,
          tokenMonthlyCost: 599,
          durationDays: 90,
        },
        {
          id: 'year',
          label: 'Годовой',
          priceRub: 4788,
          priceMonthlyRub: 399,
          tokenCost: 4788,
          tokenMonthlyCost: 399,
          durationDays: 365,
        },
      ],
    });
  });

  it('returns active catalog plans and editable benefits from database', async () => {
    const prismaClient: any = {
      subscriptionCatalogPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'half-year',
            label: '6 месяцев',
            priceRub: 2994,
            priceMonthlyRub: 499,
            tokenCost: 2994,
            tokenMonthlyCost: 499,
            trialDays: 0,
            durationDays: 180,
            badge: '-38%',
            benefits: ['Приоритет в радаре'],
          },
        ]),
      },
      tokenCatalogPack: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p-custom',
            label: 'Свой',
            description: 'Frendly Tokens: 500',
            priceRub: 599,
            tokens: 500,
            bonus: 25,
            best: true,
            active: true,
            sortOrder: 10,
          },
        ]),
      },
      subscriptionCatalogSettings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'frendly_plus',
          benefits: ['Больше встреч', 'Больше лайков'],
        }),
      },
    };
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
    );

    const result = await service.getPlans();
    const cachedResult = await service.getPlans();

    expect(result).toEqual({
      plans: [
        expect.objectContaining({
          id: 'half-year',
          label: '6 месяцев',
          tokenCost: 2994,
          tokenMonthlyCost: 499,
          durationDays: 180,
          benefits: ['Приоритет в радаре'],
        }),
      ],
      plusBenefits: ['Больше встреч', 'Больше лайков'],
      plusRules: expect.objectContaining({
        freeSwipeHourlyLimit: 100,
        plusSwipeHourlyLimit: null,
        freeSuperLikeDailyLimit: 1,
        plusSuperLikeDailyLimit: 10,
        paidSuperLikeTokenCost: 50,
        freeMeetupMonthlyLimit: 7,
        plusMeetupMonthlyLimit: null,
        tokenPurchaseDiscountPercent: 15,
        communityCreationRequiresPlus: true,
        incomingLikesRequiresPlus: true,
      }),
      tokenPacks: [
        expect.objectContaining({
          id: 'p-custom',
          label: 'Свой',
          priceRub: 599,
          tokens: 500,
          bonus: 25,
          best: true,
        }),
      ],
    });
    expect(cachedResult).toBe(result);
    expect(prismaClient.subscriptionCatalogPlan.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prismaClient.subscriptionCatalogPlan.findMany).toHaveBeenCalledTimes(1);
    expect(prismaClient.tokenCatalogPack.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prismaClient.tokenCatalogPack.findMany).toHaveBeenCalledTimes(1);
    expect(prismaClient.subscriptionCatalogSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it('saves editable Frendly Plus benefit rules', async () => {
    const prismaClient: any = {
      subscriptionCatalogPlan: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      tokenCatalogPack: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p-custom' },
          { id: 'p-old' },
        ]),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      subscriptionCatalogSettings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'frendly_plus',
          benefits: ['Безлимитные свайпы'],
          freeSwipeHourlyLimit: 120,
          plusSwipeHourlyLimit: null,
          freeSuperLikeDailyLimit: 2,
          plusSuperLikeDailyLimit: 12,
          paidSuperLikeTokenCost: 40,
          freeMeetupMonthlyLimit: 8,
          plusMeetupMonthlyLimit: null,
          tokenPurchaseDiscountPercent: 20,
          communityCreationRequiresPlus: false,
          incomingLikesRequiresPlus: true,
        }),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
    };
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
    );

    await service.updateAdminCatalog({
      plans: [
        {
          id: 'month',
          label: 'Месяц',
          description: 'Frendly+',
          priceRub: 799,
          priceMonthlyRub: 799,
          tokenCost: 799,
          tokenMonthlyCost: 799,
          trialDays: 0,
          durationDays: 30,
          benefits: [],
          active: true,
          sortOrder: 0,
        },
      ],
      plusBenefits: ['Безлимитные свайпы'],
      plusRules: {
        freeSwipeHourlyLimit: 120,
        plusSwipeHourlyLimit: null,
        freeSuperLikeDailyLimit: 2,
        plusSuperLikeDailyLimit: 12,
        paidSuperLikeTokenCost: 40,
        freeMeetupMonthlyLimit: 8,
        plusMeetupMonthlyLimit: null,
        tokenPurchaseDiscountPercent: 20,
        communityCreationRequiresPlus: false,
        incomingLikesRequiresPlus: true,
      },
      tokenPacks: [
        {
          id: 'p-custom',
          label: 'Свой',
          description: 'Frendly Tokens: 500',
          priceRub: 599,
          tokens: 500,
          bonus: 25,
          best: true,
          active: true,
          sortOrder: 10,
        },
      ],
    });

    expect(prismaClient.subscriptionCatalogSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'frendly_plus' },
      update: expect.objectContaining({
        benefits: ['Безлимитные свайпы'],
        freeSwipeHourlyLimit: 120,
        tokenPurchaseDiscountPercent: 20,
        communityCreationRequiresPlus: false,
      }),
      create: expect.objectContaining({
        id: 'frendly_plus',
        freeSwipeHourlyLimit: 120,
        tokenPurchaseDiscountPercent: 20,
      }),
    });
    expect(prismaClient.tokenCatalogPack.upsert).toHaveBeenCalledWith({
      where: { id: 'p-custom' },
      update: expect.objectContaining({
        label: 'Свой',
        priceRub: 599,
        tokens: 500,
        bonus: 25,
        best: true,
      }),
      create: expect.objectContaining({
        id: 'p-custom',
        label: 'Свой',
        priceRub: 599,
        tokens: 500,
      }),
    });
    expect(prismaClient.tokenCatalogPack.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-old'] } },
      data: { active: false },
    });
  });

  it('spends tokens using custom admin catalog plan price', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-13T10:00:00.000Z').getTime());
    const prismaClient: any = {
      subscriptionCatalogPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'half-year',
            label: '6 месяцев',
            priceRub: 2994,
            priceMonthlyRub: 499,
            tokenCost: 2994,
            tokenMonthlyCost: 499,
            trialDays: 0,
            durationDays: 180,
            badge: '-38%',
            benefits: [],
            active: true,
            sortOrder: 1,
          },
        ]),
      },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          plan: 'half-year',
          status: 'active',
          startedAt: new Date('2026-05-13T10:00:00.000Z'),
          renewsAt: new Date('2026-11-09T10:00:00.000Z'),
          trialEndsAt: null,
        }),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
    };
    tokensService.spendTokens.mockResolvedValue({ id: 'ledger-1' });
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
      dropsRewardService as any,
    );

    await service.subscribeWithTokens('user-1', { plan: 'half-year' });

    expect(tokensService.spendTokens).toHaveBeenCalledWith(
      'user-1',
      {
        amount: 2994,
        reason: 'subscription_spend',
      },
      prismaClient,
    );
    expect(prismaClient.userSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        plan: 'half-year',
        status: 'active',
        startedAt: new Date('2026-05-13T10:00:00.000Z'),
        renewsAt: new Date('2026-11-09T10:00:00.000Z'),
        trialEndsAt: null,
      },
    });
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
      dropsRewardService as any,
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

  it('grants a Drops subscription reward after a confirmed paid subscription', async () => {
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
    };
    const service = new SubscriptionService(
      { client: prismaClient } as any,
      tokensService as any,
      dropsRewardService as any,
    );

    await service.activatePaidSubscription(
      'user-1',
      'month',
      'payment-order-1',
      prismaClient,
    );

    expect(dropsRewardService.grantSubscriptionReward).toHaveBeenCalledWith(
      'user-1',
      'payment-order-1',
      expect.any(Date),
      prismaClient,
    );
  });
});
