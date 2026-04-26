import { Prisma } from '@prisma/client';

export type HotQueryExplainParams = {
  userId: string;
  hostId: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  now?: Date;
  limit?: number;
  analyze?: boolean;
  includePostgis?: boolean;
};

export type HotQueryExplainTarget = {
  label: string;
  query: Prisma.Sql;
};

export type HotQueryExplainReport = {
  label: string;
  plan: unknown;
};

export type HotQueryPlanSummary = {
  nodeTypes: string[];
  relationNames: string[];
  indexNames: string[];
  seqScanRelations: string[];
  totalCost?: number;
  actualTotalTimeMs?: number;
};

type HotQueryExplainClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
};

type ExplainRow = {
  'QUERY PLAN': unknown;
};

const DEFAULT_LIMIT = 100;
const EVENT_STARTING_WINDOW_MS = 30 * 60 * 1000;
const SUBSCRIPTION_EXPIRING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const PROCESSING_STALE_AFTER_MS = 5 * 60 * 1000;

export function buildHotQueryExplainTargets(
  params: HotQueryExplainParams,
): HotQueryExplainTarget[] {
  const now = params.now ?? new Date();
  const limit = resolvePositiveInteger(params.limit, DEFAULT_LIMIT);
  const eventStartingWindowEnd = new Date(now.getTime() + EVENT_STARTING_WINDOW_MS);
  const subscriptionWindowEnd = new Date(
    now.getTime() + SUBSCRIPTION_EXPIRING_WINDOW_MS,
  );
  const staleProcessingBefore = new Date(now.getTime() - PROCESSING_STALE_AFTER_MS);
  const radiusMeters = Math.max(1, params.radiusKm) * 1000;

  const targets: HotQueryExplainTarget[] = [
    {
      label: 'chat-list-counter-read',
      query: Prisma.sql`
        SELECT cm."chatId", cm."unreadCount"
        FROM "ChatMember" cm
        WHERE cm."userId" = ${params.userId}
        ORDER BY cm."chatId" ASC
        LIMIT ${limit}
      `,
    },
    {
      label: 'chat-list-count-fallback',
      query: Prisma.sql`
        SELECT cm."chatId", COUNT(m."id") AS unread_count
        FROM "ChatMember" cm
        LEFT JOIN "Message" last_read
          ON last_read."id" = cm."lastReadMessageId"
        LEFT JOIN "Message" m
          ON m."chatId" = cm."chatId"
          AND m."senderId" <> cm."userId"
          AND (
            cm."lastReadMessageId" IS NULL
            OR m."createdAt" > last_read."createdAt"
            OR (
              m."createdAt" = last_read."createdAt"
              AND m."id" > last_read."id"
            )
          )
        WHERE cm."userId" = ${params.userId}
        GROUP BY cm."chatId"
        ORDER BY cm."chatId" ASC
        LIMIT ${limit}
      `,
    },
    {
      label: 'host-dashboard-stats',
      query: Prisma.sql`
        SELECT
          COUNT(e."id") AS meetups_count,
          COALESCE(
            ROUND(
              AVG(
                COALESCE(participants."participantCount", 0)::numeric
                / GREATEST(e."capacity", 1)
              ) * 100
            ),
            0
          ) AS fill_rate
        FROM "Event" e
        LEFT JOIN LATERAL (
          SELECT COUNT(ep."id") AS "participantCount"
          FROM "EventParticipant" ep
          WHERE ep."eventId" = e."id"
        ) participants ON true
        WHERE e."hostId" = ${params.hostId}
      `,
    },
    {
      label: 'outbox-batch-candidate-scan',
      query: Prisma.sql`
        SELECT "id"
        FROM "OutboxEvent"
        WHERE (
          "status" = 'pending'::"OutboxStatus"
          AND "availableAt" <= ${now}
        )
        OR (
          "status" = 'processing'::"OutboxStatus"
          AND "lockedAt" <= ${staleProcessingBefore}
        )
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT ${limit}
      `,
    },
    {
      label: 'event-starting-scan',
      query: Prisma.sql`
        SELECT
          ep."userId" AS user_id,
          e."id" AS event_id,
          e."startsAt" AS starts_at
        FROM "Event" e
        JOIN "EventParticipant" ep ON ep."eventId" = e."id"
        WHERE e."startsAt" > ${now}
          AND e."startsAt" <= ${eventStartingWindowEnd}
          AND NOT EXISTS (
            SELECT 1
            FROM "Notification" n
            WHERE n."dedupeKey" = CONCAT(
              'event_starting:',
              e."id",
              ':',
              ep."userId",
              ':30m'
            )
          )
        ORDER BY e."startsAt" ASC, e."id" ASC, ep."userId" ASC
        LIMIT ${limit}
      `,
    },
    {
      label: 'subscription-expiring-scan',
      query: Prisma.sql`
        SELECT
          us."userId" AS user_id,
          us."id" AS subscription_id,
          COALESCE(us."trialEndsAt", us."renewsAt") AS ends_at
        FROM "UserSubscription" us
        WHERE (
          (
            us."status" = 'trial'::"SubscriptionStatus"
            AND us."trialEndsAt" > ${now}
            AND us."trialEndsAt" <= ${subscriptionWindowEnd}
          )
          OR (
            us."status" IN (
              'active'::"SubscriptionStatus",
              'canceled'::"SubscriptionStatus"
            )
            AND us."renewsAt" > ${now}
            AND us."renewsAt" <= ${subscriptionWindowEnd}
          )
        )
          AND NOT EXISTS (
            SELECT 1
            FROM "Notification" n
            WHERE n."dedupeKey" = CONCAT('subscription_expiring:', us."id", ':3d')
          )
        ORDER BY ends_at ASC, us."id" ASC
        LIMIT ${limit}
      `,
    },
  ];

  if (params.includePostgis) {
    const point = Prisma.sql`
      ST_SetSRID(
        ST_MakePoint(${params.longitude}, ${params.latitude}),
        4326
      )::geography
    `;

    targets.push({
      label: 'event-postgis-feed-scan',
      query: Prisma.sql`
        SELECT
          e."id",
          ST_Distance(e."geo", ${point}) AS distance_m
        FROM "Event" e
        WHERE e."geo" IS NOT NULL
          AND e."startsAt" >= ${now}
          AND ST_DWithin(e."geo", ${point}, ${radiusMeters})
        ORDER BY distance_m ASC, e."startsAt" ASC, e."id" ASC
        LIMIT ${limit}
      `,
    });
  }

  return targets;
}

