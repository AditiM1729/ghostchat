import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress, stringToHex } from 'viem';
import { createEmbeddedProvider, type SigningReview } from '../src/wallet/embeddedProvider.ts';
const account = privateKeyToAccount(`0x${'57'.repeat(32)}`);
const rpc = (provider: any, method: string, params: unknown[] = []) => provider.request({ method, params });
test('embedded wallet exposes only MST networks and blocks raw signing/broadcast methods', async () => {
  const wallet = createEmbeddedProvider(account, async () => true);
  assert.deepEqual(await rpc(wallet.provider, 'eth_accounts'), [account.address]);
  assert.equal(Number(await rpc(wallet.provider, 'eth_chainId')), 91562037);
  await rpc(wallet.provider, 'wallet_switchEthereumChain', [{ chainId: '0x1226' }]);
  assert.equal(Number(await rpc(wallet.provider, 'eth_chainId')), 4646);
  await assert.rejects(rpc(wallet.provider, 'wallet_switchEthereumChain', [{ chainId: '0x1' }]));
  for (const method of ['eth_sign','eth_sendRawTransaction','wallet_grantPermissions']) await assert.rejects(rpc(wallet.provider, method), /Unsupported wallet method/);
  wallet.close(); await assert.rejects(rpc(wallet.provider, 'eth_accounts'), /locked/);
});
test('every signature requires approval and is bound to the connected wallet', async () => {
  let review: SigningReview | undefined; let approve = false;
  const wallet = createEmbeddedProvider(account, async value => { review = value; return approve; });
  const message = 'GhostChat account registration for my username';
  await assert.rejects(rpc(wallet.provider, 'personal_sign', [stringToHex(message), account.address]), /cancelled/);
  approve = true; const signature = await rpc(wallet.provider, 'personal_sign', [stringToHex(message), account.address]);
  assert.equal(await recoverMessageAddress({ message, signature }), account.address);
  assert.ok(review!.rows.some(([, value]) => value === message));
  await assert.rejects(rpc(wallet.provider, 'personal_sign', [stringToHex(message), '0x1111111111111111111111111111111111111111']), /does not match/);
  wallet.close();
});
test('wallet rejects mismatched typed-data domains and transaction identities before contacting RPC', async () => {
  let approvals = 0; const wallet = createEmbeddedProvider(account, async () => { approvals++; return true; });
  await assert.rejects(rpc(wallet.provider, 'eth_signTypedData_v4', [account.address, JSON.stringify({ domain: { chainId: 1 }, primaryType: 'Claim', types: { Claim: [] }, message: {} })]), /domain/);
  await assert.rejects(rpc(wallet.provider, 'eth_sendTransaction', [{ from: account.address, chainId: '0x1', to: account.address }]), /network mismatch/);
  await assert.rejects(rpc(wallet.provider, 'eth_sendTransaction', [{ from: '0x1111111111111111111111111111111111111111', to: account.address }]), /does not match/);
  await assert.rejects(rpc(wallet.provider, 'eth_sendTransaction', [{ from: account.address, to: account.address, authorizationList: [] }]), /Unsupported transaction field/);
  assert.equal(approvals, 0); wallet.close();
});
test('locking during a pending approval cancels signing; a second request cannot replace the first', async () => {
  let accept!: (value: boolean) => void; const wallet = createEmbeddedProvider(account, () => new Promise(resolve => { accept = resolve; }));
  const pending = rpc(wallet.provider, 'personal_sign', [stringToHex('Review me'), account.address]);
  await assert.rejects(rpc(wallet.provider, 'personal_sign', [stringToHex('Replace it'), account.address]), /current wallet confirmation/);
  await assert.rejects(rpc(wallet.provider, 'wallet_switchEthereumChain', [{ chainId: '0x1226' }]), /Finish/);
  wallet.close(); accept(true); await assert.rejects(pending, /locked/);
});
