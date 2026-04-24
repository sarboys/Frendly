#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT_MS = 15_000;
let websocketCtor;

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      positional.push(item);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return { scenario: positional[0], args };
}

function required(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing --${key}`);
  }
  return value;
}

function numberArg(args, key, fallback) {
  const value = args[key] == null ? fallback : Number(args[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid --${key}`);
  }
  return Math.max(1, Math.trunc(value));
}

function percentile(values, rank) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((rank / 100) * sorted.length) - 1,
  );
  return sorted[index];
}

function printStats(name, values) {
  console.log(JSON.stringify({
    scenario: name,
    count: values.length,
    minMs: Math.min(...values),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
    maxMs: Math.max(...values),
  }, null, 2));
}

async function runPool(total, concurrency, task) {
  let next = 0;
  const workerCount = Math.min(total, concurrency);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (next < total) {
        const current = next;
        next += 1;
        await task(current);
      }
    }),
  );
}

async function measureDatingDiscover(args) {
  const api = required(args, 'api').replace(/\/$/, '');
  const token = required(args, 'token');
  const requests = numberArg(args, 'requests', 100);
  const concurrency = numberArg(args, 'concurrency', 10);
  const path = args.path ?? '/dating/discover';
  const timings = [];

  await runPool(requests, concurrency, async () => {
    const startedAt = performance.now();
    const response = await fetch(`${api}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    await response.arrayBuffer();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${path}`);
    }
    timings.push(performance.now() - startedAt);
  });

  printStats('dating-discover', timings);
}

function waitForSocketMessage(socket, predicate, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for websocket message'));
    }, timeoutMs);

    const onMessage = (raw) => {
      const data = raw.data ?? raw;
      const event = JSON.parse(data.toString());
      if (!predicate(event)) {
        return;
      }
      cleanup();
      resolve(event);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      removeSocketListener(socket, 'message', onMessage);
      removeSocketListener(socket, 'error', onError);
    };

    addSocketListener(socket, 'message', onMessage);
    addSocketListener(socket, 'error', onError);
  });
}

async function getWebSocketCtor() {
  if (websocketCtor) {
    return websocketCtor;
  }

  if (globalThis.WebSocket) {
    websocketCtor = globalThis.WebSocket;
    return websocketCtor;
  }

  try {
    websocketCtor = (await import('ws')).default;
    return websocketCtor;
  } catch {
    throw new Error('WebSocket is unavailable. Use Node 22+ or install ws where this script runs.');
  }
}

function addSocketListener(socket, event, listener) {
  if (typeof socket.on === 'function') {
    socket.on(event, listener);
    return;
  }
  socket.addEventListener(event, listener);
}

function removeSocketListener(socket, event, listener) {
  if (typeof socket.off === 'function') {
    socket.off(event, listener);
    return;
  }
  socket.removeEventListener(event, listener);
}

async function openSocket(url) {
  const WebSocket = await getWebSocketCtor();
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      removeSocketListener(socket, 'open', onOpen);
      removeSocketListener(socket, 'error', onError);
    };

    addSocketListener(socket, 'open', onOpen);
    addSocketListener(socket, 'error', onError);
  });
}

async function connectChatSocket(wsUrl, token, chatId) {
  const socket = await openSocket(wsUrl);
  socket.send(JSON.stringify({
    type: 'session.authenticate',
    payload: { accessToken: token },
  }));
  await waitForSocketMessage(socket, (event) => event.type === 'session.authenticated');
  socket.send(JSON.stringify({
    type: 'chat.subscribe',
    payload: { chatId },
  }));
  await waitForSocketMessage(socket, (event) => event.type === 'chat.updated');
  return socket;
}

async function measureChatSend(args) {
  const wsUrl = required(args, 'ws');
  const token = required(args, 'token');
  const chatId = required(args, 'chat-id');
  const messages = numberArg(args, 'messages', 100);
  const timings = [];
  const socket = await connectChatSocket(wsUrl, token, chatId);

  try {
    for (let index = 0; index < messages; index += 1) {
      const clientMessageId = `perf-${Date.now()}-${index}`;
      const startedAt = performance.now();
      socket.send(JSON.stringify({
        type: 'message.send',
        payload: {
          chatId,
          text: `perf message ${index}`,
          clientMessageId,
        },
      }));
      await waitForSocketMessage(
        socket,
        (event) =>
          event.type === 'message.created' &&
          event.payload?.clientMessageId === clientMessageId,
      );
      timings.push(performance.now() - startedAt);
    }
  } finally {
    socket.close();
  }

  printStats('chat-send-ack', timings);
}

async function measureBroadcastFanout(args) {
  const wsUrl = required(args, 'ws');
  const senderToken = required(args, 'sender-token');
  const subscriberToken = required(args, 'subscriber-token');
  const chatId = required(args, 'chat-id');
  const subscribers = numberArg(args, 'subscribers', 100);
  const runs = numberArg(args, 'runs', 1);
  const sockets = [];
  const timings = [];

  for (let index = 0; index < subscribers; index += 1) {
    sockets.push(await connectChatSocket(wsUrl, subscriberToken, chatId));
  }

  const sender = await connectChatSocket(wsUrl, senderToken, chatId);

  try {
    for (let run = 0; run < runs; run += 1) {
      const clientMessageId = `fanout-${Date.now()}-${run}`;
      const received = new Set();
      const handlers = [];
      const startedAt = performance.now();

      const done = new Promise((resolve, reject) => {
        const cleanup = () => {
          handlers.forEach(({ socket, handler }) => {
            removeSocketListener(socket, 'message', handler);
          });
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Only ${received.size}/${subscribers} subscribers received the event`));
        }, DEFAULT_TIMEOUT_MS);

        sockets.forEach((socket, index) => {
          const handler = (raw) => {
            const data = raw.data ?? raw;
            const event = JSON.parse(data.toString());
            if (
              event.type === 'message.created' &&
              event.payload?.clientMessageId === clientMessageId
            ) {
              received.add(index);
              if (received.size === subscribers) {
                clearTimeout(timeout);
                cleanup();
                resolve();
              }
            }
          };
          handlers.push({ socket, handler });
          addSocketListener(socket, 'message', handler);
        });
      });

      sender.send(JSON.stringify({
        type: 'message.send',
        payload: {
          chatId,
          text: `fanout measurement ${run}`,
          clientMessageId,
        },
      }));

      await done;
      timings.push(performance.now() - startedAt);
    }
  } finally {
    sender.close();
    sockets.forEach((socket) => socket.close());
  }

  printStats('chat-broadcast-fanout', timings);
}

function printUsage() {
  console.log(`Usage:
  node backend/scripts/perf-hotpaths.mjs dating --api http://127.0.0.1:3000 --token TOKEN --requests 100 --concurrency 10
  node backend/scripts/perf-hotpaths.mjs chat-send --ws ws://127.0.0.1:3001 --token TOKEN --chat-id p1 --messages 100
  node backend/scripts/perf-hotpaths.mjs fanout --ws ws://127.0.0.1:3001 --sender-token TOKEN --subscriber-token TOKEN --chat-id p1 --subscribers 100 --runs 20`);
}

async function main() {
  const { scenario, args } = parseArgs(process.argv.slice(2));

  if (scenario === 'dating') {
    await measureDatingDiscover(args);
    return;
  }
  if (scenario === 'chat-send') {
    await measureChatSend(args);
    return;
  }
  if (scenario === 'fanout') {
    await measureBroadcastFanout(args);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
