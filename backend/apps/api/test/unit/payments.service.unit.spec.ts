import { ApiError } from '../../src/common/api-error';
import { PaymentsService } from '../../src/services/payments.service';

describe('PaymentsService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      paymentOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prismaClient)),
      ...overrides.prismaClient,
    };
    const tbank: any = {
      isEnabled: jest.fn().mockReturnValue(true),
      getTerminalKey: jest.fn().mockReturnValue('test-terminal'),
      buildToken: jest.fn().mockReturnValue('valid-token'),
      initPayment: jest.fn(),
      getState: jest.fn(),
      ...overrides.tbank,
    };
    const subscription: any = {
      activatePaidSubscription: jest.fn(),
      ...overrides.subscription,
    };
    const tokens: any = {
      creditPurchasedTokens: jest.fn(),
      ...overrides.tokens,
    };
    const service = new PaymentsService(
      { client: prismaClient } as any,
      tbank as any,
      subscription as any,
      tokens as any,
    );
    return { service, prismaClient, tbank, subscription, tokens };
  };

  afterEach(() => {
    delete process.env.PAYMENTS_TBANK_ENABLED;
    delete process.env.PUBLIC_API_URL;
    delete process.env.TBANK_NOTIFICATION_URL;
    delete process.env.APP_DEEP_LINK_SCHEME;
  });

  it('uses backend catalog token pack price and creates one-time T-Bank payment', async () => {
    process.env.PAYMENTS_TBANK_ENABLED = 'true';
    process.env.PUBLIC_API_URL = 'https://api.test';
    process.env.APP_DEEP_LINK_SCHEME = 'frendly';

    const { service, prismaClient, tbank } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: null,
      phoneNumber: '+79990000000',
    });
    prismaClient.paymentOrder.create.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      amountKopecks: 49900,
      productKind: 'tokens',
      productId: 'p2',
      status: 'pending',
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      orderId: 'fr_123',
      providerPaymentId: 'payment-1',
      paymentUrl: 'https://pay.test/form',
      status: 'pending',
      productKind: 'tokens',
      productId: 'p2',
    });
    tbank.initPayment.mockResolvedValue({
      Success: true,
      PaymentId: 'payment-1',
      PaymentURL: 'https://pay.test/form',
      Status: 'NEW',
    });

    await expect(
      service.initPayment('user-1', {
        productKind: 'tokens',
        productId: 'p2',
      }),
    ).resolves.toMatchObject({
      orderId: 'fr_123',
      paymentId: 'payment-1',
      paymentUrl: 'https://pay.test/form',
      status: 'pending',
      productKind: 'tokens',
      productId: 'p2',
    });

    expect(prismaClient.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
          productKind: 'tokens',
          productId: 'p2',
          amountKopecks: 49900,
          provider: 'tbank',
          status: 'pending',
        }),
      }),
    );
    expect(tbank.initPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        Amount: 49900,
        Description: 'Frendly Tokens: 350',
        PayType: 'O',
        SuccessURL: expect.stringContaining('frendly://payment/success'),
      }),
    );
  });

  it('rejects direct T-Bank subscription payment init', async () => {
    const { service, prismaClient, tbank } = makeService();

    await expect(
      service.initPayment('user-1', {
        productKind: 'subscription',
        productId: 'month',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'subscription_paid_with_tokens',
    });
    expect(prismaClient.paymentOrder.create).not.toHaveBeenCalled();
    expect(tbank.initPayment).not.toHaveBeenCalled();
  });

  it('does not check a payment order owned by another user', async () => {
    const { service, prismaClient, tbank } = makeService();
    prismaClient.paymentOrder.findUnique.mockResolvedValue({
      orderId: 'fr_123',
      userId: 'user-other',
      providerPaymentId: 'payment-1',
    });

    await expect(service.checkPayment('user-1', 'fr_123')).rejects.toMatchObject({
      statusCode: 404,
      code: 'payment_order_not_found',
    } satisfies Partial<ApiError>);
    expect(tbank.getState).not.toHaveBeenCalled();
  });

  it('confirms subscription only once for the same payment order', async () => {
    const { service, prismaClient, subscription, tokens } = makeService();
    prismaClient.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      userId: 'user-1',
      productKind: 'subscription',
      productId: 'year',
      amountKopecks: 478800,
      status: 'pending',
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      userId: 'user-1',
      productKind: 'subscription',
      productId: 'year',
      status: 'confirmed',
      providerPaymentId: 'payment-1',
      paymentUrl: 'https://pay.test/form',
    });

    await service.confirmPaymentOrder({
      orderId: 'fr_123',
      paymentId: 'payment-1',
      amountKopecks: 478800,
      rawStatus: 'CONFIRMED',
      rawNotification: { Status: 'CONFIRMED' },
    });

    expect(subscription.activatePaidSubscription).toHaveBeenCalledWith(
      'user-1',
      'year',
      'order-db-1',
      prismaClient,
    );
    expect(tokens.creditPurchasedTokens).not.toHaveBeenCalled();

    prismaClient.paymentOrder.findUnique.mockResolvedValueOnce({
      id: 'order-db-1',
      orderId: 'fr_123',
      userId: 'user-1',
      productKind: 'subscription',
      productId: 'year',
      amountKopecks: 478800,
      status: 'confirmed',
    });
    await service.confirmPaymentOrder({
      orderId: 'fr_123',
      paymentId: 'payment-1',
      amountKopecks: 478800,
      rawStatus: 'CONFIRMED',
      rawNotification: { Status: 'CONFIRMED' },
    });
    expect(subscription.activatePaidSubscription).toHaveBeenCalledTimes(1);
  });
});
