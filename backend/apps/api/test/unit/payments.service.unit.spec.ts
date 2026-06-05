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
      hasPremiumAccess: jest.fn().mockResolvedValue(false),
      getPlusBenefitRules: jest.fn().mockResolvedValue({
        tokenPurchaseDiscountPercent: 15,
      }),
      getCatalog: jest.fn().mockResolvedValue({
        plans: [
          {
            id: 'month',
            label: 'Месячный',
            description: 'Frendly+ на месяц',
            priceRub: 799,
            priceMonthlyRub: 799,
            tokenCost: 799,
            tokenMonthlyCost: 799,
            trialDays: 0,
            durationDays: 30,
            badge: null,
            benefits: [],
          },
          {
            id: 'quarter',
            label: '3 месяца',
            description: 'Frendly+ на 3 месяца',
            priceRub: 1797,
            priceMonthlyRub: 599,
            tokenCost: 1797,
            tokenMonthlyCost: 599,
            trialDays: 0,
            durationDays: 90,
            badge: '-25%',
            benefits: [],
          },
          {
            id: 'year',
            label: 'Годовой',
            description: 'Frendly+ на год',
            priceRub: 4788,
            priceMonthlyRub: 399,
            tokenCost: 4788,
            tokenMonthlyCost: 399,
            trialDays: 0,
            durationDays: 365,
            badge: '-50%',
            benefits: [],
          },
        ],
        plusBenefits: [],
        tokenPacks: [
          {
            id: 'p1',
            label: 'Базовый',
            description: 'Frendly Tokens: 100',
            priceRub: 199,
            tokens: 100,
            bonus: 0,
            best: false,
            active: true,
            sortOrder: 10,
          },
          {
            id: 'p2',
            label: 'Популярный',
            description: 'Frendly Tokens: 350',
            priceRub: 499,
            tokens: 350,
            bonus: 0,
            best: true,
            active: true,
            sortOrder: 20,
          },
        ],
      }),
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
      overrides.redisCache,
      overrides.appleIap,
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
          productSnapshot: expect.objectContaining({
            id: 'p2',
            label: 'Популярный',
            priceRub: 499,
            amountKopecks: 49900,
            tokens: 350,
            bonus: 0,
          }),
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

  it('uses active database token packs in payment catalog', async () => {
    const { service } = makeService({
      subscription: {
        getCatalog: jest.fn().mockResolvedValue({
          plans: [],
          plusBenefits: [],
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
        }),
      },
    });

    await expect(service.getCatalog('user-free')).resolves.toMatchObject({
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
  });

  it('returns editable subscription catalog in payments catalog', async () => {
    const { service, tbank, subscription } = makeService({
      tbank: {
        isEnabled: jest.fn().mockReturnValue(false),
      },
      subscription: {
        getCatalog: jest.fn().mockResolvedValue({
          plans: [
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
          ],
          plusBenefits: ['Больше встреч'],
        }),
      },
    });

    await expect(service.getCatalog('user-free')).resolves.toMatchObject({
      tbankEnabled: false,
      provider: null,
      subscriptions: [
        {
          id: 'half-year',
          productKind: 'subscription',
          tokenCost: 2994,
          tokenMonthlyCost: 499,
          durationDays: 180,
          benefits: ['Приоритет в радаре'],
        },
      ],
      plusBenefits: ['Больше встреч'],
    });
    expect(tbank.isEnabled).toHaveBeenCalled();
    expect(subscription.getCatalog).toHaveBeenCalled();
  });

  it('returns App Store product id for the quarter subscription', async () => {
    const { service } = makeService();

    await expect(service.getCatalog('user-free')).resolves.toMatchObject({
      subscriptions: expect.arrayContaining([
        expect.objectContaining({
          id: 'quarter',
          productKind: 'subscription',
          appleProductId: 'frendly.plus.quarter',
          tokenCost: 1797,
          tokenMonthlyCost: 599,
          durationDays: 90,
        }),
      ]),
    });
  });

  it('returns discounted token packs for Frendly Plus users', async () => {
    const { service } = makeService({
      subscription: {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
        getPlusBenefitRules: jest.fn().mockResolvedValue({
          tokenPurchaseDiscountPercent: 15,
        }),
      },
    });

    await expect(service.getCatalog('user-plus')).resolves.toMatchObject({
      tokenPacks: expect.arrayContaining([
        expect.objectContaining({
          id: 'p1',
          priceRub: 169,
          originalPriceRub: 199,
          discountPercent: 15,
        }),
      ]),
    });
  });

  it('uses discounted T-Bank amount for Frendly Plus token payment', async () => {
    process.env.PAYMENTS_TBANK_ENABLED = 'true';
    process.env.PUBLIC_API_URL = 'https://api.test';
    process.env.APP_DEEP_LINK_SCHEME = 'frendly';

    const { service, prismaClient, tbank } = makeService({
      subscription: {
        hasPremiumAccess: jest.fn().mockResolvedValue(true),
        getPlusBenefitRules: jest.fn().mockResolvedValue({
          tokenPurchaseDiscountPercent: 15,
        }),
      },
    });
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: null,
      phoneNumber: '+79990000000',
    });
    prismaClient.paymentOrder.create.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      amountKopecks: 16900,
      productKind: 'tokens',
      productId: 'p1',
      status: 'pending',
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      orderId: 'fr_123',
      providerPaymentId: 'payment-1',
      paymentUrl: 'https://pay.test/form',
      status: 'pending',
      productKind: 'tokens',
      productId: 'p1',
    });
    tbank.initPayment.mockResolvedValue({
      Success: true,
      PaymentId: 'payment-1',
      PaymentURL: 'https://pay.test/form',
      Status: 'NEW',
    });

    await service.initPayment('user-1', {
      productKind: 'tokens',
      productId: 'p1',
    });

    expect(prismaClient.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountKopecks: 16900,
          productSnapshot: expect.objectContaining({
            id: 'p1',
            originalPriceRub: 199,
            discountPercent: 15,
            amountKopecks: 16900,
            tokens: 100,
          }),
        }),
      }),
    );
    expect(tbank.initPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        Amount: 16900,
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

  it('allows checkout T-Bank subscription payment init with landing return URLs', async () => {
    process.env.PAYMENTS_TBANK_ENABLED = 'true';
    process.env.PUBLIC_API_URL = 'https://api.test';

    const { service, prismaClient, tbank } = makeService();
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.dev',
      phoneNumber: '+79990000000',
    });
    prismaClient.paymentOrder.create.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_sub_1',
      amountKopecks: 79900,
      productKind: 'subscription',
      productId: 'month',
      status: 'pending',
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      orderId: 'fr_sub_1',
      providerPaymentId: 'payment-sub-1',
      paymentUrl: 'https://pay.test/subscription',
      status: 'pending',
      productKind: 'subscription',
      productId: 'month',
    });
    tbank.initPayment.mockResolvedValue({
      Success: true,
      PaymentId: 'payment-sub-1',
      PaymentURL: 'https://pay.test/subscription',
      Status: 'NEW',
    });

    await expect(
      service.initCheckoutPayment('user-1', {
        productKind: 'subscription',
        productId: 'month',
        checkoutToken: 'checkout-token',
      }),
    ).resolves.toMatchObject({
      orderId: 'fr_sub_1',
      paymentId: 'payment-sub-1',
      paymentUrl: 'https://pay.test/subscription',
      status: 'pending',
      productKind: 'subscription',
      productId: 'month',
    });

    expect(prismaClient.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          productKind: 'subscription',
          productId: 'month',
          amountKopecks: 79900,
        }),
      }),
    );
    expect(tbank.initPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        Amount: 79900,
        Description: 'Frendly+ на месяц',
        SuccessURL: expect.stringContaining('/checkout/checkout-token/payment/success'),
        FailURL: expect.stringContaining('/checkout/checkout-token/payment/fail'),
      }),
    );
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
      productSnapshot: null,
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

  it('confirms token payment using the stored product snapshot', async () => {
    const { service, prismaClient, subscription, tokens } = makeService();
    const snapshot = {
      id: 'p-custom',
      label: 'Свой',
      priceRub: 599,
      amountKopecks: 59900,
      tokens: 500,
      bonus: 25,
    };
    prismaClient.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      userId: 'user-1',
      productKind: 'tokens',
      productId: 'p-custom',
      amountKopecks: 59900,
      status: 'pending',
      productSnapshot: snapshot,
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'fr_123',
      userId: 'user-1',
      productKind: 'tokens',
      productId: 'p-custom',
      status: 'confirmed',
      providerPaymentId: 'payment-1',
      paymentUrl: 'https://pay.test/form',
      productSnapshot: snapshot,
    });

    await service.confirmPaymentOrder({
      orderId: 'fr_123',
      paymentId: 'payment-1',
      amountKopecks: 59900,
      rawStatus: 'CONFIRMED',
      rawNotification: { Status: 'CONFIRMED' },
    });

    expect(tokens.creditPurchasedTokens).toHaveBeenCalledWith(
      'user-1',
      {
        packId: 'p-custom',
        tokens: 500,
        bonus: 25,
      },
      'order-db-1',
      prismaClient,
    );
    expect(subscription.activatePaidSubscription).not.toHaveBeenCalled();
  });

  it('confirms Apple token purchase and credits tokens once', async () => {
    const appleIap = {
      verifyTransaction: jest.fn().mockResolvedValue({
        transactionId: 'tx-1',
        productId: 'frendly.tokens.p2',
        environment: 'Sandbox',
        raw: { transactionId: 'tx-1', productId: 'frendly.tokens.p2' },
      }),
    };
    const { service, prismaClient, tokens, subscription } = makeService({
      appleIap,
    });
    prismaClient.paymentOrder.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'order-db-1',
        orderId: 'apple_tx-1',
        userId: 'user-1',
        provider: 'apple',
        providerPaymentId: 'tx-1',
        productKind: 'tokens',
        productId: 'p2',
        amountKopecks: 49900,
        status: 'pending',
        productSnapshot: {
          id: 'p2',
          tokens: 350,
          bonus: 0,
        },
      });
    prismaClient.paymentOrder.create.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'apple_tx-1',
      userId: 'user-1',
      provider: 'apple',
      providerPaymentId: 'tx-1',
      productKind: 'tokens',
      productId: 'p2',
      amountKopecks: 49900,
      status: 'pending',
      productSnapshot: {
        id: 'p2',
        tokens: 350,
        bonus: 0,
      },
    });
    prismaClient.paymentOrder.update.mockResolvedValue({
      id: 'order-db-1',
      orderId: 'apple_tx-1',
      userId: 'user-1',
      provider: 'apple',
      providerPaymentId: 'tx-1',
      productKind: 'tokens',
      productId: 'p2',
      amountKopecks: 49900,
      status: 'confirmed',
      productSnapshot: {
        id: 'p2',
        tokens: 350,
        bonus: 0,
      },
    });

    await service.confirmApplePurchase('user-1', {
      productKind: 'tokens',
      productId: 'p2',
      appleProductId: 'frendly.tokens.p2',
      transactionId: 'tx-1',
      verificationData: 'signed-transaction',
    });

    expect(appleIap.verifyTransaction).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      verificationData: 'signed-transaction',
    });
    expect(prismaClient.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          provider: 'apple',
          providerPaymentId: 'tx-1',
          productKind: 'tokens',
          productId: 'p2',
          amountKopecks: 49900,
        }),
      }),
    );
    expect(tokens.creditPurchasedTokens).toHaveBeenCalledWith(
      'user-1',
      {
        packId: 'p2',
        tokens: 350,
        bonus: 0,
      },
      'order-db-1',
      prismaClient,
    );
    expect(subscription.activatePaidSubscription).not.toHaveBeenCalled();
  });

  it('rejects Apple purchase when transaction product id does not match catalog', async () => {
    const appleIap = {
      verifyTransaction: jest.fn().mockResolvedValue({
        transactionId: 'tx-1',
        productId: 'frendly.tokens.p1',
        environment: 'Sandbox',
        raw: { transactionId: 'tx-1', productId: 'frendly.tokens.p1' },
      }),
    };
    const { service, prismaClient } = makeService({ appleIap });

    await expect(
      service.confirmApplePurchase('user-1', {
        productKind: 'tokens',
        productId: 'p2',
        appleProductId: 'frendly.tokens.p2',
        transactionId: 'tx-1',
        verificationData: 'signed-transaction',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'apple_iap_product_mismatch',
    });
    expect(prismaClient.paymentOrder.create).not.toHaveBeenCalled();
  });
});
