import { PostersService } from '../../src/services/posters.service';

describe('PostersService unit', () => {
  const makePoster = (
    id: string,
    overrides: Partial<{
      isFeatured: boolean;
      startsAt: Date;
    }> = {},
  ) => ({
    id,
    city: 'Москва',
    category: 'concert',
    title: `Poster ${id}`,
    emoji: '*',
    startsAt: overrides.startsAt ?? new Date('2026-05-01T20:00:00.000Z'),
    dateLabel: '1 мая',
    timeLabel: '20:00',
    venue: 'Venue',
    address: 'Address',
    distanceKm: 1.2,
    priceFrom: 1000,
    ticketUrl: null,
    provider: 'Provider',
    tone: 'calm',
    tags: [],
    description: 'Description',
    isFeatured: overrides.isFeatured ?? false,
    coverAsset: null,
  });

  it('normalizes long poster search queries before building contains filters', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PostersService({
      client: {
        poster: {
          findMany,
        },
      },
    } as any);

    await service.listPosters({
      q: `  ${'a'.repeat(100)}  `,
      limit: 20,
    });

    const query = findMany.mock.calls[0][0].where.OR[0].title.contains;
    expect(query).toHaveLength(64);
    expect(query).toBe('a'.repeat(64));
  });

  it('filters posters by ISO date', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PostersService({
      client: {
        poster: {
          findMany,
        },
      },
    } as any);

    await service.listPosters({
      date: '2026-05-03',
      limit: 20,
    } as any);

    expect(findMany.mock.calls[0][0].where.startsAt).toEqual({
      gte: new Date('2026-05-03T00:00:00.000Z'),
      lt: new Date('2026-05-04T00:00:00.000Z'),
    });
  });

  it('uses poster cursor payload without reading the cursor poster again', async () => {
    const firstPoster = makePoster('poster-1', {
      isFeatured: true,
      startsAt: new Date('2026-05-01T20:00:00.000Z'),
    });
    const secondPoster = makePoster('poster-2', {
      isFeatured: true,
      startsAt: new Date('2026-05-02T20:00:00.000Z'),
    });
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([firstPoster, secondPoster])
      .mockResolvedValueOnce([]);
    const findUnique = jest.fn().mockResolvedValue({
      id: firstPoster.id,
      isFeatured: firstPoster.isFeatured,
      startsAt: firstPoster.startsAt,
    });
    const service = new PostersService({
      client: {
        poster: {
          findMany,
          findUnique,
        },
      },
    } as any);

    const firstPage = await service.listPosters({ limit: 1 });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.listPosters({ cursor: firstPage.nextCursor!, limit: 1 });

    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany.mock.calls[1][0].where.AND[1]).toEqual({
      OR: [
        { isFeatured: false },
        {
          isFeatured: true,
          startsAt: {
            gt: firstPoster.startsAt,
          },
        },
        {
          isFeatured: true,
          startsAt: firstPoster.startsAt,
          id: {
            gt: firstPoster.id,
          },
        },
      ],
    });
  });
});
