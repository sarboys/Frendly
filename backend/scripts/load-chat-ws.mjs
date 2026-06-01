#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1';
const DEFAULT_CONNECT_TIMEOUT_MS = 15000;
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

export function parseArgs(argv) {
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

  const baseUrl = args.get('base-url') ?? DEFAULT_BASE_URL;
  return {
    baseUrl,
    wsUrl: args.get('ws-url') ?? deriveWsUrl(baseUrl),
    connections: positiveInt(args.get('connections'), 1000),
    connectRate: positiveInt(args.get('connect-rate'), 200),
    connectConcurrency: positiveInt(args.get('connect-concurrency'), 200),
    holdSeconds: positiveInt(args.get('hold-seconds'), 30),
    users: Math.min(positiveInt(args.get('users'), 6), TEST_PHONES.length),
    subscribe: args.get('subscribe') !== 'false',
    prepare: args.get('prepare') !== 'false',
    eventsRps: positiveInt(args.get('events-rps'), 0),
    eventsSeconds: positiveInt(args.get('events-seconds'), 30),
    eventDrainSeconds: positiveInt(args.get('event-drain-seconds'), 2),
    eventType: args.get('event-type') ?? 'typing',
    eventSenders: positiveInt(args.get('event-senders'), 0),
    eventSendersUnsubscribe: args.get('event-senders-unsubscribe') === 'true',
    sendBufferDrainMs: positiveInt(args.get('send-buffer-drain-ms'), 5000),
    receiveMode: parseReceiveMode(args.get('receive-mode')),
    closeMode: parseCloseMode(args.get('close-mode')),
    timeoutMs: positiveInt(args.get('timeout-ms'), DEFAULT_CONNECT_TIMEOUT_MS),
    reportEvery: positiveInt(args.get('report-every'), 1000),
  };
}

function deriveWsUrl(baseUrl) {
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
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function parseReceiveMode(value) {
  return value === 'senders' ? 'senders' : 'all';
}

function parseCloseMode(value) {
  return value === 'terminate' ? 'terminate' : 'close';
}

export function resolveEventSockets(config, sockets) {
  if (config.eventSenders <= 0 || config.eventSenders >= sockets.length) {
    return sockets;
  }
  return sockets.slice(0, config.eventSenders);
}

export function eventSocketBufferStats(sockets) {
  let bytes = 0;
  let maxBytes = 0;
  let bufferedSockets = 0;
  for (const entry of sockets) {
    const bufferedAmount = Number(entry.socket?.bufferedAmount ?? 0);
    if (!Number.isFinite(bufferedAmount) || bufferedAmount <= 0) {
      continue;
    }
    bytes += bufferedAmount;
    maxBytes = Math.max(maxBytes, bufferedAmount);
    bufferedSockets += 1;
  }
  return { bytes, sockets: bufferedSockets, maxBytes };
}

export function eventSendTiming(sent, elapsedMs) {
  const roundedElapsedMs = Math.max(0, Math.round(elapsedMs));
  if (sent <= 0 || roundedElapsedMs <= 0) {
    return { sendElapsedMs: roundedElapsedMs, actualSendRps: 0 };
  }
  return {
    sendElapsedMs: roundedElapsedMs,
    actualSendRps: Math.round((sent / roundedElapsedMs) * 1000),
  };
}

export function createClientMessageId(runId, index) {
  return `load-${runId}-${index}`;
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

async function getWebSocketCtor() {
  try {
    const module = await import('ws');
    return module.default;
  } catch {
    try {
      const module = await import(new URL('../apps/chat/node_modules/ws/wrapper.mjs', import.meta.url));
      return module.default;
    } catch {}
    if (globalThis.WebSocket) {
      return globalThis.WebSocket;
    }
    throw new Error('WebSocket is unavailable. Use Node 22+ or install ws where this script runs.');
  }
}

function addSocketListener(socket, event, listener) {
  if (typeof socket.addEventListener === 'function') {
    socket.addEventListener(event, listener);
    return;
  }
  socket.on?.(event, listener);
}

function removeSocketListener(socket, event, listener) {
  if (typeof socket.removeEventListener === 'function') {
    socket.removeEventListener(event, listener);
    return;
  }
  socket.off?.(event, listener);
}

function socketSend(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function parseSocketData(message) {
  const raw = message?.data ?? message;
  return JSON.parse(raw.toString());
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body == null ? {} : { 'content-type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  return {
    response,
    body: text.length > 0 ? JSON.parse(text) : null,
  };
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
    users.push({ userId: body.userId, token: body.accessToken });
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

async function ensureDirectChats(config, users) {
  const directChats = [];
  if (!config.prepare) {
    return directChats;
  }
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
      directChats.push({ user, chatId: body.id });
    }
  }
  return directChats;
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
  return Array.isArray(body?.items)
    ? body.items.map((item) => ({ user, chatId: item.id }))
    : [];
}

async function buildTargets(config, users) {
  const directPairs = await ensureDirectChats(config, users);
  const listed = [];
  for (const user of users) {
    const [meetup, direct, community] = await Promise.all([
      listChats(config, user, 'meetup'),
      listChats(config, user, 'direct'),
      listChats(config, user, 'community'),
    ]);
    listed.push(...meetup, ...direct, ...community);
  }

  const byKey = new Map();
  for (const target of [...directPairs, ...listed]) {
    byKey.set(`${target.user.userId}:${target.chatId}`, target);
  }
  return [...byKey.values()];
}

function waitForSocketMessage(socket, predicate, timeoutMs) {
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
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      removeSocketListener(socket, 'message', onMessage);
      removeSocketListener(socket, 'error', onError);
    };
    addSocketListener(socket, 'message', onMessage);
    addSocketListener(socket, 'error', onError);
  });
}

