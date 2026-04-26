import {
  buildExplainQuery,
  buildHotQueryExplainTargets,
  formatHotQueryPlanSummary,
  runHotQueryExplain,
  summarizeHotQueryPlan,
} from '../../src/hot-query-explain';

describe('hot query explain helpers', () => {
  const baseParams = {
    userId: 'user-1',
    hostId: 'host-1',
    latitude: 55.75,
    longitude: 37.61,
    radiusKm: 25,
    now: new Date('2026-04-26T10:00:00.000Z'),
  };

  it('builds the default hot query target set without PostGIS', () => {
    const targets = buildHotQueryExplainTargets(baseParams);

    expect(targets.map((target) => target.label)).toEqual([
      'chat-list-counter-read',
      'chat-list-count-fallback',
      'host-dashboard-stats',
      'outbox-batch-candidate-scan',
      'event-starting-scan',
      'subscription-expiring-scan',
    ]);
  });

  it('adds the PostGIS feed target only when requested', () => {
    const targets = buildHotQueryExplainTargets({
      ...baseParams,
      includePostgis: true,
    });

    expect(targets.map((target) => target.label)).toContain(
      'event-postgis-feed-scan',
    );
  });

  it('keeps ANALYZE disabled unless the caller opts in', () => {
    const target = buildHotQueryExplainTargets(baseParams)[0]!;

    expect(buildExplainQuery(target, { analyze: false }).strings[0]).toContain(
      'EXPLAIN (BUFFERS, FORMAT JSON)',
    );
    expect(buildExplainQuery(target, { analyze: true }).strings[0]).toContain(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)',
    );
  });

  it('runs explain for every target and returns plans by label', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ 'QUERY PLAN': [{ Plan: {} }] }]);

    const reports = await runHotQueryExplain(
      {
        $queryRaw: queryRaw,
      },
      {
        ...baseParams,
        includePostgis: false,
        analyze: false,
      },
    );

    expect(queryRaw).toHaveBeenCalledTimes(6);
    expect(reports).toEqual(
      expect.arrayContaining([
        {
          label: 'host-dashboard-stats',
          plan: [{ Plan: {} }],
        },
      ]),
    );
  });

  it('summarizes plan nodes, indexes and seq scans', () => {
    const summary = summarizeHotQueryPlan([
      {
        Plan: {
          'Node Type': 'Nested Loop',
          'Total Cost': 42.5,
          'Actual Total Time': 3.7,
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'Message',
            },
            {
              'Node Type': 'Index Scan',
              'Relation Name': 'ChatMember',
              'Index Name': 'ChatMember_userId_chatId_idx',
            },
          ],
        },
      },
    ]);

    expect(summary).toEqual({
      nodeTypes: ['Nested Loop', 'Seq Scan', 'Index Scan'],
      relationNames: ['Message', 'ChatMember'],
      indexNames: ['ChatMember_userId_chatId_idx'],
      seqScanRelations: ['Message'],
      totalCost: 42.5,
      actualTotalTimeMs: 3.7,
    });
    expect(formatHotQueryPlanSummary(summary)).toContain('seqScans=Message');
    expect(formatHotQueryPlanSummary(summary)).toContain(
      'indexes=ChatMember_userId_chatId_idx',
    );
  });
});
