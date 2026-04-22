import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('after dark api flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let meAccessToken = '';
  let sonyaAccessToken = '';
  let dimaAccessToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService).client;

    const meLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-me' })
      .expect(201);
    meAccessToken = meLogin.body.accessToken;

    const sonyaLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);
    sonyaAccessToken = sonyaLogin.body.accessToken;

    const dimaLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-dima' })
      .expect(201);
    dimaAccessToken = dimaLogin.body.accessToken;
  });

  beforeEach(async () => {
    await prisma.userSubscription.deleteMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
    });
    await prisma.userSettings.updateMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
      data: {
        afterDarkAgeConfirmedAt: null,
        afterDarkCodeAcceptedAt: null,
      },
    });
    await prisma.userVerification.update({
      where: { userId: 'user-dima' },
      data: {
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        reviewedAt: null,
      },
    });
    await prisma.eventParticipant.deleteMany({
      where: {
        eventId: {
          in: ['ad1', 'ad3', 'ad7'],
        },
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
    });
    await prisma.eventAttendance.deleteMany({
      where: {
        eventId: {
          in: ['ad1', 'ad3', 'ad7'],
        },
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
    });
    await prisma.chatMember.deleteMany({
      where: {
        chatId: {
          in: ['mc-ad1', 'mc-ad3', 'mc-ad7'],
        },
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
    });
    await prisma.eventJoinRequest.deleteMany({
      where: {
        eventId: {
          in: ['ad3', 'ad7'],
        },
        userId: {
          in: ['user-me', 'user-sonya', 'user-dima'],
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns locked access state and gates the feed before unlock', async () => {
    const accessResponse = await request(app.getHttpServer())
      .get('/after-dark/access')
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(accessResponse.body.unlocked).toBe(false);
    expect(accessResponse.body.subscriptionStatus).toBe('inactive');
    expect(accessResponse.body.plan).toBeNull();
    expect(accessResponse.body.ageConfirmed).toBe(false);
    expect(accessResponse.body.codeAccepted).toBe(false);
    expect(accessResponse.body.kinkVerified).toBe(true);
    expect(accessResponse.body.previewCount).toBeGreaterThanOrEqual(1);

    const feedResponse = await request(app.getHttpServer())
      .get('/after-dark/events')
      .set('authorization', `Bearer ${meAccessToken}`);

    expect(feedResponse.status).toBe(403);
    expect(feedResponse.body.code).toBe('after_dark_locked');
  });

  it('requires both checkboxes to unlock the section', async () => {
    const response = await request(app.getHttpServer())
      .post('/after-dark/unlock')
      .set('authorization', `Bearer ${meAccessToken}`)
      .send({ plan: 'month', ageConfirmed: true, codeAccepted: false });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('after_dark_consent_required');
  });

  it('unlocks after dark, lists events and joins an open event', async () => {
    const unlockResponse = await request(app.getHttpServer())
      .post('/after-dark/unlock')
      .set('authorization', `Bearer ${meAccessToken}`)
      .send({ plan: 'month', ageConfirmed: true, codeAccepted: true })
      .expect(201);

    expect(unlockResponse.body.unlocked).toBe(true);
    expect(unlockResponse.body.plan).toBe('month');
    expect(unlockResponse.body.subscriptionStatus).toBe('active');
    expect(unlockResponse.body.ageConfirmed).toBe(true);
    expect(unlockResponse.body.codeAccepted).toBe(true);

    const listResponse = await request(app.getHttpServer())
      .get('/after-dark/events')
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);
    expect(listResponse.body).toHaveProperty('nextCursor');
    expect(
      listResponse.body.items.some(
        (item: { id: string; category: string }) =>
          item.id === 'ad1' && item.category === 'nightlife',
      ),
    ).toBe(true);

    const detailResponse = await request(app.getHttpServer())
      .get('/after-dark/events/ad1')
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(detailResponse.body.id).toBe('ad1');
    expect(detailResponse.body.consentRequired).toBe(false);
    expect(Array.isArray(detailResponse.body.rules)).toBe(true);

    const joinResponse = await request(app.getHttpServer())
      .post('/after-dark/events/ad1/join')
      .set('authorization', `Bearer ${meAccessToken}`)
      .send({})
      .expect(201);

    expect(joinResponse.body.id).toBe('ad1');
    expect(joinResponse.body.joined).toBe(true);
    expect(joinResponse.body.chatId).toEqual(expect.any(String));

    const chatsResponse = await request(app.getHttpServer())
      .get('/chats/meetups')
      .query({ limit: 100 })
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(
      chatsResponse.body.items.some(
        (item: { id: string; isAfterDark: boolean; afterDarkGlow: string | null }) =>
          item.id === joinResponse.body.chatId &&
          item.isAfterDark === true &&
          item.afterDarkGlow === 'magenta',
      ),
    ).toBe(true);
  });

  it('paginates after dark events by cursor with stable order', async () => {
    await request(app.getHttpServer())
      .post('/after-dark/unlock')
      .set('authorization', `Bearer ${meAccessToken}`)
      .send({ plan: 'month', ageConfirmed: true, codeAccepted: true })
      .expect(201);

    const firstPage = await request(app.getHttpServer())
      .get('/after-dark/events')
      .query({ limit: 2 })
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get('/after-dark/events')
      .query({ limit: 2, cursor: firstPage.body.nextCursor })
      .set('authorization', `Bearer ${meAccessToken}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });

  it('requires explicit rules consent for consent-based after dark events and keeps request idempotent', async () => {
    await request(app.getHttpServer())
      .post('/after-dark/unlock')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ plan: 'year', ageConfirmed: true, codeAccepted: true })
      .expect(201);

    const missingConsent = await request(app.getHttpServer())
      .post('/after-dark/events/ad3/join')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ acceptedRules: false });

    expect(missingConsent.status).toBe(400);
    expect(missingConsent.body.code).toBe('after_dark_rules_required');

    const firstRequest = await request(app.getHttpServer())
      .post('/after-dark/events/ad3/join')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ acceptedRules: true, note: 'Спокойный формат мне подходит' })
      .expect(201);

    expect(firstRequest.body.status).toBe('pending');
    expect(firstRequest.body.eventId).toBe('ad3');

    const secondRequest = await request(app.getHttpServer())
      .post('/after-dark/events/ad3/join')
      .set('authorization', `Bearer ${sonyaAccessToken}`)
      .send({ acceptedRules: true, note: 'Повторно подтверждаю правила' })
      .expect(201);

    expect(secondRequest.body.id).toBe(firstRequest.body.id);
    expect(secondRequest.body.status).toBe('pending');
  });

  it('blocks kink join for unlocked users without verification', async () => {
    await request(app.getHttpServer())
      .post('/after-dark/unlock')
      .set('authorization', `Bearer ${dimaAccessToken}`)
      .send({ plan: 'month', ageConfirmed: true, codeAccepted: true })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/after-dark/events/ad7/join')
      .set('authorization', `Bearer ${dimaAccessToken}`)
      .send({ acceptedRules: true });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('after_dark_verification_required');
  });
});