async function openSocket(wsUrl, timeoutMs) {
  const WebSocket = await getWebSocketCtor();
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, [], {
      handshakeTimeout: timeoutMs,
      perMessageDeflate: false,
    });
    const timer = setTimeout(() => {
      cleanup();
      try {
        socket.on?.('error', () => {});
        socket.addEventListener?.('error', () => {});
        socket.close();
      } catch {}
      reject(new Error('open timeout'));
    }, timeoutMs);
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      removeSocketListener(socket, 'open', onOpen);
      removeSocketListener(socket, 'error', onError);
    };
    addSocketListener(socket, 'open', onOpen);
    addSocketListener(socket, 'error', onError);
  });
}

async function connectOne(config, target, stats) {
  const startedAt = performance.now();
  const socket = await openSocket(config.wsUrl, config.timeoutMs);
  socket.on?.('error', () => {});
  socket.addEventListener?.('error', () => {});
  socketSend(socket, {
    type: 'session.authenticate',
    payload: { accessToken: target.user.token },
  });
  await waitForSocketMessage(
    socket,
    (event) => event.type === 'session.authenticated',
    config.timeoutMs,
  );
  if (config.subscribe) {
    socketSend(socket, {
      type: 'chat.subscribe',
      payload: { chatId: target.chatId },
    });
    await waitForSocketMessage(
      socket,
      (event) => event.type === 'chat.updated' && event.payload?.chatId === target.chatId,
      config.timeoutMs,
    );
  }
  stats.connectLatencies.push(performance.now() - startedAt);
  return {
    socket,
    userId: target.user.userId,
    chatId: target.chatId,
    typingState: false,
  };
}

