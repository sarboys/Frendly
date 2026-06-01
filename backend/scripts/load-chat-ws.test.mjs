import assert from 'node:assert/strict';
import test from 'node:test';

test('parses sender-only receive mode for large fanout tests', async () => {
  const originalExit = process.exit;
  process.exit = ((code) => {
    throw new Error(`unexpected process.exit(${code}) while importing load script`);
  });
  try {
    const module = await import(`./load-chat-ws.mjs?test=${Date.now()}`);

    assert.equal(typeof module.parseArgs, 'function');
    assert.equal(typeof module.resolveEventSockets, 'function');
    assert.equal(typeof module.eventSocketBufferStats, 'function');
    assert.equal(typeof module.eventSendTiming, 'function');
    assert.equal(typeof module.createClientMessageId, 'function');

    const config = module.parseArgs([
      'node',
      'load-chat-ws.mjs',
      '--connections',
      '15000',
      '--event-senders',
      '1000',
      '--receive-mode',
      'senders',
      '--close-mode',
      'terminate',
      '--event-senders-unsubscribe',
      '--send-buffer-drain-ms',
      '7000',
    ]);

    assert.equal(config.connections, 15000);
    assert.equal(config.eventSenders, 1000);
    assert.equal(config.receiveMode, 'senders');
    assert.equal(config.closeMode, 'terminate');
    assert.equal(config.eventSendersUnsubscribe, true);
    assert.equal(config.sendBufferDrainMs, 7000);
    assert.deepEqual(
      module.resolveEventSockets(config, ['s0', 's1', 's2']),
      ['s0', 's1', 's2'],
    );
    assert.deepEqual(
      module.resolveEventSockets({ ...config, eventSenders: 2 }, ['s0', 's1', 's2']),
      ['s0', 's1'],
    );
    assert.deepEqual(
      module.eventSocketBufferStats([
        { socket: { bufferedAmount: 12 } },
        { socket: { bufferedAmount: 0 } },
        { socket: { bufferedAmount: 5 } },
      ]),
      { bytes: 17, sockets: 2, maxBytes: 12 },
    );
    assert.deepEqual(module.eventSendTiming(3000, 2000), {
      sendElapsedMs: 2000,
      actualSendRps: 1500,
    });
    assert.deepEqual(module.eventSendTiming(0, 0), {
      sendElapsedMs: 0,
      actualSendRps: 0,
    });
    assert.equal(module.createClientMessageId('run-a', 42), 'load-run-a-42');

    const calls = [];
    module.closeSockets(
      [
        {
          socket: {
            close: () => calls.push('close'),
            terminate: () => calls.push('terminate'),
          },
        },
      ],
      'terminate',
    );
    assert.deepEqual(calls, ['terminate']);
  } finally {
    process.exit = originalExit;
  }
});
