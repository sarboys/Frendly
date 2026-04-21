import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('extended rollout api flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService).client;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-me' })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
  });

  beforeEach(async () => {
    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { userId: 'user-me' },
          { blockedUserId: 'user-me' },
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads and updates settings', async () => {
    const current = await request(app.getHttpServer())
      .get('/settings/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(current.body.allowPush).toBeDefined();

    const updated = await request(app.getHttpServer())
      .put('/settings/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ allowContacts: true, darkMode: true })
      .expect(200);

    expect(updated.body.allowContacts).toBe(true);
    expect(updated.body.darkMode).toBe(true);
  });

  it('keeps verified users verified and moves new users through verification flow', async () => {
    await prisma.userVerification.update({
      where: { userId: 'user-me' },
      data: {
        status: 'verified',
        selfieDone: true,
        documentDone: true,
        reviewedAt: new Date('2026-04-18T10:00:00.000Z'),
      },
    });

    const current = await request(app.getHttpServer())
      .get('/verification/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(current.body.status).toBe('verified');

    const verifiedResubmit = await request(app.getHttpServer())
      .post('/verification/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ step: 'document' })
      .expect(201);

    expect(verifiedResubmit.body.status).toBe('verified');
    expect(verifiedResubmit.body.documentDone).toBe(true);

    await prisma.userVerification.upsert({
      where: { userId: 'user-mark' },
      update: {
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        reviewedAt: null,
      },
      create: {
        userId: 'user-mark',
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        reviewedAt: null,
      },
    });

    const freshUserLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-mark' })
      .expect(201);

    const selfieSubmitted = await request(app.getHttpServer())
      .post('/verification/submit')
      .set('authorization', `Bearer ${freshUserLogin.body.accessToken}`)
      .send({ step: 'selfie' })
      .expect(201);

    expect(selfieSubmitted.body.status).toBe('selfie_submitted');
    expect(selfieSubmitted.body.selfieDone).toBe(true);
    expect(selfieSubmitted.body.documentDone).toBe(false);

    const documentSubmitted = await request(app.getHttpServer())
      .post('/verification/submit')
      .set('authorization', `Bearer ${freshUserLogin.body.accessToken}`)
      .send({ step: 'document' })
      .expect(201);

    expect(documentSubmitted.body.status).toBe('under_review');
    expect(documentSubmitted.body.selfieDone).toBe(true);
    expect(documentSubmitted.body.documentDone).toBe(true);
  });

  it('rejects invalid verification step without mutating state', async () => {
    await prisma.userVerification.upsert({
      where: { userId: 'user-mark' },
      update: {
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        reviewedAt: null,
      },
      create: {
        userId: 'user-mark',
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        reviewedAt: null,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-mark' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/verification/submit')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .send({ step: 'voice' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_verification_step');

    const current = await request(app.getHttpServer())
      .get('/verification/me')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(current.body.status).toBe('not_started');
    expect(current.body.selfieDone).toBe(false);
    expect(current.body.documentDone).toBe(false);
  });

  it('reads safety hub and creates report', async () => {
    const safety = await request(app.getHttpServer())
      .get('/safety/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(safety.body.trustScore).toBeGreaterThanOrEqual(0);

    const report = await request(app.getHttpServer())
      .post('/reports')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: 'user-mark',
        reason: 'spam',
        details: 'Слишком много рекламы',
        blockRequested: true,
      })
      .expect(201);

    expect(report.body.blockRequested).toBe(true);

    const blocks = await request(app.getHttpServer())
      .get('/blocks')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(blocks.body.some((item: { blockedUserId: string }) => item.blockedUserId === 'user-mark')).toBe(true);
  });

  it('hides blocked users from people discovery', async () => {
    await prisma.userBlock.deleteMany({
      where: {
        userId: 'user-me',
        blockedUserId: 'user-sonya',
      },
    });

    await request(app.getHttpServer())
      .post('/reports')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: 'user-sonya',
        reason: 'spam',
        details: 'Не хочу больше видеть в подборке',
        blockRequested: true,
      })
      .expect(201);

    const peopleResponse = await request(app.getHttpServer())
      .get('/people')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      peopleResponse.body.items.some((item: { id: string }) => item.id === 'user-sonya'),
    ).toBe(false);
  });

  it('filters people discovery by q', async () => {
    const response = await request(app.getHttpServer())
      .get('/people')
      .query({ q: 'соня' })
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every((item: { name: string }) =>
        item.name.toLowerCase().includes('соня'),
      ),
    ).toBe(true);
  });

  it('hides blocked users from profile view and direct chat creation', async () => {
    await prisma.userBlock.upsert({
      where: {
        userId_blockedUserId: {
          userId: 'user-me',
          blockedUserId: 'user-sonya',
        },
      },
      update: {},
      create: {
        userId: 'user-me',
        blockedUserId: 'user-sonya',
      },
    });

    const profileResponse = await request(app.getHttpServer())
      .get('/people/user-sonya')
      .set('authorization', `Bearer ${accessToken}`);

    expect(profileResponse.status).toBe(404);
    expect(profileResponse.body.code).toBe('user_not_found');

    const chatResponse = await request(app.getHttpServer())
      .post('/people/user-sonya/direct-chat')
      .set('authorization', `Bearer ${accessToken}`);

    expect(chatResponse.status).toBe(404);
    expect(chatResponse.body.code).toBe('user_not_found');
  });

  it('creates direct block without report flow', async () => {
    await prisma.userBlock.deleteMany({
      where: {
        userId: 'user-me',
        blockedUserId: 'user-mark',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/blocks')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ targetUserId: 'user-mark' })
      .expect(201);

    expect(response.body.blockedUserId).toBe('user-mark');

    const blocks = await request(app.getHttpServer())
      .get('/blocks')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      blocks.body.some(
        (item: { blockedUserId: string }) => item.blockedUserId === 'user-mark',
      ),
    ).toBe(true);
  });

  it('persists sos event with event reference and notified contacts count', async () => {
    const contact = await request(app.getHttpServer())
      .post('/safety/trusted-contacts')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Маша SOS',
        phoneNumber: '+79995554433',
        mode: 'sos_only',
      })
      .expect(201);

    expect(contact.body.mode).toBe('sos_only');

    const response = await request(app.getHttpServer())
      .post('/safety/sos')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ eventId: 'e1' })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.eventId).toBe('e1');
    expect(response.body.notifiedContacts).toBeGreaterThanOrEqual(1);

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { type: 'safety.sos_triggered' },
      orderBy: { createdAt: 'desc' },
    });

    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent?.payload).toMatchObject({
      userId: 'user-me',
      eventId: 'e1',
      notifiedContacts: response.body.notifiedContacts,
    });
  });

  it('lists and creates stories', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/events/e1/stories')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body.length).toBeGreaterThanOrEqual(1);

    const createResponse = await request(app.getHttpServer())
      .post('/events/e1/stories')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ caption: 'Новый тост за вечер', emoji: '🥂' })
      .expect(201);

    expect(createResponse.body.caption).toBe('Новый тост за вечер');
  });

  it('returns subscription plans and subscribes', async () => {
    const plans = await request(app.getHttpServer())
      .get('/subscription/plans')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(plans.body.plans).toHaveLength(2);

    const subscribe = await request(app.getHttpServer())
      .post('/subscription/subscribe')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ plan: 'month' })
      .expect(201);

    expect(subscribe.body.plan).toBe('month');

    const current = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(current.body.plan).toBeDefined();
  });

  it('rejects invalid subscription plan', async () => {
    const response = await request(app.getHttpServer())
      .post('/subscription/subscribe')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ plan: 'lifetime' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_subscription_plan');
  });

  it('restores canceled subscription back to usable state', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/subscription/subscribe')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .send({ plan: 'month' })
      .expect(201);

    await prisma.userSubscription.updateMany({
      where: { userId: 'user-sonya' },
      data: { status: 'canceled' },
    });

    const restoreResponse = await request(app.getHttpServer())
      .post('/subscription/restore')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(201);

    expect(restoreResponse.body.restored).toBe(true);
    expect(restoreResponse.body.status).toBe('active');
    expect(restoreResponse.body.plan).toBe('month');

    const currentResponse = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(currentResponse.body.status).toBe('active');
    expect(currentResponse.body.plan).toBe('month');
  });

  it('returns unique matches from mutual favorites across multiple events', async () => {
    await request(app.getHttpServer())
      .post('/events/e1/feedback')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        vibe: 'cozy',
        hostRating: 5,
        favoriteUserIds: ['user-anya'],
      })
      .expect(201);

    const peerLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-anya' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/events/e1/feedback')
      .set('authorization', `Bearer ${peerLogin.body.accessToken}`)
      .send({
        vibe: 'magic',
        hostRating: 5,
        favoriteUserIds: ['user-me'],
      })
      .expect(201);

    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Второй вечер для проверки match dedupe',
        description: 'Нужен еще один mutual favorite без дублей в matches',
        emoji: '🍸',
        vibe: 'Спокойно',
        place: 'Петровка 11',
        startsAt: '2026-04-22T19:00:00.000Z',
        capacity: 4,
        distanceKm: 0.6,
        joinMode: 'open',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${createResponse.body.id}/join`)
      .set('authorization', `Bearer ${peerLogin.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${createResponse.body.id}/feedback`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        vibe: 'calm',
        hostRating: 5,
        favoriteUserIds: ['user-anya'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/events/${createResponse.body.id}/feedback`)
      .set('authorization', `Bearer ${peerLogin.body.accessToken}`)
      .send({
        vibe: 'calm',
        hostRating: 5,
        favoriteUserIds: ['user-me'],
      })
      .expect(201);

    const matches = await request(app.getHttpServer())
      .get('/matches')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(matches.body.some((item: { userId: string }) => item.userId === 'user-anya')).toBe(true);
    expect(matches.body.filter((item: { userId: string }) => item.userId === 'user-anya')).toHaveLength(1);
  });
});
