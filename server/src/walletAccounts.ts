import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getAddress, isAddress, recoverMessageAddress, type Hex } from 'viem';
import { SignJWT } from 'jose';
import { ServiceUnavailable } from './serviceErrors.js';
import type { AccountDirectory } from './accounts.js';
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export class WalletAccounts {
  private db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS login_challenges(nonce TEXT PRIMARY KEY,wallet TEXT NOT NULL,origin TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,wallet TEXT NOT NULL,expires INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  challenge(wallet: unknown, origin: string) {
    if (typeof wallet !== 'string' || !isAddress(wallet) || /^0x0{40}$/i.test(wallet)) return fail('Connect a valid BridgeKey wallet.');
    const address = getAddress(wallet); const nonce = randomBytes(24).toString('hex'); const now = Math.floor(Date.now() / 1000); const expires = now + 300;
    const message = `GhostChat wallet sign in\nApplication: ${origin}\nWallet: ${address}\nNonce: ${nonce}\nIssued: ${now}\nExpires: ${expires}\nSign in to GhostChat. This does not authorize a payment or access to your private key.`;
    this.db.prepare('DELETE FROM login_challenges WHERE expires <= ? OR (wallet = ? AND origin = ?)').run(now, address, origin);
    this.db.prepare('INSERT INTO login_challenges VALUES(?,?,?,?,?)').run(nonce, address, origin, message, expires);
    return { nonce, message, expires };
  }
  async login(nonce: unknown, signature: unknown, origin: string) {
    if (typeof nonce !== 'string' || !/^[a-f0-9]{48}$/.test(nonce) || typeof signature !== 'string' || !/^0x[a-f0-9]{130}$/i.test(signature)) return fail('Invalid wallet login.');
    const row: any = this.db.prepare('SELECT * FROM login_challenges WHERE nonce = ?').get(nonce);
    const now = Math.floor(Date.now() / 1000);
    if (!row || row.origin !== origin || row.expires <= now) return fail('Wallet login expired or origin changed.', 401);
    if (getAddress(await recoverMessageAddress({ message: row.message, signature: signature as Hex })) !== row.wallet) return fail('The connected wallet must sign its own login.', 401);
    if (this.db.prepare('DELETE FROM login_challenges WHERE nonce = ? AND expires > ?').run(nonce, Math.floor(Date.now() / 1000)).changes !== 1) return fail('Wallet login was already used.', 401);
    const token = randomBytes(32).toString('hex'); const expiresAt = now + 3600;
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), row.wallet, expiresAt);
    return { token, wallet: row.wallet, expiresAt };
  }
  authenticate(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return fail('Sign in with BridgeKey first.', 401);
    const row: any = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires > ?').get(digest(token), Math.floor(Date.now() / 1000));
    if (!row) return fail('Wallet session expired. Sign in again.', 401);
    return row.wallet as string;
  }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token)); }
}
export function matrixWalletIdentity(wallet: string, hostname: string) { return `@w_${getAddress(wallet).slice(2).toLowerCase()}:${hostname}`; }
export function matrixConfiguration(env = process.env): { configured: true; homeserver: URL; secret: string } | { configured: false; reason: 'matrix_not_configured' | 'matrix_invalid_configuration' } {
  if (!env.MATRIX_JWT_SECRET || !env.MATRIX_HOMESERVER) return { configured: false, reason: 'matrix_not_configured' };
  try {
    const homeserver = new URL(env.MATRIX_HOMESERVER);
    if (env.MATRIX_JWT_SECRET.length < 64 || homeserver.protocol !== 'https:' || homeserver.username || homeserver.password || homeserver.pathname !== '/' || homeserver.search || homeserver.hash) throw new Error();
    return { configured: true, homeserver, secret: env.MATRIX_JWT_SECRET };
  } catch { return { configured: false, reason: 'matrix_invalid_configuration' }; }
}
export async function matrixTicket(wallet: string, env = process.env) {
  const config = matrixConfiguration(env);
  if (!config.configured) throw new ServiceUnavailable(config.reason);
  const { homeserver, secret } = config;
  const userId = matrixWalletIdentity(wallet, homeserver.hostname);
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId.slice(1).split(':')[0]).setIssuer('ghostchat-wallet').setAudience('ghostchat-matrix').setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(secret));
  return { homeserver: homeserver.origin, userId, token };
}
export function walletAccountRouter(directory: AccountDirectory, origins: string[], auth: WalletAccounts) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_req, res) => {
    const matrix = matrixConfiguration();
    res.json({ profileConfigured: directory.configured, walletMode: 'bridgekey', matrixConfigured: matrix.configured, matrix: matrix.configured ? { configured: true, homeserver: matrix.homeserver.origin } : { configured: false, reason: matrix.reason } });
  });
  router.use(rateLimit({ windowMs: 60000, limit: 40 }));
  const origin = (value?: string) => value && origins.includes(value) ? value : fail('Application origin is not allowed.', 403);
  router.post('/wallet-auth/challenge', (req, res) => res.json(auth.challenge(req.body?.wallet, origin(req.get('origin')))));
  router.post('/wallet-auth/login', async (req, res) => res.json(await auth.login(req.body?.nonce, req.body?.signature, origin(req.get('origin')))));
  router.use((req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1] || '';
    res.locals.wallet = auth.authenticate(token); res.locals.walletToken = token; next();
  });
  router.post('/wallet-auth/logout', (req, res) => { origin(req.get('origin')); auth.logout(res.locals.walletToken); res.json({ ok: true }); });
  router.get('/me', (_req, res) => res.json(directory.forWallet(res.locals.wallet)));
  router.post('/challenge', (req, res) => {
    if (typeof req.body?.wallet !== 'string' || getAddress(req.body.wallet) !== res.locals.wallet) return fail('Profile must match the authenticated wallet.', 403);
    res.json(directory.challenge(`wallet:${res.locals.wallet.toLowerCase()}`, req.body, origin(req.get('origin'))));
  });
  router.post('/complete', async (req, res) => { origin(req.get('origin')); res.json(await directory.complete(`wallet:${res.locals.wallet.toLowerCase()}`, req.body?.nonce, req.body?.signature)); });
  router.post('/matrix-ticket', async (req, res) => {
    origin(req.get('origin')); if (!directory.forWallet(res.locals.wallet)) return fail('Complete your profile before starting chat.', 409);
    res.json(await matrixTicket(res.locals.wallet));
  });
  return router;
}
