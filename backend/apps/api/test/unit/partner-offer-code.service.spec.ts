import {
  PartnerOfferCodeService,
  computeOfferCodeExpiresAt,
} from '../../src/services/partner-offer-code.service';

describe('PartnerOfferCodeService unit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PARTNER_OFFER_CODE_SECRET: 'test-offer-code-secret',
      PUBLIC_SITE_URL: 'https://frendly.tech',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('computes Moscow expiration at next local day 06:00', () => {
    expect(
      computeOfferCodeExpiresAt({
        startsAt: new Date('2026-05-10T16:00:00.000Z'),
        timezone: 'Europe/Moscow',
      }).toISOString(),
    ).toBe('2026-05-11T03:00:00.000Z');
  });

  it('returns the same issued code row for repeated issue', async () => {
    let issuedRow: any = null;
    const session = {
      id: 'session-1',
      routeId: 'route-1',
      routeTemplateId: 'template-1',
      hostUserId: 'user-1',
      startsAt: new Date('2026-05-10T16:00:00.000Z'),
      participants: [],
      route: {
        timezone: 'Europe/Moscow',
      },
    };
    const step = {
      id: 'step-1',
      routeId: 'route-1',
      partnerOfferId: 'offer-1',
      offerTitleSnapshot: 'Бокал в подарок',
      venueNameSnapshot: 'Brix Wine',
      partnerOffer: {
        id: 'offer-1',
        partnerId: 'partner-1',
        venueId: 'venue-1',
        title: 'Бокал в подарок',
        partner: { name: 'Brix' },
        venue: { name: 'Brix Wine' },
      },
    };
    const findUnique = jest.fn(async (args: any) => {
      if (args.where?.userId_sessionId_partnerId_stepId_offerId) {
        return issuedRow;
      }
      if (args.where?.id === issuedRow?.id) {
        return issuedRow;
      }
      return null;
    });
    const create = jest.fn(async (args: any) => {
      issuedRow = {
        ...args.data,
        offer: { title: step.partnerOffer.title },
        venue: { name: step.partnerOffer.venue.name },
        partner: { name: step.partnerOffer.partner.name },
        step: {
          offerTitleSnapshot: step.offerTitleSnapshot,
          venueNameSnapshot: step.venueNameSnapshot,
        },
        activatedAt: null,
      };
      return issuedRow;
    });
    const service = new PartnerOfferCodeService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue(session),
          },
          eveningRouteStep: {
            findFirst: jest.fn().mockResolvedValue(step),
          },
          partnerOfferCode: {
            findUnique,
            findFirst: jest.fn(),
            create,
            updateMany: jest.fn(),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    const first = await service.issueCode(
      'user-1',
      'session-1',
      'step-1',
      'offer-1',
    );
    const second = await service.issueCode(
      'user-1',
      'session-1',
      'step-1',
      'offer-1',
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
    expect(second.codeUrl).toBe(first.codeUrl);
    expect(second.status).toBe('issued');
  });

  it('requires session membership when issuing a code', async () => {
    const service = new PartnerOfferCodeService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'session-1',
              routeId: 'route-1',
              routeTemplateId: null,
              hostUserId: 'host-1',
              startsAt: new Date('2026-05-10T16:00:00.000Z'),
              participants: [],
              route: { timezone: 'Europe/Moscow' },
            }),
          },
          eveningRouteStep: {
            findFirst: jest.fn(),
          },
          partnerOfferCode: {
            findUnique: jest.fn(),
            create: jest.fn(),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    await expect(
      service.issueCode('user-1', 'session-1', 'step-1', 'offer-1'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'evening_session_membership_required',
    });
  });

  it('requires the offer to belong to the route step snapshot', async () => {
    const service = new PartnerOfferCodeService(
      {
        client: {
          eveningSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'session-1',
              routeId: 'route-1',
              routeTemplateId: null,
              hostUserId: 'user-1',
              startsAt: new Date('2026-05-10T16:00:00.000Z'),
              participants: [],
              route: { timezone: 'Europe/Moscow' },
            }),
          },
          eveningRouteStep: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'step-1',
              routeId: 'route-1',
              partnerOfferId: 'offer-other',
              partnerOffer: null,
            }),
          },
          partnerOfferCode: {
            findUnique: jest.fn(),
            create: jest.fn(),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    await expect(
      service.issueCode('user-1', 'session-1', 'step-1', 'offer-1'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'partner_offer_not_found',
    });
  });

  it('activates a valid public code without exposing user data', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new PartnerOfferCodeService(
      {
        client: {
          partnerOfferCode: {
            findUnique: jest.fn().mockResolvedValue(
              codeRecord({
                status: 'issued',
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
              }),
            ),
            updateMany,
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    const result = await service.activateCode('VALIDCODE12345', {
      ip: '203.0.113.10',
      userAgent: 'Frendly Partner Scanner',
    });

    expect(result).toEqual({
      status: 'activated',
      offerTitle: 'Бокал в подарок',
      venueName: 'Brix Wine',
      partnerName: 'Brix',
      activatedAt: expect.any(String),
    });
    expect(result).not.toHaveProperty('userId');
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'code-1',
        status: 'issued',
        activatedAt: null,
      },
      data: {
        status: 'activated',
        activatedAt: expect.any(Date),
        activatedIpHash: expect.any(String),
        activatedUserAgent: 'Frendly Partner Scanner',
      },
    });
  });

  it('returns already activated for a used public code', async () => {
    const activatedAt = new Date('2026-05-10T18:00:00.000Z');
    const service = new PartnerOfferCodeService(
      {
        client: {
          partnerOfferCode: {
            findUnique: jest.fn().mockResolvedValue(
              codeRecord({
                status: 'activated',
                activatedAt,
              }),
            ),
            updateMany: jest.fn(),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    await expect(service.activateCode('VALIDCODE12345')).resolves.toMatchObject({
      status: 'already_activated',
      activatedAt: activatedAt.toISOString(),
      offerTitle: 'Бокал в подарок',
    });
  });

  it('returns expired for an expired public code', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new PartnerOfferCodeService(
      {
        client: {
          partnerOfferCode: {
            findUnique: jest.fn().mockResolvedValue(
              codeRecord({
                status: 'issued',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
              }),
            ),
            updateMany,
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    await expect(service.activateCode('VALIDCODE12345')).resolves.toMatchObject({
      status: 'expired',
      offerTitle: 'Бокал в подарок',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'code-1',
        status: 'issued',
        activatedAt: null,
      },
      data: {
        status: 'expired',
      },
    });
  });

  it('returns not found for an unknown public code', async () => {
    const service = new PartnerOfferCodeService(
      {
        client: {
          partnerOfferCode: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        },
      } as any,
      { track: jest.fn() } as any,
    );

    await expect(service.activateCode('UNKNOWN123456')).resolves.toEqual({
      status: 'not_found',
      offerTitle: null,
      venueName: null,
      partnerName: null,
      activatedAt: null,
    });
  });

  it('rate limits repeated public activation attempts from the same ip', async () => {
    const service = new PartnerOfferCodeService(
      {
        client: {
          partnerOfferCode: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        },
      } as any,
      { track: jest.fn() } as any,
      {
        now: () => new Date('2026-05-10T10:00:00.000Z'),
        maxActivationAttemptsPerWindow: 2,
        activationWindowMs: 60_000,
      },
    );

    await expect(service.activateCode('UNKNOWN111111', { ip: '203.0.113.10' })).resolves.toMatchObject({
      status: 'not_found',
    });
    await expect(service.activateCode('UNKNOWN222222', { ip: '203.0.113.10' })).resolves.toMatchObject({
      status: 'not_found',
    });
    await expect(
      service.activateCode('UNKNOWN333333', { ip: '203.0.113.10' }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'partner_offer_code_rate_limited',
    });
  });
});

function codeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'code-1',
    codeHash: 'hash-1',
    userId: 'user-1',
    sessionId: 'session-1',
    routeId: 'route-1',
    routeTemplateId: 'template-1',
    stepId: 'step-1',
    partnerId: 'partner-1',
    venueId: 'venue-1',
    offerId: 'offer-1',
    status: 'issued',
    issuedAt: new Date('2026-05-10T16:00:00.000Z'),
    activatedAt: null,
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    offer: { title: 'Бокал в подарок' },
    venue: { name: 'Brix Wine' },
    partner: { name: 'Brix' },
    step: {
      offerTitleSnapshot: 'Бокал в подарок',
      venueNameSnapshot: 'Brix Wine',
    },
    ...overrides,
  };
}
