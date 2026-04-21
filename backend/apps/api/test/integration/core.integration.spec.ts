import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { buildPublicAssetUrl } from '@big-break/database';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('core api flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken = '';
  let peerAccessToken = '';

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

    const peerLoginResponse = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-sonya' })
      .expect(201);

    peerAccessToken = peerLoginResponse.body.accessToken;
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

  it('updates profile with a consistent roundtrip shape', async () => {
    const updateResponse = await request(app.getHttpServer())
      .patch('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Никита Т',
        age: 29,
        city: 'Санкт-Петербург',
        area: 'Петроградка',
        bio: 'Люблю тихие бары и длинные прогулки',
        vibe: 'Легко',
      })
      .expect(200);

    expect(updateResponse.body.id).toBe('user-me');
    expect(updateResponse.body.displayName).toBe('Никита Т');
    expect(updateResponse.body.age).toBe(29);
    expect(updateResponse.body.city).toBe('Санкт-Петербург');
    expect(updateResponse.body.area).toBe('Петроградка');
    expect(updateResponse.body.bio).toBe('Люблю тихие бары и длинные прогулки');
    expect(updateResponse.body.vibe).toBe('Легко');
    expect(updateResponse.body.avatarUrl).toEqual(expect.any(String));

    const readResponse = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readResponse.body.displayName).toBe('Никита Т');
    expect(readResponse.body.age).toBe(29);
    expect(readResponse.body.city).toBe('Санкт-Петербург');
    expect(readResponse.body.area).toBe('Петроградка');
    expect(readResponse.body.bio).toBe('Люблю тихие бары и длинные прогулки');
    expect(readResponse.body.vibe).toBe('Легко');
  });

  it('rejects invalid profile payload', async () => {
    const response = await request(app.getHttpServer())
      .patch('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        age: '29',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_profile_payload');
  });

  it('fully overwrites onboarding payload on save', async () => {
    await request(app.getHttpServer())
      .put('/onboarding/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intent: 'both',
        city: 'Москва',
        area: 'Якиманка',
        interests: ['Кофе', 'Кино', 'Йога'],
        vibe: 'Спокойно',
      })
      .expect(200);

    const overwriteResponse = await request(app.getHttpServer())
      .put('/onboarding/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intent: 'friendship',
        city: null,
        area: null,
        interests: ['Прогулки'],
        vibe: null,
      })
      .expect(200);

    expect(overwriteResponse.body.intent).toBe('friendship');
    expect(overwriteResponse.body.city).toBeNull();
    expect(overwriteResponse.body.area).toBeNull();
    expect(overwriteResponse.body.interests).toEqual(['Прогулки']);
    expect(overwriteResponse.body.vibe).toBeNull();

    const readResponse = await request(app.getHttpServer())
      .get('/onboarding/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readResponse.body.intent).toBe('friendship');
    expect(readResponse.body.city).toBeNull();
    expect(readResponse.body.area).toBeNull();
    expect(readResponse.body.interests).toEqual(['Прогулки']);
    expect(readResponse.body.vibe).toBeNull();
  });

  it('persists settings including dark mode', async () => {
    const updateResponse = await request(app.getHttpServer())
      .put('/settings/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        allowLocation: false,
        allowPush: false,
        allowContacts: true,
        autoSharePlans: false,
        hideExactLocation: true,
        quietHours: true,
        showAge: false,
        discoverable: false,
        darkMode: true,
      })
      .expect(200);

    expect(updateResponse.body).toEqual({
      allowLocation: false,
      allowPush: false,
      allowContacts: true,
      autoSharePlans: false,
      hideExactLocation: true,
      quietHours: true,
      showAge: false,
      discoverable: false,
      darkMode: true,
    });

    const readResponse = await request(app.getHttpServer())
      .get('/settings/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readResponse.body).toEqual(updateResponse.body);
  });

  it('uploads avatar file, saves ready asset for the owner and rejects bad mime', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/profile/me/avatar/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('fake-png-content'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(uploadResponse.body.assetId).toEqual(expect.any(String));
    expect(uploadResponse.body.status).toBe('ready');
    expect(uploadResponse.body.url).toContain('/big-break/avatars/user-me/');

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: uploadResponse.body.assetId as string },
    });

    expect(asset?.ownerId).toBe('user-me');
    expect(asset?.kind).toBe('avatar');
    expect(asset?.status).toBe('ready');
    expect(asset?.mimeType).toBe('image/png');

    const profileResponse = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileResponse.body.avatarUrl).toBe(uploadResponse.body.url);

    const invalidUploadResponse = await request(app.getHttpServer())
      .post('/profile/me/avatar/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('plain-text'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      });

    expect(invalidUploadResponse.status).toBe(400);
    expect(invalidUploadResponse.body.code).toBe('invalid_avatar_mime_type');
  });

  it('supports multiple profile photos with primary switch and delete', async () => {
    const initialRead = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    const initialCount = initialRead.body.photos.length as number;

    const firstUpload = await request(app.getHttpServer())
      .post('/profile/me/photos/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('fake-first-png'), {
        filename: 'first.png',
        contentType: 'image/png',
      })
      .expect(201);

    const secondUpload = await request(app.getHttpServer())
      .post('/profile/me/photos/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('fake-second-png'), {
        filename: 'second.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(firstUpload.body.photo.id).toEqual(expect.any(String));
    expect(secondUpload.body.photo.id).toEqual(expect.any(String));

    const readAfterUpload = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    const lastPhotoAfterUpload = readAfterUpload.body.photos[
      readAfterUpload.body.photos.length - 1
    ];

    expect(readAfterUpload.body.photos).toHaveLength(initialCount + 2);
    expect(lastPhotoAfterUpload.id).toBe(secondUpload.body.photo.id);

    await request(app.getHttpServer())
      .post(`/profile/me/photos/${secondUpload.body.photo.id}/primary`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const readAfterPrimary = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readAfterPrimary.body.photos[0].id).toBe(secondUpload.body.photo.id);
    expect(readAfterPrimary.body.avatarUrl).toBe(readAfterPrimary.body.photos[0].url);

    await request(app.getHttpServer())
      .delete(`/profile/me/photos/${firstUpload.body.photo.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const readAfterDelete = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readAfterDelete.body.photos).toHaveLength(initialCount + 1);
    expect(
      readAfterDelete.body.photos.every(
        (item: { id: string }) => item.id !== firstUpload.body.photo.id,
      ),
    ).toBe(true);
  });

  it('uploads chat attachment only for chat members and keeps owner metadata', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${accessToken}`)
      .field('chatId', 'p1')
      .attach('file', Buffer.from('pdf-content'), {
        filename: 'note.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(uploadResponse.body.assetId).toEqual(expect.any(String));
    expect(uploadResponse.body.status).toBe('ready');

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: uploadResponse.body.assetId as string },
    });

    expect(asset?.ownerId).toBe('user-me');
    expect(asset?.kind).toBe('chat_attachment');
    expect(asset?.chatId).toBe('p1');
    expect(asset?.mimeType).toBe('application/pdf');

    const forbiddenResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${peerAccessToken}`)
      .field('chatId', 'p1')
      .attach('file', Buffer.from('pdf-content'), {
        filename: 'note.pdf',
        contentType: 'application/pdf',
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.code).toBe('chat_attachment_forbidden');

    const missingChatIdResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('pdf-content'), {
        filename: 'note.pdf',
        contentType: 'application/pdf',
      });

    expect(missingChatIdResponse.status).toBe(400);
    expect(missingChatIdResponse.body.code).toBe('chat_id_required');
  });

  it('uploads voice message asset with duration metadata', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${accessToken}`)
      .field('chatId', 'p1')
      .field('kind', 'chat_voice')
      .field('durationMs', '14000')
      .attach('file', Buffer.from('voice-bytes'), {
        filename: 'voice.webm',
        contentType: 'audio/webm',
      })
      .expect(201);

    expect(uploadResponse.body.assetId).toEqual(expect.any(String));
    expect(uploadResponse.body.status).toBe('ready');

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: uploadResponse.body.assetId as string },
    });

    expect(asset?.ownerId).toBe('user-me');
    expect(asset?.chatId).toBe('p1');
    expect(asset?.kind).toBe('chat_voice');
    expect(asset?.mimeType).toBe('audio/webm');
    expect(asset?.durationMs).toBe(14000);
  });

  it('completes presigned voice upload with duration metadata', async () => {
    const uploadUrlResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/upload-url')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        chatId: 'p1',
        kind: 'chat_voice',
        fileName: 'voice.m4a',
        contentType: 'audio/mp4',
        durationMs: 9000,
      })
      .expect(201);

    expect(uploadUrlResponse.body.objectKey).toEqual(expect.any(String));

    const completeResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/complete')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        chatId: 'p1',
        kind: 'chat_voice',
        objectKey: uploadUrlResponse.body.objectKey,
        mimeType: 'audio/mp4',
        byteSize: 2048,
        fileName: 'voice.m4a',
        durationMs: 9000,
      })
      .expect(201);

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: completeResponse.body.assetId as string },
    });

    expect(asset?.kind).toBe('chat_voice');
    expect(asset?.durationMs).toBe(9000);
    expect(asset?.mimeType).toBe('audio/mp4');
  });

  it('returns voice fallback preview when last message text is empty', async () => {
    const assetId = `voice-preview-${Date.now()}`;
    const objectKey = `chat-attachments/user-sonya/${assetId}-voice.webm`;
    const clientMessageId = `voice-preview-message-${Date.now()}`;
    let messageId: string | null = null;

    try {
      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          ownerId: 'user-sonya',
          kind: 'chat_voice',
          status: 'ready',
          bucket: process.env.S3_BUCKET ?? 'big-break',
          objectKey,
          mimeType: 'audio/webm',
          byteSize: 2048,
          durationMs: 12000,
          originalFileName: 'voice.webm',
          publicUrl: buildPublicAssetUrl(objectKey),
          chatId: 'p1',
        } as any,
      });

      const message = await prisma.message.create({
        data: {
          chatId: 'p1',
          senderId: 'user-sonya',
          text: '',
          clientMessageId,
          attachments: {
            create: [{ mediaAssetId: assetId }],
          },
        },
      });
      messageId = message.id;

      const response = await request(app.getHttpServer())
        .get('/chats/personal')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      const chat = response.body.items.find((item: { id: string }) => item.id === 'p1');
      expect(chat.lastMessage).toBe('Голосовое сообщение');
    } finally {
      if (messageId != null) {
        await prisma.message.delete({ where: { id: messageId } });
      }
      await prisma.mediaAsset.deleteMany({
        where: {
          id: assetId,
        },
      });
    }
  });

  it('returns event feed with cursor pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/events?filter=nearby&limit=2')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it('returns stable event cards for feed filters', async () => {
    const calmResponse = await request(app.getHttpServer())
      .get('/events?filter=calm')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(calmResponse.body.items.length).toBeGreaterThan(0);
    expect(calmResponse.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        emoji: expect.any(String),
        time: expect.any(String),
        place: expect.any(String),
        distance: expect.any(String),
        vibe: expect.any(String),
        tone: expect.any(String),
        going: expect.any(Number),
        capacity: expect.any(Number),
        joined: expect.any(Boolean),
        joinMode: expect.any(String),
        lifestyle: expect.any(String),
        priceMode: expect.any(String),
        accessMode: expect.any(String),
        genderMode: expect.any(String),
        visibilityMode: expect.any(String),
        attendanceStatus: expect.any(String),
        liveStatus: expect.any(String),
        isHost: expect.any(Boolean),
      }),
    );
    expect(Array.isArray(calmResponse.body.items[0].attendees)).toBe(true);
    expect(calmResponse.body.items[0]).toHaveProperty('joinRequestStatus');

    const dateResponse = await request(app.getHttpServer())
      .get('/events?filter=date')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      dateResponse.body.items.every((item: { tone: string }) => item.tone === 'evening'),
    ).toBe(true);
  });

  it('creates event with discovery filters and filters feed by extended params', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Трезвый бранч по фильтрам',
        description: 'Без алкоголя, по заявке, только девушки.',
        emoji: '☕',
        vibe: 'Спокойно',
        place: 'Чистые пруды 1',
        startsAt: '2026-04-22T10:30:00.000Z',
        capacity: 6,
        distanceKm: 0.5,
        lifestyle: 'zozh',
        priceMode: 'upto',
        priceAmountTo: 900,
        accessMode: 'request',
        genderMode: 'female',
        visibilityMode: 'public',
      })
      .expect(201);

    expect(createResponse.body.lifestyle).toBe('zozh');
    expect(createResponse.body.priceMode).toBe('upto');
    expect(createResponse.body.accessMode).toBe('request');
    expect(createResponse.body.genderMode).toBe('female');
    expect(createResponse.body.visibilityMode).toBe('public');

    const filteredResponse = await request(app.getHttpServer())
      .get('/events?filter=nearby&lifestyle=zozh&price=cheap&gender=female&access=request&q=бранч')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(filteredResponse.body.items.length).toBeGreaterThan(0);
    expect(
      filteredResponse.body.items.some((item: { id: string }) => item.id === createResponse.body.id),
    ).toBe(true);
  });

  it('hides meetup chat id in detail until the user has access', async () => {
    const openCreateResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({
        title: 'Открытый meetup без доступа к чату до join',
        description: 'Чат должен открыться только после вступления',
        emoji: '🎨',
        vibe: 'Спокойно',
        place: 'Маросейка 3',
        startsAt: '2026-04-21T17:30:00.000Z',
        capacity: 7,
        distanceKm: 0.4,
        joinMode: 'open',
      })
      .expect(201);

    const openEventId = openCreateResponse.body.id as string;

    const openEventResponse = await request(app.getHttpServer())
      .get(`/events/${openEventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(openEventResponse.body.joined).toBe(false);
    expect(openEventResponse.body.chatId).toBeNull();
    expect(openEventResponse.body.host.id).toBe('user-sonya');
    expect(openEventResponse.body.attendees.length).toBeGreaterThan(0);

    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин по заявкам без чата до апрува',
        description: 'Сначала заявка, потом доступ в чат',
        emoji: '🍲',
        vibe: 'Уютно',
        place: 'Покровка 8',
        startsAt: '2026-04-21T18:30:00.000Z',
        capacity: 5,
        distanceKm: 0.5,
        joinMode: 'request',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({ note: 'Готов прийти вовремя' })
      .expect(201);

    const pendingDetailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(pendingDetailResponse.body.joinRequestStatus).toBe('pending');
    expect(pendingDetailResponse.body.joined).toBe(false);
    expect(pendingDetailResponse.body.chatId).toBeNull();

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/host/requests/${hostEventResponse.body.requests[0].id}/approve`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const approvedDetailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(approvedDetailResponse.body.joined).toBe(true);
    expect(approvedDetailResponse.body.chatId).toEqual(expect.any(String));
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
    const runClubChat = response.body.items.find((item: { id: string }) => item.id === 'p3');
    expect(runClubChat?.fromMeetup).toBe('Вечерняя пробежка по бульварам');
  });

  it('keeps notification unread count in sync with chat mark read', async () => {
    await prisma.notification.updateMany({
      where: {
        userId: 'user-me',
      },
      data: {
        readAt: null,
      },
    });

    const beforeResponse = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/chats/p1/read')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ messageId: 'p6' })
      .expect(201);

    const afterResponse = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(afterResponse.body.unreadCount).toBe(beforeResponse.body.unreadCount - 1);

    const messageNotification = await prisma.notification.findUnique({
      where: { id: 'n1' },
    });

    expect(messageNotification?.readAt).not.toBeNull();
  });

  it('returns notifications unread count', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.unreadCount).toBeGreaterThanOrEqual(0);
  });

  it('marks one notification as read through notifications api', async () => {
    await prisma.notification.updateMany({
      where: {
        userId: 'user-me',
      },
      data: {
        readAt: null,
      },
    });

    const beforeResponse = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const unreadItem = notificationsResponse.body.items.find(
      (item: { id: string; readAt: string | null }) => item.readAt == null,
    );

    expect(unreadItem).toBeDefined();

    await request(app.getHttpServer())
      .post(`/notifications/${unreadItem.id}/read`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const afterResponse = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(afterResponse.body.unreadCount).toBe(beforeResponse.body.unreadCount - 1);

    const updated = await prisma.notification.findUnique({
      where: { id: unreadItem.id as string },
    });

    expect(updated?.readAt).not.toBeNull();
  });

  it('marks all notifications as read through notifications api', async () => {
    await prisma.notification.updateMany({
      where: {
        userId: 'user-me',
      },
      data: {
        readAt: null,
      },
    });

    const beforeResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      beforeResponse.body.items.some(
        (item: { readAt: string | null }) => item.readAt == null,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const afterResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      afterResponse.body.items.every(
        (item: { readAt: string | null }) => item.readAt != null,
      ),
    ).toBe(true);

    const unreadCountResponse = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(unreadCountResponse.body.unreadCount).toBe(0);
  });

  it('reflects event stories in live meetup payload', async () => {
    await request(app.getHttpServer())
      .post('/events/e1/stories')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        caption: 'Сделали новый кадр с крыши',
        emoji: '📸',
      })
      .expect(201);

    const liveResponse = await request(app.getHttpServer())
      .get('/events/e1/live')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(liveResponse.body.status).toBe('live');
    expect(liveResponse.body.storiesCount).toBeGreaterThanOrEqual(1);
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

  it('creates invite notification for selected user and lets them accept it', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин по приглашению',
        description: 'Только для одной приглашенной гостьи',
        emoji: '🍷',
        vibe: 'Уютно',
        place: 'Покровка 7',
        startsAt: '2026-04-23T18:30:00.000Z',
        capacity: 4,
        distanceKm: 0.5,
        joinMode: 'request',
        inviteeUserId: 'user-sonya',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    const inviteNotification = notificationsResponse.body.items.find(
      (item: { payload?: { invite?: boolean; eventId?: string } }) =>
        item.payload?.invite === true && item.payload?.eventId === eventId,
    );

    expect(inviteNotification).toBeDefined();

    const acceptResponse = await request(app.getHttpServer())
      .post(`/events/${eventId}/invites/${inviteNotification.payload.requestId}/accept`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(201);

    expect(acceptResponse.body.id).toBe(eventId);
    expect(acceptResponse.body.joined).toBe(true);
    expect(acceptResponse.body.joinRequestStatus).toBe('approved');
    expect(acceptResponse.body.chatId).toEqual(expect.any(String));

    const detailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(detailResponse.body.joined).toBe(true);
    expect(detailResponse.body.joinRequestStatus).toBe('approved');
    expect(detailResponse.body.chatId).toEqual(expect.any(String));
  });

  it('writes a meetup chat message when invited user declines', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин с возможностью отказа',
        description: 'Проверяем системное сообщение после отказа',
        emoji: '🍲',
        vibe: 'Спокойно',
        place: 'Мясницкая 3',
        startsAt: '2026-04-23T19:30:00.000Z',
        capacity: 4,
        distanceKm: 0.8,
        joinMode: 'request',
        inviteeUserId: 'user-sonya',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    const inviteNotification = notificationsResponse.body.items.find(
      (item: { payload?: { invite?: boolean; eventId?: string } }) =>
        item.payload?.invite === true && item.payload?.eventId === eventId,
    );

    expect(inviteNotification).toBeDefined();

    await request(app.getHttpServer())
      .post(`/events/${eventId}/invites/${inviteNotification.payload.requestId}/decline`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(201);

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(hostEventResponse.body.chatId).toEqual(expect.any(String));
    expect(hostEventResponse.body.requests).toHaveLength(0);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/chats/${hostEventResponse.body.chatId}/messages`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      messagesResponse.body.items.some(
        (item: { text: string }) => item.text === 'Соня М не присоединится к встрече.',
      ),
    ).toBe(true);
  });

  it('does not allow canceling a join request after approval', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин после апрува без повторной отмены заявки',
        description: 'Проверяем корректный lifecycle request',
        emoji: '🍲',
        vibe: 'Уютно',
        place: 'Мясницкая 10',
        startsAt: '2026-04-22T18:30:00.000Z',
        capacity: 5,
        distanceKm: 0.7,
        joinMode: 'request',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({ note: 'Готов прийти вовремя' })
      .expect(201);

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/host/requests/${hostEventResponse.body.requests[0].id}/approve`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const cancelResponse = await request(app.getHttpServer())
      .delete(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`);

    expect(cancelResponse.status).toBe(409);
    expect(cancelResponse.body.code).toBe('join_request_already_reviewed');

    const detailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(detailResponse.body.joinRequestStatus).toBe('approved');
    expect(detailResponse.body.joined).toBe(true);
  });

  it('does not allow rejecting a join request after approval', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин без reject после approve',
        description: 'Проверяем корректный host lifecycle',
        emoji: '🍽️',
        vibe: 'Уютно',
        place: 'Сретенка 12',
        startsAt: '2026-04-22T20:00:00.000Z',
        capacity: 6,
        distanceKm: 0.9,
        joinMode: 'request',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({ note: 'Хочу присоединиться к ужину' })
      .expect(201);

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const requestId = hostEventResponse.body.requests[0].id as string;

    await request(app.getHttpServer())
      .post(`/host/requests/${requestId}/approve`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const rejectResponse = await request(app.getHttpServer())
      .post(`/host/requests/${requestId}/reject`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(rejectResponse.status).toBe(409);
    expect(rejectResponse.body.code).toBe('join_request_already_reviewed');

    const detailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(detailResponse.body.joinRequestStatus).toBe('approved');
    expect(detailResponse.body.joined).toBe(true);
  });

  it('does not allow approving a join request after rejection', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/events')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Ужин без approve после reject',
        description: 'Проверяем обратный переход lifecycle',
        emoji: '🍜',
        vibe: 'Уютно',
        place: 'Покровка 14',
        startsAt: '2026-04-22T21:00:00.000Z',
        capacity: 6,
        distanceKm: 1.1,
        joinMode: 'request',
      })
      .expect(201);

    const eventId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .post(`/events/${eventId}/join-request`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .send({ note: 'Хочу присоединиться к ужину' })
      .expect(201);

    const hostEventResponse = await request(app.getHttpServer())
      .get(`/host/events/${eventId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    const requestId = hostEventResponse.body.requests[0].id as string;

    await request(app.getHttpServer())
      .post(`/host/requests/${requestId}/reject`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(201);

    const approveResponse = await request(app.getHttpServer())
      .post(`/host/requests/${requestId}/approve`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(approveResponse.status).toBe(409);
    expect(approveResponse.body.code).toBe('join_request_already_reviewed');

    const detailResponse = await request(app.getHttpServer())
      .get(`/events/${eventId}`)
      .set('authorization', `Bearer ${peerAccessToken}`)
      .expect(200);

    expect(detailResponse.body.joinRequestStatus).toBe('rejected');
    expect(detailResponse.body.joined).toBe(false);
  });
});
