import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readMatrixSession } from '../src/messenger/sessionStore';
import { encryptChatKeys, decryptChatKeys } from '../src/messenger/keyBackup';
function storage() { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) || null, setItem: (k: string, v: string) => map.set(k, v) } as unknown as Storage; }
it('migrates an existing tab session and reuses its device after the tab closes', () => {
  const persistent = storage(); const tab = storage();
  const session = { homeserver: 'https://matrix.example', userId: '@a:matrix.example', deviceId: 'OLD_DEVICE', accessToken: 'token' };
  tab.setItem('ghostpay.matrix.session.v1', JSON.stringify(session));
  assert.deepEqual(readMatrixSession(persistent, tab), session);
  assert.deepEqual(readMatrixSession(persistent, storage()), session);
});
it('encrypts room key backups and rejects an incorrect password', async () => {
  const plain = JSON.stringify([{ session_key: 'private-secret' }]);
  const encrypted = await encryptChatKeys(plain, 'a long backup password');
  assert.ok(!encrypted.includes('private-secret'));
  assert.equal(await decryptChatKeys(encrypted, 'a long backup password'), plain);
  await assert.rejects(decryptChatKeys(encrypted, 'incorrect password'), /Could not unlock/);
});
