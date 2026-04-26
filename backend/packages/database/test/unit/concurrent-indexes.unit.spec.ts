import {
  createConcurrentIndexes,
  quotePostgresIdentifier,
} from '../../src/concurrent-indexes';

describe('createConcurrentIndexes', () => {
  it('drops invalid indexes before creating them again', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ is_invalid: true }]);
    const executeRawUnsafe = jest.fn().mockResolvedValue(0);

    await createConcurrentIndexes(
      {
        $queryRaw: queryRaw,
        $executeRawUnsafe: executeRawUnsafe,
      },
      [
        {
          name: 'Example_createdAt_id_idx',
          sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Example_createdAt_id_idx" ON "Example"("createdAt", "id")',
        },
      ],
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SET statement_timeout = 0',
    );
    expect(executeRawUnsafe).toHaveBeenNthCalledWith(
      2,
      "SET lock_timeout = '5s'",
    );
    expect(executeRawUnsafe).toHaveBeenNthCalledWith(
      3,
      'DROP INDEX CONCURRENTLY IF EXISTS "Example_createdAt_id_idx"',
    );
    expect(executeRawUnsafe).toHaveBeenNthCalledWith(
      4,
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Example_createdAt_id_idx" ON "Example"("createdAt", "id")',
    );
  });

  it('does not allow unsafe identifier text in index names', () => {
    expect(() => quotePostgresIdentifier('bad"; DROP TABLE "User"; --')).toThrow(
      'Unsafe PostgreSQL identifier',
    );
  });
});
