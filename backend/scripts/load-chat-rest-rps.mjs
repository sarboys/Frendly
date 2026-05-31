#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const DEFAULT_BASE_URL = 'https://api.frendly.tech';
const DEFAULT_WS_URL = 'wss://api.frendly.tech/ws';
const TEST_PHONES = [
  '+70000000000',
  '+71111111111',
  '+72222222222',
  '+73333333333',
  '+74444444444',
  '+75555555555',
  '+76666666666',
  '+77777777777',
  '+78888888888',
  '+79999999999',
];

const profileWeights = [
  { name: 'meetup-list', weight: 25 },
  { name: 'personal-list', weight: 25 },
  { name: 'community-list', weight: 10 },
  { name: 'messages', weight: 30 },
  { name: 'read', weight: 10 },
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

  const baseUrl = args.get('base-url') ?? args.get('api') ?? DEFAULT_BASE_URL;
  return {
    baseUrl,
    wsUrl: args.get('ws-url') ?? deriveWsUrl(baseUrl),
    rps: positiveInt(args.get('rps'), 50),
    durationSeconds: positiveInt(args.get('duration'), 60),
    timeoutMs: positiveInt(args.get('timeout-ms'), 10000),
    users: Math.min(positiveInt(args.get('users'), 6), TEST_PHONES.length),
    only: args.get('only') ?? 'mixed',
    prepare: args.get('prepare') !== 'false',
  };
}

function deriveWsUrl(baseUrl) {
  if (baseUrl === DEFAULT_BASE_URL) {
    return DEFAULT_WS_URL;
  }
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

function positiveInt(value, fallback) {
  if (value == null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[index]);
}

function createStats() {
  return {
    started: 0,
    completed: 0,
    success: 0,
    timeouts: 0,
    networkErrors: 0,
    status: {},
    latencies: [],
  };
}

function statusClass(status) {
  return `${Math.trunc(status / 100)}xx`;
}

async function requestJson(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body == null ? {} : { 'content-type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;
  return { response, body };
}

async function loginUsers(config) {
  const users = [];
  for (const phoneNumber of TEST_PHONES.slice(0, config.users)) {
    const { response, body } = await requestJson(config.baseUrl, '/auth/phone/test-login', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
    if (!response.ok || !body?.accessToken || !body?.userId) {
      throw new Error(`test login failed status=${response.status}`);
    }
    users.push({
      userId: body.userId,
      token: body.accessToken,
    });
  }
  return users;
}

async function authedJson(config, user, path, options = {}) {
  return requestJson(config.baseUrl, path, {
    ...options,
    headers: {
      authorization: `Bearer ${user.token}`,
      ...(options.headers ?? {}),
    },
  });
}

async function listChats(config, user, kind) {
  const pathByKind = {
    meetup: '/chats/meetups?limit=20&includeSocial=false',
    direct: '/chats/personal?limit=20',
    community: '/chats/communities?limit=20',
  };
  const { response, body } = await authedJson(config, user, pathByKind[kind]);
  if (!response.ok) {
    return [];
  }
  return Array.isArray(body?.items) ? body.items : [];
}

async function ensureDirectChats(config, users) {
  const directChats = [];
  for (let index = 0; index < users.length - 1; index += 1) {
    const user = users[index];
    const peer = users[index + 1];
    const { response, body } = await authedJson(
      config,
      user,
      `/people/${encodeURIComponent(peer.userId)}/direct-chat`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (response.ok && body?.id) {
      directChats.push({
        chatId: body.id,
        user,
      });
    }
  }
  return directChats;
}

async function getMessages(config, user, chatId) {
  const { response, body } = await authedJson(
    config,
    user,
    `/chats/${encodeURIComponent(chatId)}/messages?limit=30`,
  );
  if (!response.ok) {
    return [];
  }
  return Array.isArray(body?.items) ? body.items : [];
}

async function getWebSocketCtor() {
  if (globalThis.WebSocket) {
    return globalThis.WebSocket;
  }
  const module = await import('ws');
  return module.default;
}

async function openSocket(wsUrl) {
  const WebSocket = await getWebSocketCtor();
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const cleanup = () => {
      socket.removeEventListener?.('open', onOpen);
      socket.removeEventListener?.('error', onError);
      socket.off?.('open', onOpen);
      socket.off?.('error', onError);
    };
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    socket.addEventListener?.('open', onOpen);
    socket.addEventListener?.('error', onError);
    socket.on?.('open', onOpen);
    socket.on?.('error', onError);
  });
}

function addMessageListener(socket, listener) {
  socket.addEventListener?.('message', listener);
  socket.on?.('message', listener);
}

function removeMessageListener(socket, listener) {
  socket.removeEventListener?.('message', listener);
  socket.off?.('message', listener);
}

function socketSend(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function parseSocketData(message) {
  const raw = message?.data ?? message;
  return JSON.parse(raw.toString());
}

function waitForSocketMessage(socket, predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('socket wait timeout'));
    }, timeoutMs);
    const onMessage = (message) => {
      let event;
      try {
        event = parseSocketData(message);
      } catch {
        return;
      }
      if (predicate(event)) {
        cleanup();
        resolve(event);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      removeMessageListener(socket, onMessage);
    };
    addMessageListener(socket, onMessage);
  });
}

