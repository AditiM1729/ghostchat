import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import type { PublicClient } from 'viem';
import { createApp } from '../src/app.js';
import { AccountDirectory } from '../src/accounts.js';
import { WalletAccounts } from '../src/walletAccounts.js';

test('real application preserves safe Matrix setup errors instead of reporting an MST failure', async () => {
  const previous = { secret: process.env.MATRIX_JWT_SECRET, server: process.env.MATRIX_HOMESERVER };
  delete process.env.MATRIX_JWT_SECRET; delete process.env.MATRIX_HOMESERVER;
  const directory = new AccountDirectory(':memory:', 'ab'.repeat(32)); const auth = new WalletAccounts();
  const wallet = privateKeyToAccount(`0x${'43'.repeat(32)}`); const origin = 'http://localhost:5173';
  const profile = directory.challenge(`wallet:${wallet.address.toLowerCase()}`, { wallet: wallet.address, name: 'Example User', mobile: '+919876543210', username: 'example_user', consent: true }, origin);
  await directory.complete(`wallet:${wallet.address.toLowerCase()}`, profile.nonce, await wallet.signMessage({ message: profile.message }));
  const challenge = auth.challenge(wallet.address, origin); const session = await auth.login(challenge.nonce, await wallet.signMessage({ message: challenge.message }), origin);
  const client = { getBlockNumber: async () => { throw Object.assign(new Error('internal secret must never reach the browser'), { status: 503 }); } } as unknown as PublicClient;
  const server = createApp(client, { address: '0x1111111111111111111111111111111111111111', chainId: 91562037, configured: false }, origin, undefined, directory, undefined, auth).listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r)); const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const ticket = () => fetch(base + '/account/matrix-ticket', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: '{}' });
  try {
    const missing = await ticket(); assert.equal(missing.status, 503); const body = await missing.json(); assert.equal(body.code, 'matrix_not_configured'); assert.match(body.error, /Chat sign-in/); assert.doesNotMatch(body.error, /MST|RPC/);
    process.env.MATRIX_JWT_SECRET = 'a'.repeat(96); // A key alone must not claim readiness.
    const config = await (await fetch(base + '/account/config')).json(); assert.equal(config.matrixConfigured, false); assert.equal(config.matrix.reason, 'matrix_not_configured'); assert.ok(!JSON.stringify(config).includes(process.env.MATRIX_JWT_SECRET));
    process.env.MATRIX_HOMESERVER = 'not-a-url'; assert.equal((await (await ticket()).json()).code, 'matrix_invalid_configuration');
    const unknown = await fetch(base + '/health'); assert.equal(unknown.status, 503); const hidden = await unknown.json(); assert.doesNotMatch(hidden.error, /internal secret|MST/);
    process.env.MATRIX_HOMESERVER = 'https://matrix.example.com'; assert.equal((await ticket()).status, 200);
  } finally {
    await new Promise<void>(r => server.close(() => r())); directory.close(); auth.close();
    if (previous.secret === undefined) delete process.env.MATRIX_JWT_SECRET; else process.env.MATRIX_JWT_SECRET = previous.secret;
    if (previous.server === undefined) delete process.env.MATRIX_HOMESERVER; else process.env.MATRIX_HOMESERVER = previous.server;
  }
});
