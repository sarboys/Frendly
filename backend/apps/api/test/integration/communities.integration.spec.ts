import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiAppModule } from '../../src/app.module';
import { PrismaService } from '../../src/services/prisma.service';

jest.setTimeout(30000);

describe('communities api flows', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken = '';
  let freeAccessToken = '';

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

    const freeLoginResponse = await request(app.getHttpServer())
      .post('/auth/dev/login')
      .send({ userId: 'user-anya' })
      .expect(201);

    freeAccessToken = freeLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.userSubscription.deleteMany({
      where: { id: 'community-test-subscription' },
    });
    await prisma.userSubscription.deleteMany({
      where: { userId: 'user-anya' },
    });
    await prisma.userSubscription.create({
      data: {
        id: 'community-test-subscription',
        userId: 'user-me',
        plan: 'month',
        status: 'active',
        startedAt: new Date(),
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialEndsAt: null,
      },
    });
  });

  afterEach(async () => {
    const createdCommunities = await prisma.community.findMany({
      where: { name: { startsWith: 'API Club ' } },
      select: { chatId: true },
    });
    const chatIds = createdCommunities.map((community) => community.chatId);

    await prisma.community.deleteMany({
      where: { name: { startsWith: 'API Club ' } },
    });
    if (chatIds.length > 0) {
      await prisma.chat.deleteMany({
        where: { id: { in: chatIds } },
      });
    }
    await prisma.userSubscription.deleteMany({
      where: { id: 'community-test-subscription' },
    });
  });

  it('returns lightweight community cards with chat id and bounded preview data', async () => {
    const response = await request(app.getHttpServer())
      .get('/communities?limit=2')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      id: 'c1',
      name: 'City Rituals',
      avatar: '🌿',
      privacy: 'public',
      chatId: expect.any(String),
      premiumOnly: true,
      unread: expect.any(Number),
    });
    expect(response.body.items[0].news.length).toBeLessThanOrEqual(2);
    expect(response.body.items[0].meetups.length).toBeLessThanOrEqual(2);
    expect(response.body.items[0].media.length).toBeLessThanOrEqual(4);
    expect(response.body.items[0].memberNames.length).toBeLessThanOrEqual(5);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it('returns full community detail for a visible community', async () => {
    const response = await request(app.getHttpServer())
      .get('/communities/c1')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'c1',
      name: 'City Rituals',
      chatId: expect.any(String),
      joined: true,
      isOwner: false,
      sharedMediaLabel: '68 фото и видео',
      nextMeetup: {
        id: 'cm1',
        title: 'Late brunch club',
      },
    });
    expect(response.body.socialLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Telegram',
          handle: '@sagecircle',
        }),
      ]),
    );
  });

  it('returns community media as cursor pages', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/communities/c1/media?limit=2')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.items[0]).toMatchObject({
      id: 'community-media-1',
      label: 'Roof dinner',
      kind: 'photo',
    });
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(`/communities/c1/media?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(2);
    expect(secondPage.body.items[0]).toMatchObject({
      id: 'community-media-3',
      label: 'Гид по локациям',
      kind: 'doc',
    });
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('rejects community creation without Frendly Plus access', async () => {
    const response = await request(app.getHttpServer())
      .post('/communities')
      .set('authorization', `Bearer ${freeAccessToken}`)
      .send({
        name: 'Free User Club',
        avatar: '🌿',
        description: 'Клуб без активной подписки',
        privacy: 'public',
        purpose: 'Городской клуб',
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('community_plus_required');
  });

  it('creates a community with its own chat for Frendly Plus users', async () => {
    const name = `API Club ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post('/communities')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name,
        avatar: '🎨',
        description: 'Новый клуб с отдельным быстрым чатом.',
        privacy: 'private',
        purpose: 'Городской клуб',
        socialLinks: [
          { label: 'Telegram', handle: '@api_club' },
          { label: 'Instagram', handle: '@api.club' },
          { label: 'TikTok', handle: '@api.club.live' },
        ],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name,
      avatar: '🎨',
      privacy: 'private',
      chatId: expect.any(String),
      joined: true,
      isOwner: true,
      members: 1,
      memberNames: [expect.any(String)],
    });

    await request(app.getHttpServer())
      .get(`/communities/${response.body.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('shows private communities to non-members while keeping request-only access', async () => {
    const name = `API Club Private ${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/communities')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name,
        avatar: '🍸',
        description: 'Закрытый клуб виден всем, вступление только по заявке.',
        privacy: 'private',
        purpose: 'Private dining',
        socialLinks: [],
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/communities')
      .set('authorization', `Bearer ${freeAccessToken}`)
      .expect(200);

    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          name,
          privacy: 'private',
          joined: false,
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/communities/${created.body.id}`)
      .set('authorization', `Bearer ${freeAccessToken}`)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: created.body.id,
      name,
      privacy: 'private',
      joined: false,
    });
  });

  it('lets the owner publish a community news item', async () => {
    const name = `API Club ${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/communities')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        name,
        avatar: '📣',
        description: 'Клуб для проверки публикаций.',
        privacy: 'public',
        purpose: 'Городской клуб',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/communities/${created.body.id}/news`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Новая программа',
        body: 'Открыли запись на воскресную встречу сообщества.',
        category: 'news',
        audience: 'all',
        pin: true,
        push: false,
      })
      .expect(201);

    expect(response.body.news[0]).toMatchObject({
      title: 'Новая программа',
      blurb: 'Открыли запись на воскресную встречу сообщества.',
      time: 'сейчас',
    });

    const saved = await prisma.communityNewsItem.findFirst({
      where: {
        communityId: created.body.id,
        title: 'Новая программа',
      },
    });

    expect(saved).toMatchObject({
      blurb: 'Открыли запись на воскресную встречу сообщества.',
      sortOrder: 0,
    });
  });

  it('rejects community news publishing for a non-owner', async () => {
    const response = await request(app.getHttpServer())
      .post('/communities/c1/news')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Чужая новость',
        body: 'Пользователь не владелец этого сообщества.',
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('community_owner_required');
  });
});