async function sendWarmMessage(config, user, chatId) {
  const socket = await openSocket(config.wsUrl);
  try {
    socketSend(socket, {
      type: 'session.authenticate',
      payload: { accessToken: user.token },
    });
    await waitForSocketMessage(socket, (event) => event.type === 'session.authenticated');
    socketSend(socket, {
      type: 'chat.subscribe',
      payload: { chatId },
    });
    await waitForSocketMessage(socket, (event) => event.type === 'chat.updated');
    const clientMessageId = `load-chat-rest-warm-${Date.now()}`;
    socketSend(socket, {
      type: 'message.send',
      payload: {
        chatId,
        clientMessageId,
        text: 'load warm message',
      },
    });
    const event = await waitForSocketMessage(
      socket,
      (item) =>
        item.type === 'message.created' &&
        item.payload?.clientMessageId === clientMessageId,
    );
    return event.payload?.id ?? null;
  } finally {
    socket.close();
  }
}

async function buildMatrix(config, users) {
  const directPairs = config.prepare ? await ensureDirectChats(config, users) : [];
  const matrix = {
    users,
    meetupChats: [],
    directChats: [...directPairs],
    communityChats: [],
    messageTargets: [],
    readTargets: [],
    etags: new Map(),
  };

  for (const user of users) {
    const [meetup, direct, community] = await Promise.all([
      listChats(config, user, 'meetup'),
      listChats(config, user, 'direct'),
      listChats(config, user, 'community'),
    ]);
    matrix.meetupChats.push(...meetup.map((item) => ({ chatId: item.id, user })));
    matrix.directChats.push(...direct.map((item) => ({ chatId: item.id, user })));
    matrix.communityChats.push(...community.map((item) => ({ chatId: item.id, user })));
  }

  const chatTargets = [
    ...matrix.directChats,
    ...matrix.meetupChats,
    ...matrix.communityChats,
  ];
  for (const target of chatTargets.slice(0, Math.max(10, users.length))) {
    let messages = await getMessages(config, target.user, target.chatId);
    if (messages.length === 0 && config.prepare) {
      const messageId = await sendWarmMessage(config, target.user, target.chatId).catch(() => null);
      if (messageId) {
        messages = await getMessages(config, target.user, target.chatId);
      }
    }
    if (messages.length > 0) {
      matrix.messageTargets.push(target);
      matrix.readTargets.push({
        ...target,
        messageId: messages[messages.length - 1].id,
      });
    }
  }

  return matrix;
}

function pickWeighted(index, only) {
  if (only && only !== 'mixed') {
    return only;
  }
  const bucket = index % 100;
  let cursor = 0;
  for (const entry of profileWeights) {
    cursor += entry.weight;
    if (bucket < cursor) {
      return entry.name;
    }
  }
  return profileWeights[profileWeights.length - 1].name;
}

function pick(list, index) {
  if (list.length === 0) {
    return null;
  }
  return list[index % list.length];
}

function targetFor(matrix, endpointName, index) {
  if (endpointName === 'meetup-list') {
    return { user: matrix.users[index % matrix.users.length], path: '/chats/meetups?limit=20&includeSocial=false' };
  }
  if (endpointName === 'personal-list') {
    return { user: matrix.users[index % matrix.users.length], path: '/chats/personal?limit=20' };
  }
  if (endpointName === 'community-list') {
    return { user: matrix.users[index % matrix.users.length], path: '/chats/communities?limit=20' };
  }
  if (endpointName === 'messages') {
    const target = pick(matrix.messageTargets, index);
    return target == null
      ? null
      : { user: target.user, path: `/chats/${encodeURIComponent(target.chatId)}/messages?limit=30` };
  }
  if (endpointName === 'read') {
    const target = pick(matrix.readTargets, index);
    return target == null
      ? null
      : {
          user: target.user,
          path: `/chats/${encodeURIComponent(target.chatId)}/read`,
          method: 'POST',
          body: { messageId: target.messageId },
        };
  }
  return null;
}

