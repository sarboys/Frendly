import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { buildPublicAssetUrl } from '@big-break/database';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';
import { seedIntegrationTestData } from './seed-test-data';

jest.setTimeout(30000);

describe('media integration', () => {
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
    await seedIntegrationTestData(prisma);

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

  const expectMediaProxyPath = (value: string) => {
    expect(value).toMatch(/^\/media\/[^/]+$/);
  };

  it('keeps public avatar media on proxy urls across upload and profile payloads', async () => {
    const avatarUpload = await request(app.getHttpServer())
      .post('/profile/me/avatar/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('avatar-direct-content'), {
        filename: 'avatar-direct.png',
        contentType: 'image/png',
      })
      .expect(201);

    expectMediaProxyPath(avatarUpload.body.url as string);
    expect(avatarUpload.body.media).toMatchObject({
      visibility: 'public',
      url: avatarUpload.body.url,
      downloadUrl: avatarUpload.body.url,
      cacheKey: expect.stringContaining(avatarUpload.body.assetId),
      variants: {},
      expiresAt: null,
    });

    const photoUpload = await request(app.getHttpServer())
      .post('/profile/me/photos/file')
      .set('authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('profile-photo-direct-content'), {
        filename: 'profile-direct.png',
        contentType: 'image/png',
      })
      .expect(201);

    expectMediaProxyPath(photoUpload.body.photo.url as string);
    expect(photoUpload.body.photo.media).toMatchObject({
      visibility: 'public',
      url: photoUpload.body.photo.url,
      downloadUrl: photoUpload.body.photo.url,
      cacheKey: expect.any(String),
      variants: {},
      expiresAt: null,
    });

    const profileResponse = await request(app.getHttpServer())
      .get('/profile/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expectMediaProxyPath(profileResponse.body.avatarUrl as string);
    expect(profileResponse.body.photos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: photoUpload.body.photo.id,
          url: photoUpload.body.photo.url,
          media: expect.objectContaining({
            visibility: 'public',
            url: photoUpload.body.photo.url,
            downloadUrl: photoUpload.body.photo.url,
          }),
        }),
      ]),
    );
  });

  it('returns signed private media metadata and refreshes signed urls after expiry', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${accessToken}`)
      .field('chatId', 'p1')
      .attach('file', Buffer.from('private-media-payload'), {
        filename: 'private-note.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const firstResponse = await request(app.getHttpServer())
      .get(`/media/${uploadResponse.body.assetId}/download-url`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(firstResponse.body).toMatchObject({
      id: uploadResponse.body.assetId,
      kind: 'chat_attachment',
      visibility: 'private',
      url: expect.stringContaining('X-Amz-Signature='),
      downloadUrl: expect.stringContaining('X-Amz-Signature='),
      cacheKey: expect.stringContaining(uploadResponse.body.assetId),
      variants: {},
    });
    expect(firstResponse.body.expiresAt).toEqual(expect.any(String));
    expect(new Date(firstResponse.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const refreshedResponse = await request(app.getHttpServer())
      .get(`/media/${uploadResponse.body.assetId}/download-url`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(refreshedResponse.body.downloadUrl).toEqual(
      expect.stringContaining('X-Amz-Signature='),
    );
    expect(refreshedResponse.body.downloadUrl).not.toBe(
      firstResponse.body.downloadUrl,
    );
    expect(
      new Date(refreshedResponse.body.expiresAt).getTime(),
    ).toBeGreaterThan(new Date(firstResponse.body.expiresAt).getTime());
  });

  it('returns 403 for private media download resolution without membership', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/uploads/chat-attachment/file')
      .set('authorization', `Bearer ${accessToken}`)
      .field('chatId', 'p1')
      .attach('file', Buffer.from('private-media-forbidden'), {
        filename: 'forbidden-note.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/media/${uploadResponse.body.assetId}/download-url`)
      .set('authorization', `Bearer ${peerAccessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('media_forbidden');
  });

  it('returns media payload for event stories with media asset', async () => {
    const eventId = `story-event-${Date.now()}`;
    const assetId = `story-asset-${Date.now()}`;
    const objectKey = `stories/user-me/${assetId}.png`;

    try {
      await prisma.event.create({
        data: {
          id: eventId,
          title: 'Story media event',
          emoji: '📸',
          startsAt: new Date('2026-04-24T18:00:00.000Z'),
          place: 'Покровка 7',
          distanceKm: 1.2,
          vibe: 'Легко',
          description: 'media story test',
          capacity: 10,
          hostId: 'user-me',
          participants: {
            create: [{ userId: 'user-me' }],
          },
        } as any,
      });

      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          ownerId: 'user-me',
          kind: 'story_media',
          status: 'ready',
          bucket: process.env.S3_BUCKET ?? 'big-break',
          objectKey,
          mimeType: 'image/png',
          byteSize: 1024,
          originalFileName: 'story.png',
          publicUrl: buildPublicAssetUrl(objectKey),
        } as any,
      });

      await prisma.eventStory.create({
        data: {
          eventId,
          authorId: 'user-me',
          caption: 'media story',
          emoji: '📷',
          mediaAssetId: assetId,
        } as any,
      });

      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}/stories`)
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            caption: 'media story',
            mediaKind: 'image',
            media: expect.objectContaining({
              id: assetId,
              visibility: 'private',
            }),
          }),
        ]),
      );
    } finally {
      await prisma.eventStory.deleteMany({
        where: { eventId },
      });
      await prisma.mediaAsset.deleteMany({
        where: { id: assetId },
      });
      await prisma.eventParticipant.deleteMany({
        where: { eventId },
      });
      await prisma.event.deleteMany({
        where: { id: eventId },
      });
    }
  });

});
