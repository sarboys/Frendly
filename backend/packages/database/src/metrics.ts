import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

const registry = new Registry();

collectDefaultMetrics({
  prefix: 'frendly_process_',
  register: registry,
});

const secondsBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const byteBuckets = [128, 512, 1024, 4096, 16384, 65536, 262144, 1048576, 5242880];

const httpRequestDurationSeconds = new Histogram({
  name: 'frendly_http_request_duration_seconds',
  help: 'HTTP request duration by service, method, normalized endpoint and status class.',
  labelNames: ['service', 'method', 'endpoint', 'status_class'],
  buckets: secondsBuckets,
  registers: [registry],
});

const httpResponsePayloadBytes = new Histogram({
  name: 'frendly_http_response_payload_bytes',
  help: 'HTTP response payload size by service, method, normalized endpoint and status class.',
  labelNames: ['service', 'method', 'endpoint', 'status_class'],
  buckets: byteBuckets,
  registers: [registry],
});

const dbQueryTotal = new Counter({
  name: 'frendly_db_query_total',
  help: 'Database query count by service.',
  labelNames: ['service'],
  registers: [registry],
});

const dbQueryDurationSeconds = new Histogram({
  name: 'frendly_db_query_duration_seconds',
  help: 'Database query duration by service.',
  labelNames: ['service'],
  buckets: secondsBuckets,
  registers: [registry],
});

const redisPublishTotal = new Counter({
  name: 'frendly_redis_publish_total',
  help: 'Redis publish attempts by service, event type and status.',
  labelNames: ['service', 'event_type', 'status'],
  registers: [registry],
});

const redisSubscribeTotal = new Counter({
  name: 'frendly_redis_subscribe_total',
  help: 'Redis subscriber events by service, event type and status.',
  labelNames: ['service', 'event_type', 'status'],
  registers: [registry],
});

const websocketActiveConnections = new Gauge({
  name: 'frendly_websocket_active_connections',
  help: 'Active WebSocket connections by service.',
  labelNames: ['service'],
  registers: [registry],
});

const websocketAuthenticatedConnections = new Gauge({
  name: 'frendly_websocket_authenticated_connections',
  help: 'Authenticated WebSocket connections by service.',
  labelNames: ['service'],
  registers: [registry],
});

const websocketSubscribedRooms = new Gauge({
  name: 'frendly_websocket_subscribed_rooms',
  help: 'Subscribed WebSocket chat rooms by service.',
  labelNames: ['service'],
  registers: [registry],
});

const websocketInboundTotal = new Counter({
  name: 'frendly_websocket_inbound_total',
  help: 'Inbound WebSocket messages by service, event type and status.',
  labelNames: ['service', 'event_type', 'status'],
  registers: [registry],
});

const websocketOutboundTotal = new Counter({
  name: 'frendly_websocket_outbound_total',
  help: 'Outbound WebSocket messages by service, event type and status.',
  labelNames: ['service', 'event_type', 'status'],
  registers: [registry],
});

const websocketDroppedTotal = new Counter({
  name: 'frendly_websocket_dropped_total',
  help: 'Dropped WebSocket sends by service, event type and reason.',
  labelNames: ['service', 'event_type', 'reason'],
  registers: [registry],
});

const websocketSyncRequestsTotal = new Counter({
  name: 'frendly_websocket_sync_requests_total',
  help: 'WebSocket sync requests by service and status.',
  labelNames: ['service', 'status'],
  registers: [registry],
});

const websocketMembershipCacheTotal = new Counter({
  name: 'frendly_websocket_membership_cache_total',
  help: 'WebSocket membership cache lookups by service and status.',
  labelNames: ['service', 'status'],
  registers: [registry],
});

const workerOutboxPending = new Gauge({
  name: 'frendly_worker_outbox_pending',
  help: 'Pending outbox events by service and event type.',
  labelNames: ['service', 'event_type'],
  registers: [registry],
});

