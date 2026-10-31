import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { privateKeyToAccount } from 'viem/accounts';
import { AccountDirectory, accountRouter, profileRouter, verifyGoogle, googleIdentityVerifier } from '../src/accounts.js';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { accountInput } from '../../shared/account.js';

const alice = privateKeyToAccount(`0x${'13'.repeat(32)}`);
const bob = privateKeyToAccount(`0x${'14'.repeat(32)}`);
const raw = (wallet = alice.address, handle = 'prem_bharne') => ({ name: 'Prem Bharne', mobile: '+919876543210', username: handle, wallet, consent: true });
const origin = 'http://localhost:5173';
test('Google identity verification requires a trusted signature, correct audience, issuer, expiry and verified email', async () => {
  const keys = await generateKeyPair('RS256'); const other = await generateKeyPair('RS256');
  const verify = googleIdentityVerifier('ghostchat-google-client', createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'google-test-key' }] }));
  const sign = (changes: Record<string, unknown> = {}, key = keys.privateKey) => new SignJWT({ sub: 'google-subject', name: 'Prem', email_verified: true, aud: 'ghostchat-google-client', iss: 'https://accounts.google.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'google-test-key' }).sign(key);
  assert.equal((await verify(await sign())).sub, 'google-subject');
  for (const changes of [{ aud: 'another-app' }, { iss: 'https://attacker.example' }, { exp: 1 }, { email_verified: false }, { sub: '' }]) await assert.rejects(verify(await sign(changes)));
  await assert.rejects(verify(await sign({}, other.privateKey)));
});
test('profiles require valid names, international mobile numbers and unique normalized handles', () => {
  assert.equal(accountInput({ ...raw(), mobile: '+91 (98765) 43210' }).mobile, '+919876543210');
  for (const change of [{ name: 'a' }, { name: 'a\nb' }, { mobile: '9876543210' }, { username: 'ghostchat' }, { wallet: '0x' }]) assert.throws(() => accountInput({ ...raw(), ...change }));
});
test('registration binds a Google identity, profile and wallet; rejects forged signatures and replays', async () => {
  const directory = new AccountDirectory(':memory:', 'ac'.repeat(32));
  try {
    assert.throws(() => directory.challenge('alice', { ...raw(), consent: false }, origin));
    const challenge = directory.challenge('alice', raw(), origin);
    const signature = await alice.signMessage({ message: challenge.message });
    await assert.rejects(directory.complete('bob', challenge.nonce, signature));
    await assert.rejects(directory.complete('alice', challenge.nonce, await bob.signMessage({ message: challenge.message })), /connected wallet/);
    const profile = await directory.complete('alice', challenge.nonce, signature);
    assert.equal(profile.username, 'prem_bharne'); assert.equal(profile.wallet, alice.address); assert.equal(profile.mobileVerified, false);
    await assert.rejects(directory.complete('alice', challenge.nonce, signature), /expired or already/);
    assert.throws(() => directory.challenge('other', raw(bob.address), origin), /already registered/);
    assert.throws(() => directory.challenge('other', raw(alice.address, 'other_user'), origin), /already registered/);
    assert.throws(() => directory.challenge('alice', raw(bob.address, 'other_user'), origin), /already has a profile/);
    assert.deepEqual(Object.keys(directory.byName('prem_bharne')!).sort(), ['createdAt', 'username', 'wallet']);
  } finally { directory.close(); }
});
test('concurrent claims reserve a username once and superseded challenges cannot complete', async () => {
  const directory = new AccountDirectory(':memory:', 'bd'.repeat(32));
  try {
    const a = directory.challenge('alice', raw(), origin); const b = directory.challenge('bob', raw(bob.address), origin);
    const results = await Promise.allSettled([directory.complete('alice', a.nonce, await alice.signMessage({ message: a.message })), directory.complete('bob', b.nonce, await bob.signMessage({ message: b.message }))]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const old = directory.challenge('carol', raw(bob.address, 'carol_user'), origin); directory.challenge('carol', raw(bob.address, 'carol_new'), origin);
    await assert.rejects(directory.complete('carol', old.nonce, await bob.signMessage({ message: old.message })));
  } finally { directory.close(); }
});
test('directory persists wallet mappings while encrypting private mobile and name at rest', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ghostchat-account-')); const path = join(folder, 'accounts.sqlite'); const key = 'ce'.repeat(32);
  let directory = new AccountDirectory(path, key);
  try {
    const challenge = directory.challenge('alice', raw(), origin); await directory.complete('alice', challenge.nonce, await alice.signMessage({ message: challenge.message }));
    directory.close(); directory = new AccountDirectory(path, key);
    assert.equal(directory.byName('PREM_BHARNE')?.wallet, alice.address); assert.equal(directory.me('alice').mobile, raw().mobile);
    const bytes = await readFile(path); assert.equal(bytes.includes(Buffer.from(raw().mobile)), false); assert.equal(bytes.includes(Buffer.from(raw().name)), false);
  } finally { directory.close(); await rm(folder, { recursive: true, force: true }); }
});
test('unconfigured identity verification/storage fail closed', async () => {
  const directory = new AccountDirectory(':memory:');
  try { assert.throws(() => directory.challenge('alice', raw(), origin), /not configured/); await assert.rejects(verifyGoogle('not-a-google-token')); }
  finally { directory.close(); }
});
test('HTTP private profile routes require Google auth and allowed origins; public lookup omits contact data', async () => {
  const directory = new AccountDirectory(':memory:', 'df'.repeat(32)); const app = express(); app.use(express.json());
  app.use('/api/account', accountRouter(directory, [origin], async token => { if (token !== 'valid-test-session') throw new Error('Invalid session'); return { sub: 'alice' }; }));
  app.use('/api/profiles', profileRouter(directory));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`; const headers = { Authorization: 'Bearer valid-test-session', 'Content-Type': 'application/json', Origin: origin };
  try {
    assert.equal((await fetch(base + '/api/account/me')).status, 401);
    assert.equal((await fetch(base + '/api/account/me', { headers: { Authorization: 'Bearer forged' } })).status, 401);
    assert.equal((await fetch(base + '/api/account/challenge', { method: 'POST', headers: { ...headers, Origin: 'https://attacker.example' }, body: JSON.stringify(raw()) })).status, 403);
    const challenge = await (await fetch(base + '/api/account/challenge', { method: 'POST', headers, body: JSON.stringify(raw()) })).json();
    assert.equal((await fetch(base + '/api/account/complete', { method: 'POST', headers, body: JSON.stringify({ nonce: challenge.nonce, signature: await alice.signMessage({ message: challenge.message }) }) })).status, 200);
    const publicResult = await (await fetch(base + '/api/profiles/name/prem_bharne')).json();
    assert.equal(publicResult.wallet, alice.address); assert.equal(publicResult.mobile, undefined); assert.equal(publicResult.name, undefined);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); directory.close(); }
});
