import test from 'node:test';
import assert from 'node:assert/strict';
import { mstChains, mstMainnet, mstChain } from '../../shared/network.ts';
import { loginSaral, logoutSaral, registerSaralDriver, saralAvailable, switchSaralChain } from '../src/wallet/saral.ts';
import { saralWallet } from '../src/wallet/saralConnector.ts';
import { settlementDomain } from '../../shared/p2p.ts';
const address = '0x1111111111111111111111111111111111111111';
test('MST wallet has exactly two networks; P2P mainnet settlement remains disabled', () => {
  assert.deepEqual(mstChains.map(chain => chain.id), [91562037, 4646]);
  assert.equal(mstMainnet.nativeCurrency.symbol, 'MSTC'); assert.equal(mstMainnet.testnet, false);
  assert.throws(() => mstChain(1)); assert.throws(() => settlementDomain(address, 4646));
});
test('SARAL fails closed without an official auth driver and cannot silently fall back to extensions', async () => {
  assert.equal(saralAvailable(), false); await assert.rejects(loginSaral(), /official authentication SDK/);
  const connector = saralWallet()({ emitter: { emit() {} } } as never);
  assert.equal(connector.id, 'mst-saral'); assert.equal(await connector.isAuthorized(), false);
  await assert.rejects(connector.switchChain!({ chainId: 1 }), /MST/);
});
test('driver adapter reuses a wallet session and verifies actual chain switching', async () => {
  let calls = 0; let chainId = 91562037; let refuse = false;
  const provider = { request: async ({ method, params }: any) => {
    if (method === 'eth_accounts') return [address];
    if (method === 'eth_chainId') return `0x${chainId.toString(16)}`;
    if (method === 'wallet_switchEthereumChain') { if (!refuse) chainId = Number(params[0].chainId); return null; }
    throw new Error('Unexpected request');
  } };
  registerSaralDriver({ loginWithGoogle: async () => { calls++; return { provider: provider as never, googleIdToken: 'mock-unit-test-token' }; }, logout: async () => {} });
  try {
    await loginSaral(); await loginSaral(); assert.equal(calls, 1);
    await switchSaralChain(4646); assert.equal(chainId, 4646);
    refuse = true; await assert.rejects(switchSaralChain(91562037), /did not switch/);
    await assert.rejects(switchSaralChain(11155111), /MST/);
    await logoutSaral();
  } finally { await logoutSaral(); }
});
