import { TokensService } from '../../src/services/tokens.service';

describe('TokensService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      tokenWallet: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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
});
