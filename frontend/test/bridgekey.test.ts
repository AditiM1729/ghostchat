import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeKeyConnection, bridgeKeyError } from '../src/wallet/bridgekey.ts';
import { MST_CHAIN_ID } from '../../shared/network.ts';

test('BridgeKey selection uses the requested connector even when another wallet comes first', () => {
  const wallets = [{ id: 'metamask', name: 'MetaMask' }, { id: 'example-discovery-id', name: 'BridgeKey Wallet' }];
  const request = bridgeKeyConnection(wallets);
  assert.equal(request.connector, wallets[1]);
  assert.equal(request.chainId, MST_CHAIN_ID);
  assert.equal(request.chainId, 91562037);
});
test('missing or ambiguous BridgeKey discovery never falls back to another wallet', () => {
  assert.throws(() => bridgeKeyConnection([{ id: 'injected', name: 'Injected' }, { id: 'metaMask', name: 'MetaMask' }]), /not detected/);
  assert.throws(() => bridgeKeyConnection([{ id: 'one', name: 'BridgeKey' }, { id: 'two', name: 'BridgeKey Wallet' }]), /Multiple/);
  assert.throws(() => bridgeKeyConnection([{ id: 'ghostpay-local', name: 'BridgeKey' }]), /not detected/);
  assert.throws(() => bridgeKeyConnection([{ id: 'other', name: 'Fake BridgeKey Wallet' }]), /not detected/);
});
test('connection cancellation is distinct from network and capability failures', () => {
  assert.match(bridgeKeyError({ code: 4001 }), /cancelled/);
  assert.match(bridgeKeyError(new Error('User rejected the request.')) , /cancelled/);
  assert.equal(bridgeKeyError(new Error('Unsupported chain 91562037')), 'Unsupported chain 91562037');
});
