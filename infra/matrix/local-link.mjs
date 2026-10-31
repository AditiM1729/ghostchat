import { generateKeyPairSync, randomBytes, publicEncrypt, privateDecrypt, constants, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
const origin = value => { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Use an HTTPS Matrix origin.'); return u.origin; };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = value => { if (typeof value !== 'string' || value.length > 16000 || !/^[\w-]+$/.test(value)) throw new Error('Invalid encrypted-link data.'); return JSON.parse(Buffer.from(value, 'base64url').toString()); };
const label = nonce => Buffer.from(`ghostchat-matrix-link-v1:${nonce}`);
export async function prepareLocalLink(root, homeserver) {
  homeserver = origin(homeserver); const directory = resolve(root, 'data'); await mkdir(directory, { recursive: true });
  const keys = generateKeyPairSync('rsa', { modulusLength: 4096, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const request = { v: 1, nonce: randomBytes(24).toString('hex'), expires: Date.now() + 3600000, homeserver, publicKey: keys.publicKey };
  await writeFile(resolve(directory, 'matrix-local-link.json'), JSON.stringify({ ...request, privateKey: keys.privateKey }), { mode: 0o600, flag: 'wx' });
  return encode(request);
}
export function encryptMatrixSettings(encoded, homeserver, secret) {
  const request = decode(encoded);
  if (request.v !== 1 || !/^[a-f0-9]{48}$/.test(request.nonce) || request.expires <= Date.now() || request.expires > Date.now() + 86400000 || origin(homeserver) !== request.homeserver) throw new Error('Link request expired or does not match this homeserver.');
  if (!/^[a-f0-9]{64,128}$/i.test(secret)) throw new Error('The server needs its generated Matrix wallet-login secret first.');
  const key = createPublicKey(request.publicKey); if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072) throw new Error('Invalid local public key.');
  const payload = JSON.stringify({ v: 1, nonce: request.nonce, expires: request.expires, homeserver: request.homeserver, secret });
  const ciphertext = publicEncrypt({ key, oaepHash: 'sha256', oaepLabel: label(request.nonce), padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(payload)).toString('base64url');
  return encode({ v: 1, nonce: request.nonce, ciphertext });
}
export async function importLocalLink(root, encoded) {
  const keyPath = resolve(root, 'data/matrix-local-link.json'); const request = JSON.parse(await readFile(keyPath, 'utf8')); const response = decode(encoded.trim());
  if (response.v !== 1 || response.nonce !== request.nonce || request.expires <= Date.now()) throw new Error('Link response expired or belongs to a different local request.');
  const value = JSON.parse(privateDecrypt({ key: request.privateKey, oaepHash: 'sha256', oaepLabel: label(request.nonce), padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(response.ciphertext, 'base64url')).toString());
  if (value.v !== 1 || value.nonce !== request.nonce || value.expires !== request.expires || value.homeserver !== request.homeserver || !/^[a-f0-9]{64,128}$/i.test(value.secret)) throw new Error('Invalid Matrix settings response.');
  const envPath = resolve(root, '.env'); let env = await readFile(envPath, 'utf8');
  const existing = env.match(/^MATRIX_JWT_SECRET=(.+)$/m)?.[1]; if (existing && existing !== value.secret) throw new Error('A different local Matrix key already exists. Review it before replacing.');
  try { await writeFile(resolve(root, '.env.before-matrix-link'), env, { mode: 0o600, flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  for (const [key, setting] of Object.entries({ MATRIX_HOMESERVER: value.homeserver, MATRIX_JWT_SECRET: value.secret })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm'); env = pattern.test(env) ? env.replace(pattern, `${key}=${setting}`) : env.trimEnd() + `\n${key}=${setting}\n`;
  }
  await writeFile(envPath, env, { mode: 0o600 }); await unlink(keyPath);
  return { homeserver: value.homeserver };
}
