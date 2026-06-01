import assert from 'node:assert/strict';
import test from 'node:test';

test('parses and isolates a single mixed endpoint', async () => {
  const module = await import(`./load-mixed-rps.mjs?test=${Date.now()}`);

  const config = module.parseArgs([
    'node',
    'load-mixed-rps.mjs',
    '--api',
    'http://127.0.0.1',
    '--token',
    'token',
    '--rps',
    '1500',
    '--duration',
    '60',
    '--only',
    'dating-discover',
  ]);

  assert.equal(config.only, 'dating-discover');
  assert.equal(config.rps, 1500);

  const mix = module.resolveEndpointMix(config.only);
  assert.deepEqual(
    mix.map((endpoint) => [endpoint.name, endpoint.weight]),
    [['dating-discover', 100]],
  );
  assert.equal(module.pickEndpoint(0, mix).name, 'dating-discover');
  assert.equal(module.pickEndpoint(99, mix).name, 'dating-discover');
});
