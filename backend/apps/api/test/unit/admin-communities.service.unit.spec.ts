import { AdminCommunitiesService } from '../../src/services/admin-communities.service';

const now = new Date('2026-05-05T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminCommunitiesService({ client } as any);
}

function communityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'community-1',
    name: 'Book club',
    avatar: '📚',
    privacy: 'public',
    partnerId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdById: 'owner-1',
    createdBy: {
      id: 'owner-1',
      displayName: 'Анна',
      profile: { city: 'Москва' },
    },
    partner: null,
    _count: {
      members: 1,
      news: 0,
      media: 0,
    },
    description: 'Books and coffee',
    tags: ['books'],
    joinRule: 'Открытое вступление',
    premiumOnly: false,
    mood: 'Calm',
    sharedMediaLabel: '0 медиа',
    chatId: 'chat-1',
    socialLinks: [],
    ...overrides,
  };
}

describe('AdminCommunitiesService unit', () => {
  it('passes list filters to Prisma', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      community: { findMany },
    });

    await service.listCommunities({
      q: ' books ',
      city: 'Москва',
      privacy: 'public',
      archived: 'false',
      partnerId: 'partner-1',
      createdFrom: '2026-01-01T00:00:00.000Z',
      createdTo: '2026-05-01T00:00:00.000Z',
      limit: '10',
    });

    const where = findMany.mock.calls[0][0].where;
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
        expect.objectContaining({ OR: expect.any(Array) }),
        { privacy: 'public' },
        { archivedAt: null },
        { partnerId: 'partner-1' },
        {
          createdAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-05-01T00:00:00.000Z'),
          },
        },
      ]),
    );
  });

  it('creates chat and owner member when creating community', async () => {
    const tx = {
      chat: { create: jest.fn().mockResolvedValue({ id: 'chat-1' }) },
      community: { create: jest.fn().mockResolvedValue({ id: 'community-1' }) },
      chatMember: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'owner-1' }) },
      community: { findUnique: jest.fn().mockResolvedValue(communityRow()) },
      $transaction: jest.fn((callback) => callback(tx)),
    });

    await service.createCommunity({
      ownerId: 'owner-1',
      name: 'Book club',
      description: 'Books and coffee',
    });

    expect(tx.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'community',
          origin: 'community',
          title: 'Book club',
        }),
      }),
    );
    expect(tx.community.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'owner-1',
          chatId: 'chat-1',
          members: {
            create: { userId: 'owner-1', role: 'owner' },
          },
        }),
      }),
    );
    expect(tx.chatMember.create).toHaveBeenCalledWith({
      data: { chatId: 'chat-1', userId: 'owner-1' },
    });
  });

  it('archives and restores community state', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'community-1' });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'community-1' })
      .mockResolvedValueOnce(communityRow({ archivedAt: now }))
      .mockResolvedValueOnce({ id: 'community-1' })
      .mockResolvedValueOnce(communityRow());
    const service = createService({
      community: { findUnique, update },
    });

    const archived = await service.archiveCommunity('community-1');
    const restored = await service.restoreCommunity('community-1');

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'community-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'community-1' },
      data: { archivedAt: null },
    });
    expect(archived.archivedAt).toBe(now.toISOString());
    expect(restored.archivedAt).toBeNull();
  });

  it('does not remove the last owner', async () => {
    const tx = jest.fn();
    const service = createService({
      community: {
        findUnique: jest.fn().mockResolvedValue({ id: 'community-1', chatId: 'chat-1' }),
      },
      communityMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'member-1',
          userId: 'owner-1',
          role: 'owner',
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: tx,
    });

    await expect(
      service.removeMember('community-1', 'member-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'admin_community_last_owner_forbidden',
    });
    expect(tx).not.toHaveBeenCalled();
  });

  it('updates member role', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      role: 'moderator',
      joinedAt: now,
    });
    const service = createService({
      communityMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'member-1',
          userId: 'user-1',
          role: 'member',
        }),
        update,
      },
    });

    const result = await service.updateMemberRole('community-1', 'member-1', {
      role: 'moderator',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { role: 'moderator' },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
    });
    expect(result.role).toBe('moderator');
    expect(result.joinedAt).toBe(now.toISOString());
  });

  it('performs news and media CRUD', async () => {
    const service = createService({
      community: { findUnique: jest.fn().mockResolvedValue({ id: 'community-1' }) },
      communityNewsItem: {
        findFirst: jest.fn().mockResolvedValue({ sortOrder: 1 }),
        create: jest.fn().mockResolvedValue({
          id: 'news-1',
          title: 'News',
          blurb: 'Body',
          timeLabel: 'сейчас',
          sortOrder: 2,
          createdAt: now,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      communityMediaItem: {
        findFirst: jest.fn().mockResolvedValue({ sortOrder: 3 }),
        create: jest.fn().mockResolvedValue({
          id: 'media-1',
          emoji: '📷',
          label: 'Photo',
          kind: 'photo',
          sortOrder: 4,
          createdAt: now,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });

    const news = await service.createNews('community-1', { title: 'News', blurb: 'Body' });
    await service.updateNews('community-1', 'news-1', { title: 'Updated' });
    await service.deleteNews('community-1', 'news-1');
    const media = await service.createMedia('community-1', { label: 'Photo' });
    await service.updateMedia('community-1', 'media-1', { label: 'Updated' });
    await service.deleteMedia('community-1', 'media-1');

    expect(news.sortOrder).toBe(2);
    expect(media.sortOrder).toBe(4);
  });
});
