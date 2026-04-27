import { PostersService } from '../../src/services/posters.service';

describe('PostersService unit', () => {
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
});
