import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiAppModule } from '../../src/app.module';

jest.setTimeout(30000);

describe('extended rollout api flows', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApiAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-me' })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
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

  it('reads and updates verification status', async () => {
    const current = await request(app.getHttpServer())
      .get('/verification/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(current.body.status).toBeDefined();

    const submitted = await request(app.getHttpServer())
      .post('/verification/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ step: 'document' })
      .expect(201);

    expect(submitted.body.status).toBe('under_review');
    expect(submitted.body.documentDone).toBe(true);
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

  it('returns matches from mutual favorites', async () => {
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

    const matches = await request(app.getHttpServer())
      .get('/matches')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(matches.body.some((item: { userId: string }) => item.userId === 'user-anya')).toBe(true);
  });
});
