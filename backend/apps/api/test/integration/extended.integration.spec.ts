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

  const futureIso = (daysFromNow: number, hourUtc: number, minute = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromNow);
    date.setUTCHours(hourUtc, minute, 0, 0);
    return date.toISOString();
  };

  const pastDate = (daysAgo: number, hourUtc: number, minute = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    date.setUTCHours(hourUtc, minute, 0, 0);
    return date;
  };

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
    await prisma.userReport.deleteMany({
      where: {
        reporterId: 'user-me',
      },
    });
    await prisma.trustedContact.deleteMany({
      where: {
        userId: 'user-me',
      },
    });
    await prisma.safetySosAlert.deleteMany({
      where: {
        userId: 'user-me',
      },
    });
    await prisma.eventStory.deleteMany({
      where: {
        eventId: 'e1',
        authorId: 'user-me',
      },
    });
    await prisma.userSubscription.deleteMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya'],
        },
      },
    });
    await prisma.userSettings.updateMany({
      where: {
        userId: {
          in: ['user-me', 'user-sonya'],
        },
      },
      data: {
        discoverable: true,
        showAge: true,
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

  it('respects discoverable and showAge privacy in people, profile and matches', async () => {
    await prisma.userSettings.update({
      where: { userId: 'user-sonya' },
      data: {
        discoverable: false,
        showAge: false,
      },
    });

    const peopleResponse = await request(app.getHttpServer())
      .get('/people')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      peopleResponse.body.items.some((item: { id: string }) => item.id === 'user-sonya'),
    ).toBe(false);

    const profileResponse = await request(app.getHttpServer())
      .get('/people/user-sonya')
      .set('authorization', `Bearer ${accessToken}`);

    expect(profileResponse.status).toBe(404);
    expect(profileResponse.body.code).toBe('user_not_found');

    await prisma.userSettings.update({
      where: { userId: 'user-sonya' },
      data: {
        discoverable: true,
      },
    });

    const publicProfileResponse = await request(app.getHttpServer())
      .get('/people/user-sonya')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(publicProfileResponse.body.age).toBeNull();

    await prisma.userSettings.update({
      where: { userId: 'user-sonya' },
      data: {
        discoverable: false,
      },
    });

    await request(app.getHttpServer())
      .post('/events/e1/feedback')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        vibe: 'cozy',
        hostRating: 5,
        favoriteUserIds: ['user-sonya'],
      })
      .expect(201);

    const peerLogin = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/events/e1/feedback')
      .set('authorization', `Bearer ${peerLogin.body.accessToken}`)
      .send({
        vibe: 'cozy',
        hostRating: 5,
        favoriteUserIds: ['user-me'],
      })
      .expect(201);

    const matchesResponse = await request(app.getHttpServer())
      .get('/matches')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      matchesResponse.body.items.some((item: { userId: string }) => item.userId === 'user-sonya'),
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

  it('paginates people discovery by cursor', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/people')
      .query({ limit: 2 })
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get('/people')
      .query({ limit: 2, cursor: firstPage.body.nextCursor })
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
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

  it('rejects duplicate trusted contacts and duplicate reports', async () => {
    await request(app.getHttpServer())
      .post('/safety/trusted-contacts')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Маша',
        phoneNumber: '+79995550011',
        mode: 'all_plans',
      })
      .expect(201);

    const duplicateContact = await request(app.getHttpServer())
      .post('/safety/trusted-contacts')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Маша 2',
        phoneNumber: '+79995550011',
        mode: 'sos_only',
      });

    expect(duplicateContact.status).toBe(409);
    expect(duplicateContact.body.code).toBe('trusted_contact_duplicate');

    await request(app.getHttpServer())
      .post('/reports')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: 'user-mark',
        reason: 'spam',
        details: 'Повторяющаяся реклама',
        blockRequested: false,
      })
      .expect(201);

    const duplicateReport = await request(app.getHttpServer())
      .post('/reports')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: 'user-mark',
        reason: 'spam',
        details: 'Повторяющаяся реклама',
        blockRequested: false,
      });

    expect(duplicateReport.status).toBe(409);
    expect(duplicateReport.body.code).toBe('duplicate_report');
  });

  it('returns sanitized reports and blocks payloads', async () => {
    await request(app.getHttpServer())
      .post('/reports')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: 'user-mark',
        reason: 'abuse',
        details: 'Нарушение границ',
        blockRequested: true,
      })
      .expect(201);

    const reportsResponse = await request(app.getHttpServer())
      .get('/reports/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(reportsResponse.body[0].targetUser).toBeUndefined();
    expect(reportsResponse.body[0].targetUserId).toBe('user-mark');

    const blocksResponse = await request(app.getHttpServer())
      .get('/blocks')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const blocked = blocksResponse.body.find(
      (item: { blockedUserId: string }) => item.blockedUserId === 'user-mark',
    );

    expect(blocked.blockedUser.displayName).toBeDefined();
    expect(blocked.blockedUser.online).toBeUndefined();
  });

  it('persists sos event with event reference and notified contacts count', async () => {
    const contact = await request(app.getHttpServer())
      .post('/safety/trusted-contacts')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Маша SOS',
        channel: 'telegram',
        value: '@masha_sos',
        mode: 'sos_only',
      })
      .expect(201);

    expect(contact.body.mode).toBe('sos_only');
    expect(contact.body.channel).toBe('telegram');
    expect(contact.body.value).toBe('@masha_sos');

    const response = await request(app.getHttpServer())
      .post('/safety/sos')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ eventId: 'e1' })
      .expect(201);

    expect(response.body.eventId).toBe('e1');
    expect(response.body.notifiedContactsCount).toBe(1);
    expect(response.body.status).toBe('queued');

    const alert = await prisma.safetySosAlert.findUnique({
      where: { id: response.body.id },
    });

    expect(alert?.recipientsCount).toBe(1);
  });

  it('lists and creates stories', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/events/e1/stories')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body.items)).toBe(true);
    expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);
    expect(listResponse.body).toHaveProperty('nextCursor');

    const createResponse = await request(app.getHttpServer())
      .post('/events/e1/stories')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ caption: 'Новый тост за вечер', emoji: '🥂' })
      .expect(201);

    expect(createResponse.body.caption).toBe('Новый тост за вечер');
  });

  it('returns subscription plans and creates mock subscription', async () => {
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
    expect(subscribe.body.status).toBe('active');

    const current = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(current.body.plan).toBe('month');
    expect(current.body.status).toBe('active');

    await prisma.userSubscription.deleteMany({
      where: { userId: 'user-me' },
    });

    const currentAfterCleanup = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(currentAfterCleanup.body.plan).toBeNull();
    expect(currentAfterCleanup.body.status).toBe('inactive');
  });

  it('rejects invalid subscription plan', async () => {
    const response = await request(app.getHttpServer())
      .post('/subscription/subscribe')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ plan: 'lifetime' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_subscription_plan');
  });

  it('restores current mock subscription state without provider proof', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/subscription/subscribe')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .send({ plan: 'year' })
      .expect(201);

    const restoreResponse = await request(app.getHttpServer())
      .post('/subscription/restore')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(201);

    expect(restoreResponse.body.plan).toBe('year');
    expect(restoreResponse.body.status).toBe('trial');

    const currentResponse = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(currentResponse.body.plan).toBe('year');
    expect(currentResponse.body.status).toBe('trial');

    await prisma.userSubscription.deleteMany({
      where: { userId: 'user-sonya' },
    });

    const currentAfterCleanup = await request(app.getHttpServer())
      .get('/subscription/me')
      .set('authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(currentAfterCleanup.body.status).toBe('inactive');
    expect(currentAfterCleanup.body.plan).toBeNull();
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
        startsAt: futureIso(1, 19),
        capacity: 4,
        distanceKm: 0.6,
        joinMode: 'open',
      })
      .expect(201);

    await prisma.event.update({
      where: { id: createResponse.body.id as string },
      data: {
        startsAt: pastDate(2, 19),
      },
    });

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

    expect(matches.body.items.some((item: { userId: string }) => item.userId === 'user-anya')).toBe(true);
    expect(matches.body.items.filter((item: { userId: string }) => item.userId === 'user-anya')).toHaveLength(1);
    expect(matches.body).toHaveProperty('nextCursor');
  });
});