async function openConnections(config, targets) {
  const sockets = [];
  const stats = {
    attempted: 0,
    connected: 0,
    failed: 0,
    failReasons: {},
    connectLatencies: [],
  };
  const running = new Set();
  const startedAt = performance.now();
  const intervalMs = config.connectRate > 0 ? 1000 / config.connectRate : 0;

  for (let index = 0; index < config.connections; index += 1) {
    while (running.size >= config.connectConcurrency) {
      await Promise.race(running);
    }
    if (intervalMs > 0) {
      const dueAt = startedAt + index * intervalMs;
      const waitMs = dueAt - performance.now();
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }
    stats.attempted += 1;
    const target = targets[index % targets.length];
    const task = connectOne(config, target, stats)
      .then((entry) => {
        sockets.push(entry);
        stats.connected += 1;
        if (stats.connected % config.reportEvery === 0) {
          console.log(JSON.stringify({
            phase: 'connect-progress',
            connected: stats.connected,
            failed: stats.failed,
          }));
        }
      })
      .catch((error) => {
        stats.failed += 1;
        const reason = error instanceof Error ? error.message : 'unknown';
        stats.failReasons[reason] = (stats.failReasons[reason] ?? 0) + 1;
      })
      .finally(() => running.delete(task));
    running.add(task);
  }
  await Promise.allSettled(running);

  return { sockets, stats };
}

async function runEvents(config, sockets) {
  const stats = {
    sent: 0,
    sendErrors: 0,
    received: 0,
    messageAcks: 0,
    messagePending: 0,
    errors: 0,
    errorCodes: {},
    errorMessages: {},
  };
  if (config.eventsRps <= 0 || config.eventsSeconds <= 0 || sockets.length === 0) {
    return stats;
  }

  const pendingMessageIds = new Set();
  const eventSockets = resolveEventSockets(config, sockets);
  if (config.eventSendersUnsubscribe) {
    for (const entry of eventSockets) {
      try {
        socketSend(entry.socket, {
          type: 'chat.unsubscribe',
          payload: { chatId: entry.chatId },
        });
      } catch {}
    }
    await sleep(500);
  }
  const handlerSockets = config.receiveMode === 'senders' ? eventSockets : sockets;
  const handlers = handlerSockets.map((entry) => {
    const handler = (message) => {
      try {
        const event = parseSocketData(message);
        if (event.type === 'typing.changed' || event.type === 'message.created') {
          stats.received += 1;
          if (
            config.eventType === 'message' &&
            event.type === 'message.created' &&
            typeof event.payload?.clientMessageId === 'string' &&
            pendingMessageIds.delete(event.payload.clientMessageId)
          ) {
            stats.messageAcks += 1;
          }
        } else if (event.type === 'error') {
          stats.errors += 1;
          const code = event.payload?.code ?? 'unknown';
          const message = event.payload?.message ?? 'unknown';
          stats.errorCodes[code] = (stats.errorCodes[code] ?? 0) + 1;
          stats.errorMessages[message] = (stats.errorMessages[message] ?? 0) + 1;
        }
      } catch {}
    };
    addSocketListener(entry.socket, 'message', handler);
    return { socket: entry.socket, handler };
  });

  const total = config.eventsRps * config.eventsSeconds;
  const intervalMs = 1000 / config.eventsRps;
  const runId = randomUUID();
  const sendStartedAt = performance.now();
  let nextDueAt = performance.now();

  for (let index = 0; index < total; index += 1) {
    const waitMs = nextDueAt - performance.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextDueAt = Math.max(nextDueAt + intervalMs, performance.now());
    const entry = eventSockets[index % eventSockets.length];
    const clientMessageId = createClientMessageId(runId, index);
    try {
      if (config.eventType === 'message') {
        pendingMessageIds.add(clientMessageId);
        socketSend(entry.socket, {
          type: 'message.send',
          payload: {
            chatId: entry.chatId,
            clientMessageId,
            text: `load message ${index}`,
          },
        });
      } else {
        entry.typingState = !entry.typingState;
        socketSend(entry.socket, {
          type: entry.typingState ? 'typing.start' : 'typing.stop',
          payload: {
            chatId: entry.chatId,
          },
        });
      }
      stats.sent += 1;
    } catch {
      pendingMessageIds.delete(clientMessageId);
      stats.sendErrors += 1;
    }
  }
  const sendTiming = eventSendTiming(stats.sent, performance.now() - sendStartedAt);
  Object.assign(stats, sendTiming);

  console.log(JSON.stringify({
    phase: 'events-sent',
    sent: stats.sent,
    sendElapsedMs: stats.sendElapsedMs,
    actualSendRps: stats.actualSendRps,
    sendErrors: stats.sendErrors,
    received: stats.received,
    messageAcks: stats.messageAcks,
    messagePending: pendingMessageIds.size,
    errors: stats.errors,
    sendBuffer: eventSocketBufferStats(eventSockets),
  }));

  const bufferDrainStartedAt = performance.now();
  let sendBuffer = eventSocketBufferStats(eventSockets);
  while (sendBuffer.bytes > 0 && performance.now() - bufferDrainStartedAt < config.sendBufferDrainMs) {
    await sleep(100);
    sendBuffer = eventSocketBufferStats(eventSockets);
  }
  console.log(JSON.stringify({
    phase: 'events-send-buffer-drained',
    elapsedMs: Math.round(performance.now() - bufferDrainStartedAt),
    sendBuffer,
  }));

  await sleep(config.eventDrainSeconds * 1000);
  stats.messagePending = pendingMessageIds.size;
  console.log(JSON.stringify({
    phase: 'events-drained',
    sent: stats.sent,
    sendElapsedMs: stats.sendElapsedMs,
    actualSendRps: stats.actualSendRps,
    sendErrors: stats.sendErrors,
    received: stats.received,
    messageAcks: stats.messageAcks,
    messagePending: stats.messagePending,
    errors: stats.errors,
    sendBuffer: eventSocketBufferStats(eventSockets),
  }));

  for (const { socket, handler } of handlers) {
    removeSocketListener(socket, 'message', handler);
  }
  return stats;
}

