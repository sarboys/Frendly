import { CheckoutService } from '../../src/services/checkout.service';

describe('CheckoutService unit', () => {
  const makeService = (overrides: any = {}) => {
    const prismaClient: any = {
      user: {
        findUnique: jest.fn(),
      },
      ...overrides.prismaClient,
    };
    const payments: any = {
      getCatalog: jest.fn(),
      initCheckoutPayment: jest.fn(),
      checkPayment: jest.fn(),
      ...overrides.payments,
    };
    const subscription: any = {
      getCurrent: jest.fn(),
      ...overrides.subscription,
    };
    const dating: any = {
      getLimits: jest.fn(),
      ...overrides.dating,
    };
    const redisCache: any = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      ...overrides.redisCache,
    };
    const service = new CheckoutService(
      { client: prismaClient } as any,
      payments as any,
      subscription as any,
      dating as any,
      redisCache as any,
    );
    return { service, prismaClient, payments, subscription, dating, redisCache };
  };

  afterEach(() => {
    delete process.env.CHECKOUT_PUBLIC_URL;
    jest.restoreAllMocks();
  });

  it('creates short-lived checkout sessions without user contact in the URL', async () => {
    process.env.CHECKOUT_PUBLIC_URL = 'https://frendly.test';
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-06-05T10:00:00.000Z').getTime());
    const { service, redisCache } = makeService();

    const session = await service.createSession('user-1', {
      source: 'dating_swipe_limit',
      returnTo: '/dating',
    });

    expect(session.checkoutUrl).toMatch(/^https:\/\/frendly\.test\/checkout\/[A-Za-z0-9_-]+$/);
    expect(session.checkoutUrl).not.toContain('user-1');
    expect(session.expiresAt).toBe('2026-06-05T10:15:00.000Z');
    expect(redisCache.setJson).toHaveBeenCalledWith(
      expect.stringContaining('checkout:session:v1:'),
      expect.objectContaining({
        userId: 'user-1',
        source: 'dating_swipe_limit',
        returnTo: '/dating',
        expiresAt: '2026-06-05T10:15:00.000Z',
      }),
      900,
    );
  });

  it('returns public checkout data with contact, catalog and dating limits', async () => {
    const { service, prismaClient, payments, subscription, dating, redisCache } =
      makeService();
    redisCache.getJson.mockResolvedValue({
      userId: 'user-1',
      source: 'dating_swipe_limit',
      returnTo: '/dating',
      expiresAt: '2026-06-05T10:15:00.000Z',
    });
    prismaClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      displayName: 'Ира',
      email: 'ira@test.dev',
      phoneNumber: '+79990000000',
    });
    payments.getCatalog.mockResolvedValue({ subscriptions: [], tokenPacks: [] });
    subscription.getCurrent.mockResolvedValue({ status: 'inactive', plan: null });
    dating.getLimits.mockResolvedValue({
      premium: false,
      hourlySwipes: { remaining: 0 },
    });

    await expect(service.getPublicSession('token-1')).resolves.toEqual({
      token: 'token-1',
      source: 'dating_swipe_limit',
      returnTo: '/dating',
      expiresAt: '2026-06-05T10:15:00.000Z',
      user: {
        displayName: 'Ира',
        email: 'ira@test.dev',
        phoneNumber: '+79990000000',
      },
      catalog: { subscriptions: [], tokenPacks: [] },
      subscription: { status: 'inactive', plan: null },
      datingLimits: {
        premium: false,
        hourlySwipes: { remaining: 0 },
      },
      appReturnUrl:
        'frendly://payment/success?checkoutToken=token-1&returnTo=%2Fdating',
    });
  });

  it('starts checkout payment for the session owner', async () => {
    const { service, payments, redisCache } = makeService();
    redisCache.getJson.mockResolvedValue({
      userId: 'user-1',
      source: 'dating_swipe_limit',
      returnTo: '/dating',
      expiresAt: '2026-06-05T10:15:00.000Z',
    });
    payments.initCheckoutPayment.mockResolvedValue({
      orderId: 'fr_123',
      paymentUrl: 'https://pay.test/form',
    });

    await expect(
      service.initPayment('token-1', {
        productKind: 'subscription',
        productId: 'month',
      }),
    ).resolves.toEqual({
      orderId: 'fr_123',
      paymentUrl: 'https://pay.test/form',
    });
    expect(payments.initCheckoutPayment).toHaveBeenCalledWith('user-1', {
      productKind: 'subscription',
      productId: 'month',
      checkoutToken: 'token-1',
    });
  });
});
