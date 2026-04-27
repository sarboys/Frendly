import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { buildDirectChatKey, buildPublicAssetUrl } from '@big-break/database';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService).client;

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
    ];

    await prisma.chat.deleteMany({
      where: {
        directKey: {
          in: datingPairs.map(([left, right]) => buildDirectChatKey(left, right)),
        },
        sourceEventId: null,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires active frendly+ for dating discover', async () => {
    const response = await request(app.getHttpServer())
      .get('/dating/discover')
      .set('authorization', `Bearer ${markAccessToken}`)
      .expect(403);

    expect(response.body.code).toBe('dating_locked');
  });

  it('lists only discoverable premium profiles in dating discover', async () => {
    await prisma.userSubscription.createMany({
      data: [
        {
          id: 'dating-sub-me',
          userId: 'user-me',
          plan: 'year',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2027-04-18T08:00:00.000Z'),
        },
        {
          id: 'dating-sub-sonya',
          userId: 'user-sonya',
          plan: 'month',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        },
        {
          id: 'dating-sub-oleg',
          userId: 'user-oleg',
          plan: 'month',
          status: 'trial',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          trialEndsAt: new Date('2026-04-25T08:00:00.000Z'),
        },
      ],
    });

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
      response.body.items.some((item: { userId: string }) => item.userId === 'user-oleg'),
    ).toBe(false);
    expect(
      response.body.items.some((item: { userId: string }) => item.userId === 'user-mark'),
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

  it('returns incoming likes for premium user', async () => {
    await prisma.userSubscription.createMany({
      data: [
        {
          id: 'dating-sub-me',
          userId: 'user-me',
          plan: 'year',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2027-04-18T08:00:00.000Z'),
        },
        {
          id: 'dating-sub-sonya',
          userId: 'user-sonya',
          plan: 'month',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        },
      ],
    });

    await request(app.getHttpServer())
      .post('/dating/actions')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ targetUserId: 'user-me', action: 'like' })
      .expect(201);

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
    await prisma.userSubscription.createMany({
      data: [
        {
          id: 'dating-sub-me',
          userId: 'user-me',
          plan: 'year',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2027-04-18T08:00:00.000Z'),
        },
        {
          id: 'dating-sub-sonya',
          userId: 'user-sonya',
          plan: 'month',
          status: 'active',
          startedAt: new Date('2026-04-18T08:00:00.000Z'),
          renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        },
      ],
    });

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
      await prisma.userSubscription.createMany({
        data: [
          {
            id: 'dating-media-sub-me',
            userId: 'user-me',
            plan: 'year',
            status: 'active',
            startedAt: new Date('2026-04-18T08:00:00.000Z'),
            renewsAt: new Date('2027-04-18T08:00:00.000Z'),
          },
          {
            id: 'dating-media-sub-sonya',
            userId: 'user-sonya',
            plan: 'month',
            status: 'active',
            startedAt: new Date('2026-04-18T08:00:00.000Z'),
            renewsAt: new Date('2026-05-18T08:00:00.000Z'),
          },
        ],
      });

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
      await prisma.userSubscription.deleteMany({
        where: {
          id: {
            in: ['dating-media-sub-me', 'dating-media-sub-sonya'],
          },
        },
      });
    }
  });

  it('blocks dating mode event creation without frendly+', async () => {
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
      })
      .expect(403);

    expect(response.body.code).toBe('dating_locked');
  });

  it('normalizes dating mode event fields on create', async () => {
    await prisma.userSubscription.create({
      data: {
        id: 'dating-sub-me',
        userId: 'user-me',
        plan: 'year',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2027-04-18T08:00:00.000Z'),
      },
    });

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
      dayFeed.body.items.some((item: { id: string }) => item.id === createResponse.body.id),
    ).toBe(false);

    const afterDarkFeed = await request(app.getHttpServer())
      .get('/after-dark/events')
      .query({ limit: 50 })
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .expect(200);

    expect(
      afterDarkFeed.body.items.some((item: { id: string }) => item.id === createResponse.body.id),
    ).toBe(true);
  });
});
