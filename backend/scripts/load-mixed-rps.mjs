#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const DEFAULT_CITY = '\u041c\u043e\u0441\u043a\u0432\u0430';

const endpointMix = [
  {
    name: 'events',
    weight: 40,
    path: (config) => `/events?${new URLSearchParams({
      city: config.city,
      limit: '20',
    })}`,
  },
  {
    name: 'dating-discover',
    weight: 15,
    path: () => '/dating/discover?limit=20',
  },
  {
    name: 'affiche-events',
    weight: 15,
    path: (config) => `/affiche/events?${new URLSearchParams({
      city: config.city,
      limit: '20',
    })}`,
  },
  {
    name: 'evening-route-templates',
    weight: 10,
    path: (config) => `/evening/route-templates?${new URLSearchParams({
      city: config.city,
      limit: '20',
    })}`,
  },
  {
    name: 'profile-me',
    weight: 10,
    path: () => '/profile/me',
  },
  {
    name: 'notifications-unread-count',
    weight: 10,
    path: () => '/notifications/unread-count',
  },
];

function parseArgs(argv) {
  const args = new Map();

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = argv[index + 1];

    if (!key.startsWith('--')) {
      continue;
    }

    if (next == null || next.startsWith('--')) {
      args.set(key.slice(2), 'true');
      continue;
    }

    args.set(key.slice(2), next);
    index += 1;
  }

  const config = {
    api: args.get('api') ?? process.env.LOAD_API_URL,
    token: args.get('token') ?? process.env.LOAD_TOKEN,
    rps: parsePositiveInteger(args.get('rps'), 10),
    durationSeconds: parsePositiveInteger(args.get('duration'), 10),
    timeoutMs: parsePositiveInteger(args.get('timeout-ms'), 3000),
    connections: parsePositiveInteger(args.get('connections'), 1000),
    city: args.get('city') ?? DEFAULT_CITY,
  };

  if (!config.api) {
    throw new Error('Missing --api');
  }

  if (!config.token) {
    throw new Error('Missing --token');
  }

  return config;
}

function parsePositiveInteger(value, fallback) {
  if (value == null) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function pickEndpoint(requestIndex) {
  const bucket = requestIndex % 100;
  let cursor = 0;

  for (const endpoint of endpointMix) {
    cursor += endpoint.weight;
    if (bucket < cursor) {
      return endpoint;
    }
  }

  return endpointMix[endpointMix.length - 1];
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(
    values.length - 1,
    Math.ceil((p / 100) * values.length) - 1,
  );

  return Math.round(values[index]);
}

function createEndpointStats() {
  return {
    started: 0,
    completed: 0,
    ok: 0,
    errors: 0,
    timeouts: 0,
    latencies: [],
  };
}

function publicEndpointStats(stats) {
  const latencies = [...stats.latencies].sort((a, b) => a - b);

  return {
    started: stats.started,
    completed: stats.completed,
    ok: stats.ok,
    errors: stats.errors,
    timeouts: stats.timeouts,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
  };
}

function sleep(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createSlotWaiter() {
  const waiters = [];

  return {
    wait() {
      return new Promise((resolve) => waiters.push(resolve));
    },
    signal() {
      const resolve = waiters.shift();
      if (resolve) {
        resolve();
      }
    },
  };
}

async function runRequest(config, endpoint, statsByEndpoint, totals) {
  const stats = statsByEndpoint[endpoint.name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = performance.now();
  const url = new URL(endpoint.path(config), config.api);

  stats.started += 1;
  totals.startedRequests += 1;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${config.token}`,
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    stats.completed += 1;
    totals.completed += 1;

    if (response.ok) {
      stats.ok += 1;
      totals.ok += 1;
      await response.arrayBuffer();
      return;
    }

    stats.errors += 1;
    totals.errors += 1;
  } catch (error) {
    if (error?.name === 'AbortError') {
      stats.timeouts += 1;
      totals.timeouts += 1;
    } else {
      stats.errors += 1;
      totals.errors += 1;
    }
  } finally {
    clearTimeout(timeout);
    const latencyMs = performance.now() - startedAt;
    stats.latencies.push(Math.min(latencyMs, config.timeoutMs));
    totals.latencies.push(Math.min(latencyMs, config.timeoutMs));
  }
}

async function main() {
  const config = parseArgs(process.argv);
  const totalRequests = config.rps * config.durationSeconds;
  const intervalMs = 1000 / config.rps;
  const statsByEndpoint = Object.fromEntries(
    endpointMix.map((endpoint) => [endpoint.name, createEndpointStats()]),
  );
  const totals = {
    startedRequests: 0,
    completed: 0,
    ok: 0,
    errors: 0,
    timeouts: 0,
    latencies: [],
  };
  const slotWaiter = createSlotWaiter();
  const pending = [];
  let inFlight = 0;
  const startedAt = performance.now();

  for (let index = 0; index < totalRequests; index += 1) {
    const targetAt = startedAt + index * intervalMs;
    await sleep(targetAt - performance.now());

    while (inFlight >= config.connections) {
      await slotWaiter.wait();
    }

    const endpoint = pickEndpoint(index);
    inFlight += 1;
    const request = runRequest(config, endpoint, statsByEndpoint, totals)
      .finally(() => {
        inFlight -= 1;
        slotWaiter.signal();
      });
    pending.push(request);
  }

  await Promise.allSettled(pending);

  const latencies = [...totals.latencies].sort((a, b) => a - b);
  const byEndpoint = Object.fromEntries(
    Object.entries(statsByEndpoint).map(([name, stats]) => [
      name,
      publicEndpointStats(stats),
    ]),
  );

  console.log(JSON.stringify({
    targetRps: config.rps,
    durationSeconds: config.durationSeconds,
    startedRequests: totals.startedRequests,
    completed: totals.completed,
    ok: totals.ok,
    errors: totals.errors,
    timeouts: totals.timeouts,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    byEndpoint,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
