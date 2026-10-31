import { it } from 'node:test';
import assert from 'node:assert/strict';
it('restores the signed wallet session on page load and removes it on explicit logout', async () => {
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => saved.get(k) || null, setItem: (k: string, v: string) => saved.set(k, v), removeItem: (k: string) => saved.delete(k) } });
  const session = { token: 'ab'.repeat(32), wallet: `0x${'12'.repeat(20)}`, expiresAt: Math.floor(Date.now() / 1000) + 600 };
  saved.set('ghostchat.wallet.session.v1', JSON.stringify(session));
  const auth = await import('../src/wallet/walletSession');
  try {
    assert.deepEqual(auth.walletSession(), session);
    assert.equal(auth.walletSession(), auth.walletSession());
    assert.equal(auth.validWalletSession({ ...session, expiresAt: 0 }), false);
    auth.setWalletSession(undefined);
    assert.equal(auth.walletSession(), undefined);
    assert.equal(saved.has('ghostchat.wallet.session.v1'), false);
  } finally { auth.setWalletSession(undefined); }
});
