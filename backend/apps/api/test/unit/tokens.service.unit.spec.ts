import { TokensService } from '../../src/services/tokens.service';

describe('TokensService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      tokenWallet: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
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
    return {
      service: new TokensService({ client: prismaClient } as any),
      prismaClient,
    };
  };

  it('returns a zero wallet with empty history for a new user', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.upsert.mockResolvedValue({
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

    expect(prismaClient.tokenWallet.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: {
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

  it('maps ledger entries into wallet history newest first', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.upsert.mockResolvedValue({
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
    prismaClient.tokenWallet.upsert.mockResolvedValue({
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

  it('rejects promotion spend when wallet balance is not enough', async () => {
    const { service, prismaClient } = makeService();
    prismaClient.tokenWallet.upsert.mockResolvedValue({
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
    prismaClient.tokenWallet.upsert.mockResolvedValue({
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
});
