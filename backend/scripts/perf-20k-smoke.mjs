#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const hotpathsScript = resolve(here, 'perf-hotpaths.mjs');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
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
  return args;
}

function required(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing --${key}`);
  }
  return value;
}

function runScenario(name, args) {
  const command = [hotpathsScript, name, ...args];
  console.log(`\n$ node ${command.join(' ')}`);
  const result = spawnSync(process.execPath, command, {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function optionalScenario(name, args, enabled) {
  if (!enabled) {
    console.log(`\nSkipping ${name}: required args are missing.`);
    return;
  }
  runScenario(name, args);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const api = required(args, 'api');
  const token = required(args, 'token');
  const requests = args.requests ?? '1000';
  const concurrency = args.concurrency ?? '25';
  const ws = args.ws;
  const chatId = args['chat-id'];
  const publicMediaPath = args['public-media-path'];
  const privateMediaPath = args['private-media-path'];

  runScenario('startup', [
    '--api', api,
    '--token', token,
    '--requests', args['startup-requests'] ?? '100',
    '--concurrency', args['startup-concurrency'] ?? '10',
  ]);
  runScenario('dating', [
    '--api', api,
    '--token', token,
    '--requests', requests,
    '--concurrency', concurrency,
  ]);
  runScenario('map-viewport', [
    '--api', api,
    '--token', token,
    '--requests', requests,
    '--concurrency', concurrency,
  ]);
  runScenario('affiche', [
    '--api', api,
    '--requests', requests,
    '--concurrency', concurrency,
  ]);
  runScenario('routes', [
    '--api', api,
    '--token', token,
    '--requests', requests,
    '--concurrency', concurrency,
  ]);

  optionalScenario('chat-history', [
    '--api', api,
    '--token', token,
    '--chat-id', chatId ?? '',
    '--requests', args['chat-requests'] ?? '200',
    '--concurrency', args['chat-concurrency'] ?? '10',
  ], Boolean(chatId));

  optionalScenario('media-reuse', [
    '--api', api,
    '--token', token,
    '--public-path', publicMediaPath ?? '',
    '--private-path', privateMediaPath ?? '',
    '--requests', args['media-requests'] ?? '200',
    '--concurrency', args['media-concurrency'] ?? '10',
  ], Boolean(publicMediaPath && privateMediaPath));

  optionalScenario('chat-send', [
    '--ws', ws ?? '',
    '--token', token,
    '--chat-id', chatId ?? '',
    '--messages', args.messages ?? '100',
  ], Boolean(ws && chatId));

  optionalScenario('fanout', [
    '--ws', ws ?? '',
    '--sender-token', token,
    '--subscriber-token', args['subscriber-token'] ?? token,
    '--chat-id', chatId ?? '',
    '--subscribers', args.subscribers ?? '100',
    '--runs', args.runs ?? '20',
  ], Boolean(ws && chatId));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