export function closeSockets(sockets, mode = 'close') {
  for (const entry of sockets) {
    try {
      if (mode === 'terminate' && typeof entry.socket.terminate === 'function') {
        entry.socket.terminate();
      } else {
        entry.socket.close();
      }
    } catch {}
  }
}

async function main() {
  const config = parseArgs(process.argv);
  const users = await loginUsers(config);
  const targets = await buildTargets(config, users);
  if (targets.length === 0) {
    throw new Error('no chat targets found for test users');
  }

  console.log(JSON.stringify({
    phase: 'matrix',
    users: users.length,
    targets: targets.length,
    subscribe: config.subscribe,
    connections: config.connections,
    eventsRps: config.eventsRps,
    eventsSeconds: config.eventsSeconds,
    eventType: config.eventType,
  }));

  const { sockets, stats } = await openConnections(config, targets);
  console.log(JSON.stringify({
    phase: 'connected',
    attempted: stats.attempted,
    connected: stats.connected,
    failed: stats.failed,
    failReasons: stats.failReasons,
    p50Ms: percentile(stats.connectLatencies, 50),
    p95Ms: percentile(stats.connectLatencies, 95),
    p99Ms: percentile(stats.connectLatencies, 99),
  }));

  const eventStats = await runEvents(config, sockets);
  if (config.holdSeconds > 0) {
    await sleep(config.holdSeconds * 1000);
  }
  const result = {
    phase: 'result',
    connections: {
      attempted: stats.attempted,
      connected: stats.connected,
      failed: stats.failed,
      failReasons: stats.failReasons,
      p50Ms: percentile(stats.connectLatencies, 50),
      p95Ms: percentile(stats.connectLatencies, 95),
      p99Ms: percentile(stats.connectLatencies, 99),
    },
    events: eventStats,
  };
  console.log(JSON.stringify(result, null, 2));
  closeSockets(sockets, config.closeMode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
}