async function runOne(config, matrix, endpointName, index, statsByEndpoint, totals) {
  const stats = statsByEndpoint[endpointName] ?? createStats();
  statsByEndpoint[endpointName] = stats;
  const target = targetFor(matrix, endpointName, index);
  stats.started += 1;
  totals.started += 1;
  if (target == null) {
    stats.networkErrors += 1;
    totals.networkErrors += 1;
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = performance.now();
  const etagKey = `${target.user.userId}:${target.path}`;
  const headers = {
    authorization: `Bearer ${target.user.token}`,
    accept: 'application/json',
  };
  const knownEtag = matrix.etags.get(etagKey);
  if (knownEtag && endpointName.endsWith('list')) {
    headers['if-none-match'] = knownEtag;
  }

  try {
    const response = await fetch(new URL(target.path, config.baseUrl), {
      method: target.method ?? 'GET',
      headers: {
        ...headers,
        ...(target.body ? { 'content-type': 'application/json' } : {}),
      },
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: controller.signal,
    });
    stats.completed += 1;
    totals.completed += 1;
    const className = statusClass(response.status);
    stats.status[className] = (stats.status[className] ?? 0) + 1;
    totals.status[className] = (totals.status[className] ?? 0) + 1;
    stats.status[response.status] = (stats.status[response.status] ?? 0) + 1;
    totals.status[response.status] = (totals.status[response.status] ?? 0) + 1;

    const etag = response.headers.get('etag');
    if (etag && endpointName.endsWith('list')) {
      matrix.etags.set(etagKey, etag);
    }

    if ((response.status >= 200 && response.status < 300) || response.status === 304) {
      stats.success += 1;
      totals.success += 1;
    }
    await response.arrayBuffer();
  } catch (error) {
    if (error?.name === 'AbortError') {
      stats.timeouts += 1;
      totals.timeouts += 1;
    } else {
      stats.networkErrors += 1;
      totals.networkErrors += 1;
    }
  } finally {
    clearTimeout(timeout);
    const latency = Math.min(performance.now() - startedAt, config.timeoutMs);
    stats.latencies.push(latency);
    totals.latencies.push(latency);
  }
}

function publicStats(stats) {
  return {
    started: stats.started,
    completed: stats.completed,
    success: stats.success,
    timeouts: stats.timeouts,
    networkErrors: stats.networkErrors,
    status: stats.status,
    p50Ms: percentile(stats.latencies, 50),
    p95Ms: percentile(stats.latencies, 95),
    p99Ms: percentile(stats.latencies, 99),
  };
}

async function main() {
  const config = parseArgs(process.argv);
  const users = await loginUsers(config);
  const matrix = await buildMatrix(config, users);
  if (matrix.users.length === 0) {
    throw new Error('no users loaded');
  }
  console.log(JSON.stringify({
    phase: 'matrix',
    users: matrix.users.length,
    meetupChats: matrix.meetupChats.length,
    directChats: matrix.directChats.length,
    communityChats: matrix.communityChats.length,
    messageTargets: matrix.messageTargets.length,
    readTargets: matrix.readTargets.length,
  }));

  const totalRequests = config.rps * config.durationSeconds;
  const intervalMs = 1000 / config.rps;
  const statsByEndpoint = {};
  const totals = createStats();
  const running = new Set();
  const startedAt = performance.now();

  for (let index = 0; index < totalRequests; index += 1) {
    const dueAt = startedAt + index * intervalMs;
    const waitMs = dueAt - performance.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    const endpointName = pickWeighted(index, config.only);
    const promise = runOne(config, matrix, endpointName, index, statsByEndpoint, totals)
      .finally(() => running.delete(promise));
    running.add(promise);
  }
  await Promise.allSettled(running);

  console.log(JSON.stringify({
    phase: 'result',
    config: {
      rps: config.rps,
      durationSeconds: config.durationSeconds,
      only: config.only,
    },
    totals: publicStats(totals),
    endpoints: Object.fromEntries(
      Object.entries(statsByEndpoint).map(([name, stats]) => [name, publicStats(stats)]),
    ),
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
