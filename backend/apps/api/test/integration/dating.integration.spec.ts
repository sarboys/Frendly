import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { buildDirectChatKey, buildPublicAssetUrl } from '@big-break/database';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';
import { seedIntegrationTestData } from './seed-test-data';

jest.setTimeout(30000);

describe('dating api flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken = '';
  let sonyaAccessToken = '';
  let olegAccessToken = '';
  let markAccessToken = '';

  const futureIso = (daysFromNow: number, hourUtc: number, minute = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    date.setUTCHours(hourUtc, minute, 0, 0);
    return date.toISOString();
  };

  const grantPlus = (userId: string, id: string) =>
    prisma.userSubscription.create({
      data: {
        id,
        userId,
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-05-01T00:00:00.000Z'),
        renewsAt: new Date('2026-06-01T00:00:00.000Z'),
        trialEndsAt: null,
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService).client;
    await seedIntegrationTestData(prisma);

    accessToken = (
      await request(app.getHttpServer())
        .post('/auth/dev/login')
        .send({ userId: 'user-me' })
        .expect(201)
    ).body.accessToken;

    sonyaAccessToken = (
      await request(app.getHttpServer())
        .post('/auth/dev/login')
        .send({ userId: 'user-sonya' })
        .expect(201)
    ).body.accessToken;

    olegAccessToken = (
      await request(app.getHttpServer())
        .post('/auth/dev/login')
        .send({ userId: 'user-oleg' })
        .expect(201)
    ).body.accessToken;

    markAccessToken = (
      await request(app.getHttpServer())
        .post('/auth/dev/login')
        .send({ userId: 'user-mark' })
        .expect(201)
    ).body.accessToken;
  });

  beforeEach(async () => {
    await prisma.userSubscription.deleteMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya', 'user-oleg', 'user-mark'],
        },
      },
    });

    await prisma.userSettings.updateMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya', 'user-oleg', 'user-mark'],
        },
      },
      data: {
        discoverable: true,
        showAge: true,
        afterDarkAgeConfirmedAt: null,
        afterDarkCodeAcceptedAt: null,
      },
    });

    await Promise.all([
      prisma.profile.update({
        where: { userId: 'user-me' },
        data: { gender: 'male' },
      }),
      prisma.profile.update({
        where: { userId: 'user-sonya' },
        data: { gender: 'female' },
      }),
      prisma.profile.update({
        where: { userId: 'user-oleg' },
        data: { gender: 'male' },
      }),
      prisma.profile.update({
        where: { userId: 'user-mark' },
        data: { gender: 'male' },
      }),
      prisma.onboardingPreferences.update({
        where: { userId: 'user-me' },
        data: { gender: 'male' },
      }),
      prisma.onboardingPreferences.update({
        where: { userId: 'user-sonya' },
        data: { gender: 'female' },
      }),
      prisma.onboardingPreferences.update({
        where: { userId: 'user-oleg' },
        data: { gender: 'male' },
      }),
      prisma.onboardingPreferences.update({
        where: { userId: 'user-mark' },
        data: { gender: 'male' },
      }),
    ]);

    await prisma.datingAction.deleteMany({
      where: {
        OR: [
          {
            actorUserId: {
              in: ['user-me', 'user-sonya', 'user-oleg', 'user-mark'],
            },
          },
          {
            targetUserId: {
              in: ['user-me', 'user-sonya', 'user-oleg', 'user-mark'],
            },
          },
        ],
      },
    });

    const datingPairs: Array<[string, string]> = [
      ['user-me', 'user-sonya'],
      ['user-me', 'user-oleg'],
      ['user-me', 'user-mark'],
      ['user-sonya', 'user-me'],
      ['user-oleg', 'user-me'],
      ['user-mark', 'user-sonya'],
    ];

    await prisma.chat.deleteMany({
      where: {
        directKey: {
          in: datingPairs.map(([left, right]) =>
            buildDirectChatKey(left, right),
          ),
        },
        sourceEventId: null,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists discoverable dating profiles without frendly+', async () => {
    const response = await request(app.getHttpServer())
      .get('/dating/discover')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user-sonya' }),
      ]),
    );
    expect(
      response.body.items.some(
        (item: { userId: string }) => item.userId === 'user-oleg',
      ),
    ).toBe(false);
    expect(
      response.body.items.some(
        (item: { userId: string }) => item.userId === 'user-mark',
      ),
    ).toBe(false);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-sonya',
          primaryPhoto: expect.any(Object),
          photos: expect.any(Array),
        }),
      ]),
    );
  });

  it('filters discover profiles on the backend', async () => {
    const response = await request(app.getHttpServer())
      .get('/dating/discover')
      .query({
        ageMin: 26,
        ageMax: 28,
        radiusKm: 1,
        interests: 'выставки',
      })
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const userIds = response.body.items.map(
      (item: { userId: string }) => item.userId,
    );
    expect(userIds).toContain('user-anya');
    expect(userIds).not.toContain('user-sonya');
    expect(userIds).not.toContain('user-liza');
  });

  it('requires Frendly+ for incoming likes and returns them for Plus users', async () => {
    await request(app.getHttpServer())
      .post('/dating/actions')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ targetUserId: 'user-me', action: 'like' })
      .expect(201);

    const lockedResponse = await request(app.getHttpServer())
      .get('/dating/likes')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(lockedResponse.body.code).toBe('frendly_plus_required');

    await grantPlus('user-me', 'dating-plus-user-me-likes');

    const response = await request(app.getHttpServer())
      .get('/dating/likes')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user-sonya' }),
      ]),
    );
  });

  it('returns match plus direct chat after mutual like', async () => {
    await request(app.getHttpServer())
      .post('/dating/actions')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ targetUserId: 'user-me', action: 'like' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/dating/actions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ targetUserId: 'user-sonya', action: 'super_like' })
      .expect(201);

    expect(response.body.matched).toBe(true);
    expect(response.body.chatId).toEqual(expect.any(String));
    expect(response.body.peer).toEqual(
      expect.objectContaining({
        userId: 'user-sonya',
        primaryPhoto: expect.any(Object),
        photos: expect.any(Array),
      }),
    );

    const directChat = await prisma.chat.findUnique({
      where: {
        directKey: buildDirectChatKey('user-me', 'user-sonya'),
      },
    });

    expect(directChat?.id).toBe(response.body.chatId);
  });

  it('returns shared photo payload for discover and likes surfaces', async () => {
    const objectKey = `avatars/user-sonya/dating-photo-${Date.now()}.png`;

    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: 'user-sonya',
        kind: 'avatar',
        status: 'ready',
        bucket: process.env.S3_BUCKET ?? 'big-break',
        objectKey,
        mimeType: 'image/png',
        byteSize: 1024,
        originalFileName: 'dating-photo.png',
        publicUrl: buildPublicAssetUrl(objectKey),
      } as any,
    });

    const photo = await prisma.profilePhoto.create({
      data: {
        profileUserId: 'user-sonya',
        mediaAssetId: asset.id,
        sortOrder: 0,
      },
    });

    try {
      const discoverResponse = await request(app.getHttpServer())
        .get('/dating/discover')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      const sonyaProfile = discoverResponse.body.items.find(
        (item: { userId: string }) => item.userId === 'user-sonya',
      );

      expect(sonyaProfile).toMatchObject({
        userId: 'user-sonya',
        avatarUrl: expect.any(String),
        primaryPhoto: expect.objectContaining({
          url: expect.any(String),
          media: expect.objectContaining({
            visibility: 'public',
            url: expect.any(String),
          }),
        }),
      });
      expect(sonyaProfile.photos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: photo.id,
            media: expect.objectContaining({
              visibility: 'public',
            }),
          }),
        ]),
      );

      await request(app.getHttpServer())
        .post('/dating/actions')
        .set('authorization', `Bearer ${sonyaAccessToken}`)
        .send({ targetUserId: 'user-me', action: 'like' })
        .expect(201);

      await grantPlus('user-me', 'dating-plus-user-me-photo-likes');

      const likesResponse = await request(app.getHttpServer())
        .get('/dating/likes')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      const sonyaLike = likesResponse.body.items.find(
        (item: { userId: string }) => item.userId === 'user-sonya',
      );
      expect(sonyaLike?.primaryPhoto?.media?.visibility).toBe('public');
    } finally {
      await prisma.profilePhoto.deleteMany({
        where: { id: photo.id },
      });
      await prisma.mediaAsset.deleteMany({
        where: { id: asset.id },
      });
    }
  });

  it('creates dating mode event without frendly+', async () => {
    const directChatResponse = await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${markAccessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${markAccessToken}`)
      .send({
        mode: 'dating',
        title: 'Свидание без подписки',
        description: 'Не должно пройти',
        emoji: '💘',
        vibe: 'Свидание',
        place: 'Покровка 7',
        startsAt: futureIso(1, 18, 30),
        capacity: 8,
        priceMode: 'host_pays',
        inviteeUserId: 'user-sonya',
        sourceChatId: directChatResponse.body.id,
      })
      .expect(201);

    const event = await prisma.event.findUnique({
      where: { id: response.body.id },
    });

    expect(event?.isDate).toBe(true);
    expect(event?.capacity).toBe(2);
  });

  it('requires source chat before creating a dating event', async () => {
    await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${markAccessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${markAccessToken}`)
      .send({
        mode: 'dating',
        title: 'Свидание вне чата',
        description: 'Нельзя создать без личного чата',
        emoji: '💘',
        vibe: 'Свидание',
        place: 'Покровка 7',
        startsAt: futureIso(1, 18, 30),
        capacity: 2,
        priceMode: 'host_pays',
        inviteeUserId: 'user-sonya',
      })
      .expect(403);

    expect(response.body.code).toBe('dating_direct_chat_required');
  });

  it('normalizes dating mode event fields on create', async () => {
    const directChatResponse = await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        mode: 'dating',
        title: 'Ужин на двоих',
        description: 'Тестируем нормализацию свидания',
        emoji: '💘',
        vibe: 'Шумно',
        place: 'Покровка 7',
        startsAt: futureIso(1, 18, 30),
        capacity: 8,
        visibilityMode: 'public',
        accessMode: 'open',
        joinMode: 'open',
        priceMode: 'host_pays',
        inviteeUserId: 'user-sonya',
        sourceChatId: directChatResponse.body.id,
      })
      .expect(201);

    const event = await prisma.event.findUnique({
      where: { id: response.body.id },
    });

    expect(event?.isDate).toBe(true);
    expect(event?.capacity).toBe(2);
    expect(event?.visibilityMode).toBe('friends');
    expect(event?.accessMode).toBe('request');
    expect(event?.joinMode).toBe('request');
    expect(event?.priceMode).toBe('host_pays');
    expect(event?.vibe).toBe('Свидание');
  });

  it('keeps dating event hidden from invitee until invite is accepted', async () => {
    const directChatResponse = await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        mode: 'dating',
        title: 'Закрытое свидание',
        description: 'Видно только после принятия',
        emoji: '💘',
        vibe: 'Свидание',
        place: 'Покровка 7',
        startsAt: futureIso(1, 18, 30),
        capacity: 2,
        priceMode: 'host_pays',
        inviteeUserId: 'user-sonya',
        sourceChatId: directChatResponse.body.id,
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(404);

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);

    const inviteNotification = notificationsResponse.body.items.find(
      (item: { payload?: { invite?: boolean; eventId?: string } }) =>
        item.payload?.invite === true && item.payload?.eventId === eventId,
    );

    expect(inviteNotification).toBeDefined();

    await request(app.getHttpServer())
      .post(
        `/events/${eventId}/invites/${inviteNotification.payload.requestId}/accept`,
      )
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);
  });

  it('cancels dating event and hides meetup chat when invite is declined', async () => {
    const directChatResponse = await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        mode: 'dating',
        title: 'Свидание с отказом',
        description: 'После отказа встреча должна исчезнуть',
        emoji: '💘',
        vibe: 'Свидание',
        place: 'Покровка 7',
        startsAt: futureIso(1, 18, 30),
        capacity: 2,
        priceMode: 'host_pays',
        inviteeUserId: 'user-sonya',
        sourceChatId: directChatResponse.body.id,
      })
      .expect(201);

    const eventId = createResponse.body.id as string;
    const meetupChatId = createResponse.body.chatId as string;

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);

    const inviteNotification = notificationsResponse.body.items.find(
      (item: { payload?: { invite?: boolean; eventId?: string } }) =>
        item.payload?.invite === true && item.payload?.eventId === eventId,
    );

    expect(inviteNotification).toBeDefined();

    await request(app.getHttpServer())
      .post(
        `/events/${eventId}/invites/${inviteNotification.payload.requestId}/decline`,
      )
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(201);

    const canceledEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { canceledAt: true, cancelReason: true },
    });
    expect(canceledEvent?.canceledAt).toBeInstanceOf(Date);
    expect(canceledEvent?.cancelReason).toBe('dating_invite_declined');

    await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(404);

    const hostEventsResponse = await request(app.getHttpServer())
      .get('/events?limit=20')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      hostEventsResponse.body.items.some(
        (item: { id: string }) => item.id === eventId,
      ),
    ).toBe(false);

    const hostChatsResponse = await request(app.getHttpServer())
      .get('/chats/meetups?limit=20')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      hostChatsResponse.body.items.some(
        (item: { id: string }) => item.id === meetupChatId,
      ),
    ).toBe(false);
  });

  it('blocks after dark mode event creation without unlocked access', async () => {
    await prisma.userSubscription.create({
      data: {
        id: 'after-dark-sub-sonya',
        userId: 'user-sonya',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({
        mode: 'afterdark',
        title: 'Ночная встреча без unlock',
        description: 'Не должно пройти',
        emoji: '🖤',
        vibe: 'Шумно',
        place: 'Секретный адрес',
        startsAt: futureIso(1, 21, 30),
        capacity: 8,
        afterDarkCategory: 'dating',
        afterDarkGlow: 'magenta',
        consentRequired: true,
        rules: ['Только consent-first'],
      })
      .expect(403);

    expect(response.body.code).toBe('after_dark_locked');
  });

  it('creates after dark event via events endpoint and exposes it only in after dark feed', async () => {
    await prisma.userSubscription.create({
      data: {
        id: 'after-dark-sub-sonya',
        userId: 'user-sonya',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
      },
    });

    await prisma.userSettings.update({
      where: { userId: 'user-sonya' },
      data: {
        afterDarkAgeConfirmedAt: new Date('2026-04-18T08:00:00.000Z'),
        afterDarkCodeAcceptedAt: new Date('2026-04-18T08:05:00.000Z'),
      },
    });

    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({
        mode: 'afterdark',
        title: 'Private Night Session',
        description: 'Тестовый after dark event',
        emoji: '🖤',
        vibe: 'Шумно',
        place: 'Секретный адрес',
        startsAt: futureIso(1, 21, 30),
        capacity: 10,
        afterDarkCategory: 'dating',
        afterDarkGlow: 'magenta',
        dressCode: 'Black',
        ageRange: '25-36',
        ratioLabel: 'Balanced',
        consentRequired: true,
        rules: ['Consent-first', 'No photo'],
      })
      .expect(201);

    const created = await prisma.event.findUnique({
      where: { id: createResponse.body.id },
    });

    expect(created?.isAfterDark).toBe(true);
    expect(created?.joinMode).toBe('request');
    expect(created?.afterDarkCategory).toBe('dating');
    expect(created?.consentRequired).toBe(true);

    const dayFeed = await request(app.getHttpServer())
      .get('/events?filter=nearby')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);

    expect(
      dayFeed.body.items.some(
        (item: { id: string }) => item.id === createResponse.body.id,
      ),
    ).toBe(false);

    const afterDarkFeed = await request(app.getHttpServer())
      .get('/after-dark/events')
      .query({ limit: 50 })
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);

    expect(
      afterDarkFeed.body.items.some(
        (item: { id: string }) => item.id === createResponse.body.id,
      ),
    ).toBe(true);
  });
});
