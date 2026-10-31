import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { privateKeyToAccount } from 'viem/accounts';
import { jwtVerify } from 'jose';
import { WalletAccounts, matrixTicket, walletAccountRouter } from '../src/walletAccounts.js';
import { AccountDirectory } from '../src/accounts.js';
const alice = privateKeyToAccount(`0x${'31'.repeat(32)}`);
const bob = privateKeyToAccount(`0x${'32'.repeat(32)}`);
const origin = 'https://app.example.com';

test('wallet challenges reject other signers, other origins, expired and replayed signatures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ghostchat-wallet-')); const path = join(root, 'auth.sqlite'); const auth = new WalletAccounts(path);
  try {
    for (const address of ['0x', `0x${'00'.repeat(20)}`]) assert.throws(() => auth.challenge(address, origin));
    const c = auth.challenge(alice.address, origin); const signature = await alice.signMessage({ message: c.message });
    assert.match(c.message, /does not authorize a payment/);
    await assert.rejects(auth.login(c.nonce, signature, 'https://other.example.com'));
    await assert.rejects(auth.login(c.nonce, await bob.signMessage({ message: c.message }), origin));
    const session = await auth.login(c.nonce, signature, origin);
    assert.equal(auth.authenticate(session.token), alice.address);
    await assert.rejects(auth.login(c.nonce, signature, origin));
    const db = new DatabaseSync(path);
    const saved: any = db.prepare('SELECT * FROM sessions').get(); assert.notEqual(saved.token_hash, session.token); assert.equal(saved.token_hash.length, 64);
    const pending = auth.challenge(alice.address, origin); db.prepare('UPDATE login_challenges SET expires = 1').run();
    await assert.rejects(auth.login(pending.nonce, await alice.signMessage({ message: pending.message }), origin));
    const restored = new WalletAccounts(path); assert.equal(restored.authenticate(session.token), alice.address); restored.close();
    auth.logout(session.token); assert.throws(() => auth.authenticate(session.token));
    const fresh = auth.challenge(alice.address, origin); const second = await auth.login(fresh.nonce, await alice.signMessage({ message: fresh.message }), origin);
    db.prepare('UPDATE sessions SET expires = 1').run(); assert.throws(() => auth.authenticate(second.token)); db.close();
  } finally { auth.close(); await rm(root, { recursive: true, force: true }); }
});

test('wallet HTTP onboarding protects private profiles and grants short-lived wallet-bound Matrix tickets', async () => {
  const saved = { secret: process.env.MATRIX_JWT_SECRET, server: process.env.MATRIX_HOMESERVER };
  process.env.MATRIX_JWT_SECRET = 'a1'.repeat(48); process.env.MATRIX_HOMESERVER = 'https://matrix.example.com';
  const directory = new AccountDirectory(':memory:', 'ab'.repeat(32)); const auth = new WalletAccounts();
  const app = express(); app.use(express.json()); app.use('/api/account', walletAccountRouter(directory, [origin], auth));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/account`;
  const call = async (path: string, body?: unknown, token?: string, from = origin) => fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: from, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  try {
    assert.equal((await call('/google/login', {})).status, 401); // retired endpoint is never authenticated as Google
    assert.equal((await call('/me')).status, 401);
    assert.equal((await call('/wallet-auth/challenge', { wallet: alice.address }, undefined, 'https://evil.example.com')).status, 403);
    const login = async (wallet: typeof alice) => {
      const challenge = await (await call('/wallet-auth/challenge', { wallet: wallet.address })).json();
      return (await (await call('/wallet-auth/login', { nonce: challenge.nonce, signature: await wallet.signMessage({ message: challenge.message }) })).json()).token;
    };
    const token = await login(alice); const other = await login(bob);
    assert.equal((await call('/matrix-ticket', {}, token)).status, 409);
    const input = { name: 'Alice Example', mobile: '+919876543210', username: 'alice_example', wallet: alice.address, consent: true };
    assert.equal((await call('/challenge', { ...input, wallet: bob.address }, token)).status, 403);
    const challenge = await (await call('/challenge', input, token)).json();
    const signature = await alice.signMessage({ message: challenge.message });
    assert.notEqual((await call('/complete', { nonce: challenge.nonce, signature }, other)).status, 200);
    assert.equal((await call('/complete', { nonce: challenge.nonce, signature }, token)).status, 200);
    assert.equal(await (await call('/me', undefined, other)).json(), null);
    assert.equal((await (await call('/me', undefined, token)).json()).name, 'Alice Example');
    const response = await call('/matrix-ticket', { userId: '@admin:matrix.example.com' }, token);
    assert.equal(response.headers.get('cache-control'), 'no-store'); const ticket = await response.json();
    assert.equal(ticket.userId, `@w_${alice.address.slice(2).toLowerCase()}:matrix.example.com`);
    const { payload } = await jwtVerify(ticket.token, new TextEncoder().encode(process.env.MATRIX_JWT_SECRET!), { issuer: 'ghostchat-wallet', audience: 'ghostchat-matrix', algorithms: ['HS256'] });
    assert.equal(payload.sub, ticket.userId.slice(1).split(':')[0]); assert.equal(payload.exp! - payload.iat!, 60); assert.equal(payload.mobile, undefined);
    await assert.rejects(jwtVerify(ticket.token, new TextEncoder().encode(process.env.MATRIX_JWT_SECRET!), { audience: 'different' }));
    await call('/wallet-auth/logout', {}, token); assert.equal((await call('/me', undefined, token)).status, 401);
  } finally {
    await new Promise<void>(r => server.close(() => r())); auth.close(); directory.close();
    if (saved.secret === undefined) delete process.env.MATRIX_JWT_SECRET; else process.env.MATRIX_JWT_SECRET = saved.secret;
    if (saved.server === undefined) delete process.env.MATRIX_HOMESERVER; else process.env.MATRIX_HOMESERVER = saved.server;
  }
});

test('Matrix ticket refuses missing or unsafe configuration', async () => {
  await assert.rejects(matrixTicket(alice.address, {}));
  for (const url of ['http://matrix.example.com', 'https://secret@matrix.example.com', 'https://matrix.example.com/path']) await assert.rejects(matrixTicket(alice.address, { MATRIX_JWT_SECRET: 'a'.repeat(96), MATRIX_HOMESERVER: url }));
});
