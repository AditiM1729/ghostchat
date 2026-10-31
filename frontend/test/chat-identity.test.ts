import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChatUsers } from '../src/messenger/chatIdentity.ts';

const homeserver = 'https://ghostchat-matrix-pune.duckdns.org';
const wallet = '0x6ecBd2B54d31C6d1CA80FAdf94eC282218e86f91' as const;
test('a registered username resolves to the same wallet-linked Matrix identity as login', async () => {
  const result = await resolveChatUsers(['@PremBharne45'], homeserver, async name => {
    assert.equal(name, 'prembharne45'); return { username: name, wallet: wallet.toLowerCase() as typeof wallet, createdAt: 0 };
  });
  assert.deepEqual(result, ['@w_6ecbd2b54d31c6d1ca80fadf94ec282218e86f91:ghostchat-matrix-pune.duckdns.org']);
});
test('complete Matrix IDs retain their original server and require no directory lookup', async () => {
  assert.deepEqual(await resolveChatUsers(['@alice:elsewhere.example'], homeserver, async () => { throw new Error('Unexpected lookup'); }), ['@alice:elsewhere.example']);
});
test('group input looks up each normalized username once and removes duplicate invitations', async () => {
  let calls = 0;
  const result = await resolveChatUsers(['@alice', 'ALICE', '@bob:other.example'], homeserver, async name => { calls++; return { username: name, wallet: wallet.toLowerCase() as typeof wallet, createdAt: 0 }; });
  assert.equal(calls, 1); assert.equal(result.length, 2);
});
test('unknown names and directory mismatches cannot invite a different account', async () => {
  await assert.rejects(resolveChatUsers(['@alice'], homeserver, async () => null), /not registered/);
  await assert.rejects(resolveChatUsers(['@alice'], homeserver, async () => ({ username: 'bob', wallet, createdAt: 0 })), /not registered/);
});
test('malformed Matrix IDs and untrusted homeserver URLs fail before creating a room', async () => {
  await assert.rejects(resolveChatUsers(['@alice:bad server'], homeserver, async () => null), /complete Matrix ID/);
  await assert.rejects(resolveChatUsers(['alice'], 'https://user:pass@server.example', async () => ({ username: 'alice', wallet: wallet.toLowerCase() as typeof wallet, createdAt: 0 })), /not configured correctly/);
});
