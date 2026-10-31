import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { getAddress, recoverMessageAddress, type Hex } from 'viem';
import { accountInput, accountMessage } from '../../shared/account.js';
import { username } from '../../shared/identity.js';
import { walletBackupInput, type EncryptedWalletBackup } from '../../shared/walletBackup.js';

export interface GoogleIdentity { sub: string; name?: string; nonce?: string; expiresAt?: number }
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogle(token: string): Promise<GoogleIdentity> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw Object.assign(new Error('Google account verification is not configured.'), { status: 503 });
  return googleIdentityVerifier(audience, googleKeys)(token);
}
export function googleIdentityVerifier(audience: string, keys: JWTVerifyGetKey) {
  return async (token: string): Promise<GoogleIdentity> => {
    const { payload } = await jwtVerify(token, keys, { audience, issuer: ['https://accounts.google.com', 'accounts.google.com'], algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'] });
    if (!payload.sub || payload.email_verified !== true) throw new Error('Use a verified Google account.');
    return { sub: payload.sub, name: typeof payload.name === 'string' ? payload.name : undefined, nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined, expiresAt: payload.exp };
  };
}
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
export class AccountDirectory {
  private db: DatabaseSync;
  private key?: Buffer;
  constructor(path: string, key = process.env.PROFILE_ENCRYPTION_KEY) {
    if (key && !/^[a-f0-9]{64}$/i.test(key)) throw new Error('PROFILE_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters.');
    this.key = key ? Buffer.from(key, 'hex') : undefined;
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts (subject TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, wallet TEXT NOT NULL UNIQUE COLLATE NOCASE, private_data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, subject TEXT NOT NULL, wallet TEXT NOT NULL, username TEXT NOT NULL, private_data TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS google_challenges (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS wallet_backups (subject TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE COLLATE NOCASE, keystore TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS wallet_challenges (nonce TEXT PRIMARY KEY, subject TEXT NOT NULL, wallet TEXT NOT NULL, keystore TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  get configured() { return !!this.key; }
  googleChallenge() {
    const now = Math.floor(Date.now() / 1000); const nonce = randomBytes(24).toString('hex');
    this.db.prepare('DELETE FROM google_challenges WHERE expires <= ?').run(now);
    this.db.prepare('INSERT INTO google_challenges VALUES (?, ?)').run(nonce, now + 300);
    return { nonce };
  }
  consumeGoogleChallenge(nonce?: string) {
    if (!nonce || !/^[a-f0-9]{48}$/.test(nonce)) return fail('Google login is missing its security nonce.', 401);
    const result = this.db.prepare('DELETE FROM google_challenges WHERE nonce = ? AND expires > ?').run(nonce, Math.floor(Date.now() / 1000));
    if (result.changes !== 1) return fail('Google login expired or was already used. Try again.', 401);
  }
  walletBackup(subject: string): EncryptedWalletBackup | null {
    const row: any = this.db.prepare('SELECT wallet, keystore FROM wallet_backups WHERE subject = ?').get(subject);
    return row ? { wallet: getAddress(row.wallet), keystore: row.keystore } : null;
  }
  walletChallenge(subject: string, raw: EncryptedWalletBackup, origin: string) {
    if (!this.configured) return fail('Private storage is not configured.', 503);
    const input = walletBackupInput(raw);
    if (this.walletBackup(subject)) return fail('This Google account already has a wallet. Unlock its backup.', 409);
    const existing = this.me(subject); if (existing && existing.wallet.toLowerCase() !== input.wallet.toLowerCase()) return fail('Restore the wallet already linked to this account.', 409);
    const nonce = randomBytes(24).toString('hex'); const expires = Math.floor(Date.now() / 1000) + 300;
    const digest = createHash('sha256').update(input.keystore).digest('hex');
    const message = `GhostChat encrypted wallet backup v1\nApplication: ${origin}\nWallet: ${input.wallet}\nBackup SHA-256: ${digest}\nNonce: ${nonce}\nExpires: ${expires}\nSave this password-encrypted backup for my Google account. This does not authorize a payment.`;
    this.db.prepare('DELETE FROM wallet_challenges WHERE subject = ? OR expires <= ?').run(subject, Math.floor(Date.now() / 1000));
    this.db.prepare('INSERT INTO wallet_challenges VALUES (?, ?, ?, ?, ?, ?)').run(nonce, subject, input.wallet, input.keystore, message, expires);
    return { nonce, message };
  }
  async completeWallet(subject: string, nonce: string, signature: Hex) {
    if (typeof nonce !== 'string' || !/^[a-f0-9]{48}$/.test(nonce) || typeof signature !== 'string' || !/^0x[\da-f]{130}$/i.test(signature)) return fail('Invalid wallet backup proof.');
    const row: any = this.db.prepare('SELECT * FROM wallet_challenges WHERE subject = ? AND nonce = ?').get(subject, nonce);
    if (!row || row.expires <= Math.floor(Date.now() / 1000)) return fail('Wallet backup request expired or was already used.');
    if ((await recoverMessageAddress({ message: row.message, signature })).toLowerCase() !== row.wallet.toLowerCase()) return fail('Wallet ownership could not be verified.', 403);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const fresh: any = this.db.prepare('SELECT expires FROM wallet_challenges WHERE subject = ? AND nonce = ?').get(subject, nonce);
      if (!fresh || fresh.expires <= Math.floor(Date.now() / 1000)) fail('Wallet backup request expired or was already used.');
      if (this.db.prepare('SELECT 1 FROM wallet_backups WHERE subject = ? OR wallet = ?').get(subject, row.wallet)) fail('A wallet backup already exists. Replacement is disabled.', 409);
      const profile: any = this.db.prepare('SELECT wallet FROM accounts WHERE subject = ?').get(subject);
      if (profile && profile.wallet.toLowerCase() !== row.wallet.toLowerCase()) fail('The account is linked to a different wallet.', 409);
      this.db.prepare('INSERT INTO wallet_backups VALUES (?, ?, ?, ?)').run(subject, row.wallet, row.keystore, Math.floor(Date.now() / 1000));
      this.db.prepare('DELETE FROM wallet_challenges WHERE subject = ?').run(subject); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.walletBackup(subject);
  }
  private encrypt(value: unknown) {
    if (!this.key) return fail('Private profile storage is not configured.', 503);
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const content = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64');
  }
  private decrypt(value: string) {
    if (!this.key) return fail('Private profile storage is not configured.', 503);
    const bytes = Buffer.from(value, 'base64'); const cipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
  }
  publicProfile(row: any) { return row ? { username: row.username, wallet: getAddress(row.wallet), createdAt: row.created_at } : null; }
  byName(value: string) { return this.publicProfile(this.db.prepare('SELECT * FROM accounts WHERE username = ?').get(username(value))); }
  byWallet(value: string) { return this.publicProfile(this.db.prepare('SELECT * FROM accounts WHERE wallet = ?').get(getAddress(value))); }
  search(value: string) {
    if (!/^[a-z][a-z0-9_]{1,23}$/i.test(value)) return fail('Invalid username search.');
    return this.db.prepare('SELECT * FROM accounts WHERE substr(username, 1, ?) = ? COLLATE NOCASE LIMIT 20').all(value.length, value).map(row => this.publicProfile(row));
  }
  me(subject: string) {
    const row: any = this.db.prepare('SELECT * FROM accounts WHERE subject = ?').get(subject);
    return row ? { ...this.publicProfile(row), ...this.decrypt(row.private_data), mobileVerified: false } : null;
  }
  forWallet(wallet: string) {
    const row: any = this.db.prepare('SELECT subject FROM accounts WHERE wallet = ? COLLATE NOCASE').get(getAddress(wallet));
    return row ? this.me(row.subject) : null;
  }
  challenge(subject: string, raw: any, origin: string) {
    if (raw?.consent !== true) return fail('Consent to storing your profile is required.');
    const input = accountInput(raw); const existing = this.me(subject);
    const backup = this.walletBackup(subject);
    if (backup && backup.wallet.toLowerCase() !== input.wallet.toLowerCase()) return fail('Use the wallet already backed up for this Google account.', 409);
    if (existing) return fail('This Google account already has a profile. Sign in to its existing wallet.', 409);
    if (this.byName(input.username) || this.byWallet(input.wallet)) return fail('Username or wallet is already registered.', 409);
    const now = Math.floor(Date.now() / 1000); const nonce = randomBytes(24).toString('hex'); const expires = now + 300;
    const digest = createHash('sha256').update(JSON.stringify({ ...input, subject, nonce })).digest('hex');
    const message = accountMessage(origin, input.wallet, input.username, nonce, expires, digest);
    this.db.prepare('DELETE FROM challenges WHERE expires <= ? OR subject = ?').run(now, subject);
    this.db.prepare('INSERT INTO challenges VALUES (?, ?, ?, ?, ?, ?, ?)').run(nonce, subject, input.wallet, input.username, this.encrypt({ name: input.name, mobile: input.mobile }), message, expires);
    return { nonce, message, expires };
  }
  async complete(subject: string, nonce: string, signature: Hex) {
    if (typeof nonce !== 'string' || !/^[a-f0-9]{48}$/.test(nonce) || typeof signature !== 'string' || !/^0x[\da-f]{130}$/i.test(signature)) return fail('Invalid registration proof.');
    const row: any = this.db.prepare('SELECT * FROM challenges WHERE nonce = ? AND subject = ?').get(nonce, subject);
    if (!row || row.expires <= Math.floor(Date.now() / 1000)) return fail('Registration expired or already completed.');
    if ((await recoverMessageAddress({ message: row.message, signature })).toLowerCase() !== row.wallet.toLowerCase()) return fail('The connected wallet must approve registration.', 403);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const fresh: any = this.db.prepare('SELECT * FROM challenges WHERE nonce = ? AND subject = ?').get(nonce, subject);
      if (!fresh || fresh.expires <= Math.floor(Date.now() / 1000)) fail('Registration expired or already completed.');
      if (this.db.prepare('SELECT 1 FROM accounts WHERE subject = ? OR username = ? OR wallet = ?').get(subject, row.username, row.wallet)) fail('Google account, username or wallet is already registered.', 409);
      const backup = this.walletBackup(subject);
      if (backup && backup.wallet.toLowerCase() !== row.wallet.toLowerCase()) fail('The account is linked to a different encrypted wallet.', 409);
      this.db.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)').run(subject, row.username, row.wallet, row.private_data, Math.floor(Date.now() / 1000));
      this.db.prepare('DELETE FROM challenges WHERE subject = ?').run(subject);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.me(subject);
  }
}
export function accountRouter(directory: AccountDirectory, origins: string[], verify = verifyGoogle) {
  const router = Router(); router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_req, res) => res.json({ profileConfigured: directory.configured, googleClientId: process.env.GOOGLE_CLIENT_ID || '', walletMode: 'password-encrypted' }));
  router.use(rateLimit({ windowMs: 60000, limit: 20 }));
  const requireOrigin = (origin?: string) => { if (!origin || !origins.includes(origin)) fail('Registration origin is not allowed.', 403); return origin!; };
  router.get('/google/challenge', (_req, res) => res.json(directory.googleChallenge()));
  router.post('/google/login', async (req, res) => {
    requireOrigin(req.get('origin'));
    if (typeof req.body?.credential !== 'string' || req.body.credential.length > 8192) return fail('Invalid Google login.', 401);
    const identity = await verify(req.body.credential); directory.consumeGoogleChallenge(identity.nonce);
    res.json({ subject: identity.sub, name: identity.name || '', expiresAt: identity.expiresAt });
  });
  router.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.match(/^Bearer ([^ ]{1,8192})$/)?.[1];
      if (!token) return fail('Sign in with Google first.', 401);
      res.locals.identity = await verify(token); next();
    } catch (error) { next(Object.assign(new Error('Google sign-in could not be verified.'), { status: (error as any).status === 503 ? 503 : 401 })); }
  });
  router.get('/me', (_req, res) => res.json(directory.me(res.locals.identity.sub)));
  router.get('/wallet', (_req, res) => res.json(directory.walletBackup(res.locals.identity.sub)));
  router.post('/wallet/challenge', (req, res) => res.json(directory.walletChallenge(res.locals.identity.sub, req.body, requireOrigin(req.get('origin')))));
  router.post('/wallet/complete', async (req, res) => { requireOrigin(req.get('origin')); res.json(await directory.completeWallet(res.locals.identity.sub, req.body?.nonce, req.body?.signature)); });
  router.post('/challenge', (req, res) => {
    const origin = req.get('origin'); if (!origin || !origins.includes(origin)) return fail('Registration origin is not allowed.', 403);
    res.json(directory.challenge(res.locals.identity.sub, req.body, origin));
  });
  router.post('/complete', async (req, res) => res.json(await directory.complete(res.locals.identity.sub, req.body?.nonce, req.body?.signature)));
  return router;
}
export function profileRouter(directory: AccountDirectory) {
  const router = Router(); router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/address/:address', (req, res) => res.json(directory.byWallet(req.params.address)));
  router.get('/name/:name', (req, res) => res.json(directory.byName(req.params.name)));
  router.get('/search/:prefix', (req, res) => res.json(directory.search(req.params.prefix)));
  router.post('/resolve', (req, res) => {
    if (!Array.isArray(req.body?.usernames) || req.body.usernames.length > 100) return fail('Provide at most 100 usernames.');
    res.json(req.body.usernames.map((name: string) => directory.byName(name)).filter(Boolean));
  });
  router.post('/', (_req, _res) => fail('Complete Google profile registration to reserve a username.', 403));
  return router;
}
