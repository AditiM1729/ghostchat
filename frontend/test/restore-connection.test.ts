import { it } from 'node:test';
import assert from 'node:assert/strict';
import { waitForBridgeKey } from '../src/wallet/restoreConnection';
const bridge = { id: 'bridge', name: 'BridgeKey' }; const other = { id: 'other', name: 'MetaMask' };
it('restores after delayed discovery without selecting another injected wallet', async () => {
  let tick = 0; let connected = false; const chosen: string[] = [];
  await waitForBridgeKey({ connectors: () => tick < 2 ? [other] : [other, bridge], connected: () => connected, restore: async c => { chosen.push(c.id); connected = true; }, pause: async () => { tick++; }, attempts: 5 });
  assert.deepEqual(chosen, ['bridge']); assert.ok(connected);
});
it('retries a provider whose existing authorization becomes available later', async () => {
  let attempts = 0; let connected = false;
  await waitForBridgeKey({ connectors: () => [bridge], connected: () => connected, restore: async () => { connected = ++attempts === 2; }, pause: async () => {}, attempts: 4 });
  assert.equal(attempts, 2); assert.ok(connected);
});
it('does not reconnect an already connected wallet or pick ambiguous providers', async () => {
  let calls = 0;
  const options = { connectors: () => [bridge], connected: () => true, restore: async () => { calls++; }, pause: async () => {} };
  await waitForBridgeKey(options);
  await waitForBridgeKey({ ...options, connected: () => false, connectors: () => [bridge, { ...bridge, id: 'duplicate' }] });
  assert.equal(calls, 0);
});
