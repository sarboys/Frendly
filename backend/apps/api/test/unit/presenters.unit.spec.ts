import {
  mapEventSummary,
  mapMessage,
  mapProfilePhoto,
} from '../../src/common/presenters';

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

  it('maps owned external content images to API proxy paths for event cards', () => {
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

  it('maps profile photo media variants to proxy urls', () => {
    const photo = mapProfilePhoto({
      id: 'photo-1',
      sortOrder: 0,
      mediaAsset: {
        id: 'asset-1',
        kind: 'avatar',
        mimeType: 'image/jpeg',
        byteSize: 2048,
        durationMs: null,
        publicUrl: 'https://cdn.frendly.tech/avatars/user-me/photo.jpg',
        variants: {
          avatar: {
            url: '/media/asset-1/variants/avatar',
            downloadUrl: '/media/asset-1/variants/avatar',
            mimeType: 'image/webp',
            byteSize: 4200,
            cacheKey: 'media-asset-1-avatar',
          },
          card: {
            url: '/media/asset-1/variants/card',
            downloadUrl: '/media/asset-1/variants/card',
            mimeType: 'image/webp',
            byteSize: 18000,
            cacheKey: 'media-asset-1-card',
          },
        },
      },
    } as any);

    expect((photo as any).media.variants.avatar).toMatchObject({
      url: '/media/asset-1/variants/avatar',
      downloadUrl: '/media/asset-1/variants/avatar',
      mimeType: 'image/webp',
      byteSize: 4200,
      cacheKey: 'media-asset-1-avatar',
    });
    expect((photo as any).variants.card.url).toBe(
      '/media/asset-1/variants/card',
    );
  });

  it('maps chat sender avatar variants from primary profile photo', () => {
    const message = mapMessage({
      id: 'message-1',
      chatId: 'chat-1',
      senderId: 'user-anya',
      sender: {
        displayName: 'Аня',
        profile: {
          avatarUrl: '/media/legacy-avatar',
          photos: [
            {
              id: 'photo-1',
              sortOrder: 0,
              mediaAsset: {
                id: 'asset-1',
                kind: 'avatar',
                mimeType: 'image/jpeg',
                byteSize: 2048,
                durationMs: null,
                publicUrl: 'https://cdn.frendly.tech/avatars/user/photo.jpg',
                variants: {
                  avatar: {
                    url: 'https://cdn.frendly.tech/avatars/user/photo__avatar.webp',
                    downloadUrl:
                      'https://cdn.frendly.tech/avatars/user/photo__avatar.webp',
                    mimeType: 'image/webp',
                    byteSize: 4200,
                  },
                },
              },
            },
          ],
        },
      },
      text: 'Привет',
      clientMessageId: 'client-1',
      createdAt: new Date('2026-05-08T10:00:00.000Z'),
      replyTo: null,
      attachments: [],
    } as any);

    expect((message as any).senderAvatarUrl).toBe('/media/asset-1');
    expect((message as any).senderAvatarVariants.avatar.url).toBe(
      'https://cdn.frendly.tech/avatars/user/photo__avatar.webp',
    );
  });
});