export function buildExplainQuery(
  target: HotQueryExplainTarget,
  options: { analyze?: boolean } = {},
) {
  const explainOptions = options.analyze
    ? Prisma.raw('ANALYZE, BUFFERS, FORMAT JSON')
    : Prisma.raw('BUFFERS, FORMAT JSON');

  return Prisma.sql`EXPLAIN (${explainOptions}) ${target.query}`;
}

export async function runHotQueryExplain(
  client: HotQueryExplainClient,
  params: HotQueryExplainParams,
): Promise<HotQueryExplainReport[]> {
  const reports: HotQueryExplainReport[] = [];
  const targets = buildHotQueryExplainTargets(params);

  for (const target of targets) {
    const rows = await client.$queryRaw<ExplainRow[]>(
      buildExplainQuery(target, { analyze: params.analyze }),
    );

    reports.push({
      label: target.label,
      plan: rows[0]?.['QUERY PLAN'] ?? rows,
    });
  }

  return reports;
}

export function summarizeHotQueryPlan(plan: unknown): HotQueryPlanSummary {
  const root = getRootPlanNode(plan);
  const summary: HotQueryPlanSummary = {
    nodeTypes: [],
    relationNames: [],
    indexNames: [],
    seqScanRelations: [],
  };

  if (root == null) {
    return summary;
  }

  walkPlanNode(root, summary);

  return summary;
}

export function formatHotQueryPlanSummary(summary: HotQueryPlanSummary) {
  return [
    `nodes=${summary.nodeTypes.join('>') || 'none'}`,
    `relations=${summary.relationNames.join(',') || 'none'}`,
    `indexes=${summary.indexNames.join(',') || 'none'}`,
    `seqScans=${summary.seqScanRelations.join(',') || 'none'}`,
    `totalCost=${formatOptionalNumber(summary.totalCost)}`,
    `actualMs=${formatOptionalNumber(summary.actualTotalTimeMs)}`,
  ].join(' ');
}

function resolvePositiveInteger(raw: number | undefined, fallback: number) {
  if (raw == null || !Number.isFinite(raw)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(raw));
}

function getRootPlanNode(plan: unknown): Record<string, unknown> | null {
  const root = Array.isArray(plan) ? plan[0] : plan;

  if (!isRecord(root)) {
    return null;
  }

  const nestedPlan = root.Plan;
  if (isRecord(nestedPlan)) {
    return nestedPlan;
  }

  return root;
}

function walkPlanNode(node: Record<string, unknown>, summary: HotQueryPlanSummary) {
  const nodeType = readString(node, 'Node Type');
  const relationName = readString(node, 'Relation Name');
  const indexName = readString(node, 'Index Name');

  addUnique(summary.nodeTypes, nodeType);
  addUnique(summary.relationNames, relationName);
  addUnique(summary.indexNames, indexName);

  if (nodeType === 'Seq Scan') {
    addUnique(summary.seqScanRelations, relationName ?? 'unknown');
  }

  const totalCost = readNumber(node, 'Total Cost');
  if (totalCost != null) {
    summary.totalCost = Math.max(summary.totalCost ?? 0, totalCost);
  }

  const actualTotalTime = readNumber(node, 'Actual Total Time');
  if (actualTotalTime != null) {
    summary.actualTotalTimeMs = Math.max(
      summary.actualTotalTimeMs ?? 0,
      actualTotalTime,
    );
  }

  const children = node.Plans;
  if (!Array.isArray(children)) {
    return;
  }

  for (const child of children) {
    if (isRecord(child)) {
      walkPlanNode(child, summary);
    }
  }
}

function addUnique(values: string[], value: string | undefined) {
  if (value != null && !values.includes(value)) {
    values.push(value);
  }
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function formatOptionalNumber(value: number | undefined) {
  return value == null ? 'n/a' : value.toFixed(2);
}