const workerOutboxLagSeconds = new Gauge({
  name: 'frendly_worker_outbox_lag_seconds',
  help: 'Oldest pending outbox age by service and event type.',
  labelNames: ['service', 'event_type'],
  registers: [registry],
});

const workerJobDurationSeconds = new Histogram({
  name: 'frendly_worker_job_duration_seconds',
  help: 'Worker job duration by service, job type and status.',
  labelNames: ['service', 'job_type', 'status'],
  buckets: secondsBuckets,
  registers: [registry],
});

const workerJobRetriesTotal = new Counter({
  name: 'frendly_worker_job_retries_total',
  help: 'Worker job retry count by service and job type.',
  labelNames: ['service', 'job_type'],
  registers: [registry],
});

const workerPermanentFailuresTotal = new Counter({
  name: 'frendly_worker_permanent_failures_total',
  help: 'Worker permanent failure count by service and job type.',
  labelNames: ['service', 'job_type'],
  registers: [registry],
});

const s3OperationTotal = new Counter({
  name: 'frendly_s3_operation_total',
  help: 'S3 operation count by service, operation and status.',
  labelNames: ['service', 'operation', 'status'],
  registers: [registry],
});

const s3OperationDurationSeconds = new Histogram({
  name: 'frendly_s3_operation_duration_seconds',
  help: 'S3 operation duration by service, operation and status.',
  labelNames: ['service', 'operation', 'status'],
  buckets: secondsBuckets,
  registers: [registry],
});

const payloadSizeBytes = new Histogram({
  name: 'frendly_payload_size_bytes',
  help: 'Payload size by service, event type and direction.',
  labelNames: ['service', 'event_type', 'direction'],
  buckets: byteBuckets,
  registers: [registry],
});

const payloadWarningTotal = new Counter({
  name: 'frendly_payload_warning_total',
  help: 'Payloads above warning threshold by service, event type and direction.',
  labelNames: ['service', 'event_type', 'direction'],
  registers: [registry],
});

type PrismaQueryEvent = {
  duration: number;
};

type PrismaQueryEmitter = {
  $on: (event: 'query', handler: (event: PrismaQueryEvent) => void) => void;
};

const prismaMetricBindings = new WeakMap<object, Set<string>>();

export const bindPrismaMetrics = <TClient extends object>(client: TClient, service: string): TClient => {
  const queryEmitter = client as TClient & PrismaQueryEmitter;
  if (typeof queryEmitter.$on !== 'function') {
    return client;
  }

  const boundServices = prismaMetricBindings.get(client) ?? new Set<string>();
  if (boundServices.has(service)) {
    return client;
  }

  boundServices.add(service);
  prismaMetricBindings.set(client, boundServices);

  queryEmitter.$on('query', (event) => {
    appMetrics.dbQueryTotal.inc({ service });
    appMetrics.dbQueryDurationSeconds.observe({ service }, event.duration / 1000);
  });

  return client;
};

export const appMetrics = {
  registry,
  httpRequestDurationSeconds,
  httpResponsePayloadBytes,
  dbQueryTotal,
  dbQueryDurationSeconds,
  redisPublishTotal,
  redisSubscribeTotal,
  websocketActiveConnections,
  websocketAuthenticatedConnections,
  websocketSubscribedRooms,
  websocketInboundTotal,
  websocketOutboundTotal,
  websocketDroppedTotal,
  websocketSyncRequestsTotal,
  websocketMembershipCacheTotal,
  workerOutboxPending,
  workerOutboxLagSeconds,
  workerJobDurationSeconds,
  workerJobRetriesTotal,
  workerPermanentFailuresTotal,
  s3OperationTotal,
  s3OperationDurationSeconds,
  payloadSizeBytes,
  payloadWarningTotal,
  reset: () => {
    registry.resetMetrics();
  },
};

export const getMetricsContentType = () => registry.contentType;

export const renderAppMetrics = () => registry.metrics();
