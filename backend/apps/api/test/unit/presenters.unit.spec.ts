import { mapEventSummary } from '../../src/common/presenters';

describe('presenters', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.S3_ACCESS_KEY = 'access';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'frendly-backet';
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3.twcstorage.ru';
    process.env.S3_CDN_ENDPOINT = 'https://cdn.frendly.tech';
  });

  afterEach(() => {
    for (const key of [
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_BUCKET',
      'S3_PUBLIC_ENDPOINT',
      'S3_CDN_ENDPOINT',
    ]) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('maps owned external content images to affiche proxy paths for event cards', () => {
    const summary = mapEventSummary({
      event: {
        id: 'event-1',
        title: 'Идем на концерт',
        emoji: '🎵',
        startsAt: new Date('2026-05-07T18:00:00.000Z'),
        place: 'Клуб',
        distanceKm: 1.2,
        latitude: null,
        longitude: null,
        capacity: 8,
        vibe: 'Спокойно',
        tone: 'warm',
        hostNote: null,
        lifestyle: 'neutral',
        priceMode: 'fixed',
        priceAmountFrom: 1100,
        priceAmountTo: null,
        accessMode: 'open',
        genderMode: 'all',
        visibilityMode: 'public',
        joinMode: 'open',
        hostId: 'host-1',
        sourceExternalContentItem: {
          imageUrl:
            'https://cdn.frendly.tech/external-content/advcake_ticketland/offer-1.jpg',
        },
      } as any,
      participants: [],
      currentUserId: 'user-me',
    });

    expect((summary as any).imageUrl).toBe(
      '/affiche/images?key=external-content%2Fadvcake_ticketland%2Foffer-1.jpg',
    );
  });
});
