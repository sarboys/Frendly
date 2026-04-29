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
});
