import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiAppModule } from '../../src/app.module';

jest.setTimeout(30000);

describe('core api flows', () => {
  let app: INestApplication;
  let accessToken = '';
  let peerAccessToken = '';

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

    const peerLoginResponse = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);

    peerAccessToken = peerLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns me profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe('user-me');
    expect(response.body.displayName).toEqual(expect.any(String));
  });

  it('updates onboarding', async () => {
    const response = await request(app.getHttpServer())
      .put('/onboarding/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intent: 'both',
        city: 'Москва',
        area: 'Патрики',
        interests: ['Кофе', 'Кино'],
        vibe: 'Спокойно',
      })
      .expect(200);

    expect(response.body.area).toBe('Патрики');
  });

  it('returns event feed with cursor pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/events?filter=nearby&limit=2')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it('creates or returns direct chat from people', async () => {
    const response = await request(app.getHttpServer())
      .post('/people/user-anya/direct-chat')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(response.body.id).toBe('p1');
  });

  it('returns personal chats', async () => {
    const response = await request(app.getHttpServer())
      .get('/chats/personal')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items[0].id).toBeDefined();
  });

  it('returns notifications unread count', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.unreadCount).toBeGreaterThanOrEqual(0);
  });

  it('runs request-only meetup host flow', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Закрытый ужин',
        description: 'Камерная встреча по заявкам',
        emoji: '🍝',
        vibe: 'Уютно',
        place: 'Солянка 5',
        startsAt: '2026-04-20T18:30:00.000Z',
        capacity: 6,
        distanceKm: 0.8,
        joinMode: 'request',
      })
      .expect(201);

    expect(createResponse.body.joinMode).toBe('request');
    expect(createResponse.body.isHost).toBe(true);

    const eventId = createResponse.body.id as string;

    const requestResponse = await request(app.getHttpServer())
      .post(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({ note: 'Хочу познакомиться с компанией' })
      .expect(201);

    expect(requestResponse.body.status).toBe('pending');

    const hostDashboardResponse = await request(app.getHttpServer())
      .get('/host/dashboard')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(hostDashboardResponse.body.pendingRequestsCount).toBeGreaterThanOrEqual(1);
    expect(hostDashboardResponse.body.events.some((item: { id: string }) => item.id === eventId)).toBe(true);

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(hostEventResponse.body.requests).toHaveLength(1);
    expect(hostEventResponse.body.requests[0].status).toBe('pending');

    const approveResponse = await request(app.getHttpServer())
      .post(`/host/requests/${hostEventResponse.body.requests[0].id}/approve`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(approveResponse.body.status).toBe('approved');

    const detailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(detailResponse.body.joinRequestStatus).toBe('approved');
    expect(detailResponse.body.joined).toBe(true);
    expect(detailResponse.body.attendanceStatus).toBe('not_checked_in');

    const manualCheckInResponse = await request(app.getHttpServer())
      .post(`/host/events/${eventId}/check-in`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ userId: 'user-sonya' })
      .expect(201);

    expect(manualCheckInResponse.body.status).toBe('checked_in');
    expect(manualCheckInResponse.body.method).toBe('host_manual');

    const startLiveResponse = await request(app.getHttpServer())
      .post(`/host/events/${eventId}/live/start`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(startLiveResponse.body.status).toBe('live');

    const liveResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}/live`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(liveResponse.body.status).toBe('live');
    expect(liveResponse.body.attendees.some((item: { userId: string }) => item.userId === 'user-sonya')).toBe(true);

    const finishLiveResponse = await request(app.getHttpServer())
      .post(`/host/events/${eventId}/live/finish`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(finishLiveResponse.body.status).toBe('finished');

    const feedbackResponse = await request(app.getHttpServer())
      .post(`/events/${eventId}/feedback`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({
        vibe: 'cozy',
        hostRating: 5,
        favoriteUserIds: ['user-me'],
        note: 'Было спокойно и легко',
      })
      .expect(201);

    expect(feedbackResponse.body.saved).toBe(true);
    expect(feedbackResponse.body.favoritesCount).toBe(1);
  });
});
