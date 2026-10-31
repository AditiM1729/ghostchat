import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareLocalLink, encryptMatrixSettings, importLocalLink } from './local-link.mjs';

test('Matrix settings transfer is encrypted, request-bound, single-use and preserves existing profile keys', async () => {
  const prefix = join(tmpdir(), 'ghostchat-matrix-link-'); const root = await mkdtemp(prefix);
  try {
    await writeFile(join(root, '.env'), 'PROFILE_ENCRYPTION_KEY=existing-key\nOTHER_SETTING=keep\n');
    const request = await prepareLocalLink(root, 'https://matrix.example.com'); const secret = 'a4'.repeat(48);
    assert.ok(!request.includes('PRIVATE KEY'));
    assert.throws(() => encryptMatrixSettings(request, 'https://wrong.example.com', secret));
    assert.throws(() => encryptMatrixSettings(request, 'https://matrix.example.com', 'short'));
    const response = encryptMatrixSettings(request, 'https://matrix.example.com', secret);
    assert.ok(!Buffer.from(response, 'base64url').toString().includes(secret));
    const tampered = JSON.parse(Buffer.from(response, 'base64url').toString()); tampered.nonce = '0'.repeat(48);
    await assert.rejects(importLocalLink(root, Buffer.from(JSON.stringify(tampered)).toString('base64url')));
    assert.equal((await importLocalLink(root, response)).homeserver, 'https://matrix.example.com');
    const env = await readFile(join(root, '.env'), 'utf8'); assert.ok(env.includes('PROFILE_ENCRYPTION_KEY=existing-key')); assert.ok(env.includes('OTHER_SETTING=keep')); assert.ok(env.includes(`MATRIX_JWT_SECRET=${secret}`));
    assert.ok((await readFile(join(root, '.env.before-matrix-link'), 'utf8')).includes('existing-key'));
    await assert.rejects(importLocalLink(root, response));
  } finally { assert.ok(root.startsWith(prefix)); await rm(root, { recursive: true, force: true }); }
});
