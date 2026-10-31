import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { encryptKeystoreJson, decryptKeystoreJson } from 'ethers';
import { AccountDirectory } from '../src/accounts.js';
import { walletBackupInput } from '../../shared/walletBackup.js';
const account = privateKeyToAccount(`0x${'58'.repeat(32)}`);
const other = privateKeyToAccount(`0x${'59'.repeat(32)}`);
test('Google sign-in nonce is single-use and expired/missing challenges fail closed', () => {
  const directory = new AccountDirectory(':memory:'); const original = Date.now;
  try {
    const first = directory.googleChallenge(); directory.consumeGoogleChallenge(first.nonce);
    assert.throws(() => directory.consumeGoogleChallenge(first.nonce)); assert.throws(() => directory.consumeGoogleChallenge());
    const expired = directory.googleChallenge(); Date.now = () => original() + 301000;
    assert.throws(() => directory.consumeGoogleChallenge(expired.nonce));
  } finally { Date.now = original; directory.close(); }
});
test('Google-owned backup requires wallet proof and keeps the same encrypted key across login sessions', async () => {
  const directory = new AccountDirectory(':memory:', 'ab'.repeat(32)); const password = 'test-only wallet password';
  const keystore = await encryptKeystoreJson({ address: account.address, privateKey: `0x${'58'.repeat(32)}` }, password, { scrypt: { N: 16384, r: 8, p: 1 } });
  try {
    const input = walletBackupInput({ wallet: account.address, keystore });
    const challenge = directory.walletChallenge('google-alice', input, 'http://localhost:5173');
    const signature = await account.signMessage({ message: challenge.message });
    await assert.rejects(directory.completeWallet('google-bob', challenge.nonce, signature));
    await assert.rejects(directory.completeWallet('google-alice', challenge.nonce, await other.signMessage({ message: challenge.message })), /ownership/);
    await directory.completeWallet('google-alice', challenge.nonce, signature);
    assert.equal(directory.walletBackup('google-bob'), null);
    assert.equal(directory.walletBackup('google-alice')!.wallet, account.address);
    assert.throws(() => directory.challenge('google-alice', { name: 'Prem', mobile: '+919876543210', username: 'other_wallet', wallet: other.address, consent: true }, 'http://localhost:5173'), /already backed up/);
    const restored = await decryptKeystoreJson(directory.walletBackup('google-alice')!.keystore, password);
    assert.equal(restored.address.toLowerCase(), account.address.toLowerCase());
    await assert.rejects(decryptKeystoreJson(keystore, 'incorrect password'));
    assert.throws(() => directory.walletChallenge('google-alice', input, 'http://localhost:5173'), /already has/);
    await assert.rejects(directory.completeWallet('google-alice', challenge.nonce, signature));
    for (const change of [{ wallet: other.address }, { keystore: keystore.replace('"scrypt"', '"pbkdf2"') }]) assert.throws(() => walletBackupInput({ ...input, ...change }));
    assert.ok(!JSON.stringify(directory.walletBackup('google-alice')).includes(password));
    const extra = JSON.stringify({ ...JSON.parse(keystore), plaintextPassword: password });
    assert.equal(walletBackupInput({ wallet: account.address, keystore: extra }).keystore.includes(password), false);
  } finally { directory.close(); }
});
