import { TokensService } from '../../src/services/tokens.service';

describe('TokensService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      tokenWallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      tokenLedgerEntry: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      tokenPromotion: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      event: {
        findFirst: jest.fn(),
      },
      chatMember: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
      ...overrides.prismaClient,
    };
    const dropsRewardService = {
      grantBoostReward: jest.fn(),
      ...overrides.dropsRewardService,
    };
    return {
      service: new TokensService(
        { client: prismaClient } as any,
        dropsRewardService as any,
        overrides.redisCache as any,
      ),
      prismaClient,
      dropsRewardService,
    };
  };

  it('returns a zero wallet with empty history for an existing user', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 0,
    });
    prismaClient.tokenLedgerEntry.findMany.mockResolvedValue([]);
    prismaClient.tokenPromotion.findMany.mockResolvedValue([]);

    await expect(service.getWallet('user-1')).resolves.toMatchObject({
      balance: 0,
      history: [],
      promoted: [],
    });

    expect(prismaClient.tokenWallet.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        id: true,
        userId: true,
        balance: true,
      },
    });
    expect(prismaClient.tokenWallet.create).not.toHaveBeenCalled();
  });

  it('creates a zero wallet only when the user has no wallet', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue(null);
    prismaClient.tokenWallet.create.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 0,
    });

    await expect(service.getWallet('user-1')).resolves.toMatchObject({
      balance: 0,
      history: [],
      promoted: [],
    });

    expect(prismaClient.tokenWallet.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        balance: 0,
      },
      select: {
        id: true,
        userId: true,
        balance: true,
      },
    });
  });

  it('returns cached wallet without database reads', async () => {
    const cached = {
      balance: 150,
      history: [],
      promoted: [],
      promoOptions: [],
    };
    const redisCache = {
      getJson: jest.fn().mockResolvedValue(cached),
      setJson: jest.fn(),
      delete: jest.fn(),
    };
    const { service, prismaClient } = makeService({ redisCache });

    await expect(service.getWallet('user-1')).resolves.toEqual(cached);
    expect(redisCache.getJson).toHaveBeenCalledWith('api:tokens-wallet:v1:user-1');
    expect(prismaClient.tokenWallet.findUnique).not.toHaveBeenCalled();
    expect(redisCache.setJson).not.toHaveBeenCalled();
  });

  it('maps ledger entries into wallet history newest first', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 350,
    });
    prismaClient.tokenLedgerEntry.findMany.mockResolvedValue([
      {
        id: 'entry-spend',
        amount: -80,
        reason: 'promotion_spend',
        createdAt: new Date('2026-05-13T10:00:00.000Z'),
      },
      {
        id: 'entry-buy',
        amount: 350,
        reason: 'purchase',
        createdAt: new Date('2026-05-13T09:00:00.000Z'),
      },
    ]);
    prismaClient.tokenPromotion.findMany.mockResolvedValue([]);

    await expect(service.getWallet('user-1')).resolves.toMatchObject({
      balance: 350,
      history: [
        {
          id: 'entry-spend',
          type: 'spend',
          amount: 80,
          note: 'Продвижение',
          timestamp: '2026-05-13T10:00:00.000Z',
        },
        {
          id: 'entry-buy',
          type: 'topup',
          amount: 350,
          note: 'Пополнение токенов',
          timestamp: '2026-05-13T09:00:00.000Z',
        },
      ],
    });
  });

  it('credits purchased tokens once through a ledger entry tied to payment order', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 0,
    });
    prismaClient.tokenWallet.update.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 350,
    });

    await service.creditPurchasedTokens(
      'user-1',
      'p2',
      'payment-order-1',
      prismaClient as any,
    );

    expect(prismaClient.tokenLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        walletId: 'wallet-1',
        paymentOrderId: 'payment-order-1',
        amount: 350,
        reason: 'purchase',
      },
    });
    expect(prismaClient.tokenWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        balance: {
          increment: 350,
        },
      },
    });
  });

  it('credits purchased tokens from a stored token pack snapshot', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 0,
    });
    prismaClient.tokenWallet.update.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 525,
    });

    await service.creditPurchasedTokens(
      'user-1',
      {
        packId: 'p-custom',
        tokens: 500,
        bonus: 25,
      } as any,
      'payment-order-1',
      prismaClient as any,
    );

    expect(prismaClient.tokenLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        walletId: 'wallet-1',
        paymentOrderId: 'payment-order-1',
        amount: 525,
        reason: 'purchase',
      },
    });
    expect(prismaClient.tokenWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        balance: {
          increment: 525,
        },
      },
    });
  });

  it('rejects promotion spend when wallet balance is not enough', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 10,
    });
    prismaClient.event.findFirst.mockResolvedValue({
      id: 'event-1',
    });

    await expect(
      service.createPromotion('user-1', {
        targetKind: 'event',
        targetId: 'event-1',
        optionId: 'boost-24',
      }),
    ).rejects.toMatchObject({
      statusCode: 402,
      code: 'tokens_insufficient',
    });
    expect(prismaClient.tokenLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('spends tokens with an atomic balance guard', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 100,
    });
    prismaClient.tokenWallet.updateMany.mockResolvedValue({ count: 1 });
    prismaClient.tokenLedgerEntry.create.mockResolvedValue({
      id: 'entry-1',
    });

    await service.spendTokens(
      'user-1',
      {
        amount: 80,
        reason: 'subscription_spend',
      },
      prismaClient as any,
    );

    expect(prismaClient.tokenWallet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wallet-1',
        balance: {
          gte: 80,
        },
      },
      data: {
        balance: {
          decrement: 80,
        },
      },
    });
    expect(prismaClient.tokenLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        walletId: 'wallet-1',
        amount: -80,
        reason: 'subscription_spend',
      },
    });
  });

  it('grants a Drops boost reward after promoting an event', async () => {
    const { service, prismaClient, dropsRewardService } = makeService();
    prismaClient.event.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 100,
    });
    prismaClient.tokenWallet.updateMany.mockResolvedValue({ count: 1 });
    prismaClient.tokenLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prismaClient.tokenPromotion.create.mockResolvedValue({ id: 'promotion-1' });

    await service.createPromotion('user-1', {
      targetKind: 'event',
      targetId: 'event-1',
      optionId: 'boost-24',
    });

    expect(dropsRewardService.grantBoostReward).toHaveBeenCalledWith(
      'user-1',
      'promotion-1',
      'event-1',
      expect.any(Date),
      prismaClient,
    );
  });

  it('spends 20 tokens for the 6 hour boost option', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.event.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaClient.tokenWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 25,
    });
    prismaClient.tokenWallet.updateMany.mockResolvedValue({ count: 1 });
    prismaClient.tokenLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prismaClient.tokenPromotion.create.mockResolvedValue({ id: 'promotion-1' });

    await service.createPromotion('user-1', {
      targetKind: 'event',
      targetId: 'event-1',
      optionId: 'boost-6',
    });

    expect(prismaClient.tokenWallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          balance: { gte: 20 },
        }),
        data: { balance: { decrement: 20 } },
      }),
    );
    expect(prismaClient.tokenPromotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          optionId: 'boost-6',
          eventId: 'event-1',
        }),
      }),
    );
  });
});
