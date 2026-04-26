import { runRetentionCleanup } from '../../src/retention-cleanup';

describe('runRetentionCleanup', () => {
  it('deletes retained tables in batches and skips realtime events', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'outbox-1' }, { id: 'outbox-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);
    const executeRaw = jest.fn().mockResolvedValue(2);

    const report = await runRetentionCleanup(
      {
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
      } as any,
      {
        batchSize: 2,
        now: new Date('2026-04-26T12:00:00.000Z'),
      },
    );

    expect(report.deletedByTask.get('outbox-done')).toBe(2);
    expect(report.skippedRealtimeEvents).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(6);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
