import { privateKeyToAccount } from 'viem/accounts';
import { normalizeUTR, utrDomain, utrConfirmationTypes } from '../../shared/utrConfirmation.js';
import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { getAddress, isAddress } from 'viem';
import type { WalletAccounts } from './walletAccounts.js';
import { BuyOffers } from './buyOffers.js';

type Parties = { seller: string; buyer: string; state: number; amount?: bigint; inrPaise?: bigint; simple?: boolean; protocol?: number; verifier?: string; buyerCommitment?: string; sellerCommitment?: string };
export type CheckPrivateTrade = (escrow: string, id: bigint, creation: string) => Promise<Parties>;
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
export class PrivateTradeDetails {
  private db: DatabaseSync;
  offers: BuyOffers;
  constructor(path: string, private key: Buffer, private check: CheckPrivateTrade) {
    if (key.length !== 32) throw new Error('Private payment storage requires a 32-byte key.');
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS private_trade_details (trade TEXT PRIMARY KEY, payload TEXT NOT NULL);');
    this.db.exec('CREATE TABLE IF NOT EXISTS private_upi_profiles (wallet TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS p2p_configuration (id TEXT PRIMARY KEY,payload TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS private_utr_candidates (trade TEXT NOT NULL, actor TEXT NOT NULL, commitment TEXT NOT NULL, PRIMARY KEY(trade,actor))');
    this.offers = new BuyOffers(this.db, check);
  }
  private validatePayment(input: any) {
      const upiId = typeof input.upiId === 'string' ? input.upiId.trim() : '';
      const qr = input.qr;
      if (!/^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z0-9]{2,64}$/.test(upiId)) return fail('Enter a valid UPI ID.');
      if (typeof qr !== 'string' || qr.length > 1_400_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(qr)) return fail('Upload a PNG, JPEG or WebP QR image under 1 MB.');
      const bytes = Buffer.from(qr.split(',')[1], 'base64');
      const valid = qr.startsWith('data:image/png;') ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : qr.startsWith('data:image/jpeg;') ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid || bytes.length > 1_000_000) return fail('Invalid QR image.');
      return { upiId, qr };
  }
  private encrypt(id: string, value: unknown) {
    const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, nonce); cipher.setAAD(Buffer.from(id));
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64');
  }
  private decrypt(id: string, payload: string) {
    const bytes = Buffer.from(payload, 'base64'); const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(id));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  }
  async profile(wallet: string, input: any, save: boolean) {
    const owner = getAddress(wallet).toLowerCase(); const key = `upi-profile:${owner}`;
    if (save) {
      const value = this.validatePayment(input);
      this.db.prepare('INSERT INTO private_upi_profiles VALUES(?,?) ON CONFLICT(wallet) DO UPDATE SET payload=excluded.payload').run(owner, this.encrypt(key, value));
      return { saved: true };
    }
    const row = this.db.prepare('SELECT payload FROM private_upi_profiles WHERE wallet=?').get(owner) as { payload: string } | undefined;
    if (!row) return fail('No saved UPI profile yet.', 404);
    return this.decrypt(key, row.payload);
  }
  async simpleConfig(input?: any) {
    if (input) {
      if (!isAddress(input.escrow || '') || !/^0x[\da-f]{64}$/i.test(input.creation || '')) return fail('Invalid escrow deployment.');
      const verified = await this.check(getAddress(input.escrow), 1n, input.creation);
      if (!verified.simple || verified.protocol !== 3) return fail('This is not the mutual UTR escrow.');
      const value = { escrow: getAddress(input.escrow), creation: input.creation.toLowerCase() };
      const old = this.db.prepare("SELECT payload FROM p2p_configuration WHERE id='mutual-utr-v1'").get() as { payload: string } | undefined;
      if (old && JSON.stringify(JSON.parse(old.payload)) !== JSON.stringify(value)) return fail('A shared simplified escrow is already configured.', 409);
      this.db.prepare("INSERT OR IGNORE INTO p2p_configuration VALUES('mutual-utr-v1',?)").run(JSON.stringify(value));
    }
    const row = this.db.prepare("SELECT payload FROM p2p_configuration WHERE id='mutual-utr-v1'").get() as { payload: string } | undefined;
    return row ? { configured: true, ...JSON.parse(row.payload), utrVerifier: this.utrSigner().address } : { configured: false, utrVerifier: this.utrSigner().address };
  }
  private utrSigner() {
    const derived = createHmac('sha256', this.key).update('ghostchat-mutual-utr-attestor-v1').digest('hex');
    return privateKeyToAccount(`0x${derived}`);
  }
  async utr(wallet: string, input: any) {
    if (!isAddress(input?.escrow || '') || !/^0x[\da-f]{64}$/i.test(input?.creation || '') || !/^[1-9]\d{0,76}$/.test(input?.tradeId || '') || BigInt(input.tradeId) >= 2n ** 256n) return fail('Invalid trade reference.');
    const actor = getAddress(wallet); const escrow = getAddress(input.escrow); const tradeId = BigInt(input.tradeId);
    const t = await this.check(escrow, tradeId, input.creation);
    const seller = actor.toLowerCase() === t.seller.toLowerCase(); const buyer = actor.toLowerCase() === t.buyer.toLowerCase();
    if (!t.state || (!seller && !buyer)) return fail('Only this trade’s buyer and seller can confirm references.', 403);
    const signer = this.utrSigner();
    if (t.protocol !== 3 || t.verifier?.toLowerCase() !== signer.address.toLowerCase()) return fail('This trade does not use this relay’s mutual UTR verifier.');
    const id = `91562037:${escrow.toLowerCase()}:${tradeId}`;
    const active = [1, 3, 4].includes(t.state);
    if (input.utr !== undefined) {
      if (!active) return fail('This trade is already closed.', 409);
      if ((seller && input.paymentReceived !== true) || (buyer && input.paymentSent !== true)) return fail(seller ? 'Check your own bank app and confirm receipt first.' : 'Confirm that you sent the agreed INR first.');
      let reference: string;
      try { reference = normalizeUTR(input.utr); } catch { return fail('Enter an 8–32 character bank reference.'); }
      const commitment = `0x${createHmac('sha256', this.key).update(`ghostchat-utr-v1|${id}|${reference}`).digest('hex')}`;
      // Raw references are transient: persist only a keyed, trade-scoped commitment.
      this.db.prepare('INSERT INTO private_utr_candidates VALUES(?,?,?) ON CONFLICT(trade,actor) DO UPDATE SET commitment=excluded.commitment').run(id, actor.toLowerCase(), commitment);
    }
    const own = this.db.prepare('SELECT commitment FROM private_utr_candidates WHERE trade=? AND actor=?').get(id, actor.toLowerCase()) as { commitment: `0x${string}` } | undefined;
    const other = this.db.prepare('SELECT commitment FROM private_utr_candidates WHERE trade=? AND actor=?').get(id, (seller ? t.buyer : t.seller).toLowerCase()) as { commitment: string } | undefined;
    const signature = own && active ? await signer.signTypedData({ domain: utrDomain(91562037, escrow), types: utrConfirmationTypes, primaryType: 'UTRConfirmation', message: { tradeId, actor, commitment: own.commitment } }) : undefined;
    const ownChain = seller ? t.sellerCommitment : t.buyerCommitment;
    const otherChain = seller ? t.buyerCommitment : t.sellerCommitment;
    return { ownConfirmed: !!own && ownChain?.toLowerCase() === own.commitment.toLowerCase(), otherConfirmed: !!otherChain && !/^0x0{64}$/i.test(otherChain), ownSubmitted: !!own, otherSubmitted: !!other, referencesMatch: own && other ? own.commitment === other.commitment : null, commitment: own?.commitment, signature, bankVerified: false };
  }
  close() { this.db.close(); }
  async access(wallet: string, input: any, save = false) {
    if (!isAddress(input?.escrow || '') || typeof input?.creation !== 'string' || !/^0x[\da-f]{64}$/i.test(input.creation) || typeof input?.tradeId !== 'string' || !/^[1-9]\d{0,76}$/.test(input.tradeId) || BigInt(input.tradeId) >= 2n ** 256n) return fail('Invalid trade reference.');
    const escrow = getAddress(input.escrow); const t = await this.check(escrow, BigInt(input.tradeId), input.creation);
    if (t.protocol === 3 && t.verifier?.toLowerCase() !== this.utrSigner().address.toLowerCase()) return fail('The trade uses a different UTR relay. Do not pay through this application.', 409);
    const seller = wallet.toLowerCase() === t.seller.toLowerCase(); const buyer = wallet.toLowerCase() === t.buyer.toLowerCase();
    if (!t.state || (!seller && !buyer)) return fail('This payment information is private to the trade parties.', 403);
    if (!save && input.statusOnly === true) return { ready: !!this.db.prepare('SELECT 1 FROM private_trade_details WHERE trade = ?').get(`91562037:${escrow.toLowerCase()}:${input.tradeId}`) };
    if (save && (!seller || t.state !== 1)) return fail('Only the seller can save details before acceptance.', 403);
    if (!seller && !([2, 3, 4].includes(t.state) || (t.protocol === 3 && t.state === 1))) return fail('Payment details are available only to the accepted buyer during the trade.', 403);
    const id = `91562037:${escrow.toLowerCase()}:${input.tradeId}`;
    if (save) {
      if (input.useProfile === true) input = { ...input, ...await this.profile(wallet, {}, false) };
      const { upiId, qr } = this.validatePayment(input);
      // First write wins: details cannot race with buyer acceptance or be silently replaced.
      const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, nonce); cipher.setAAD(Buffer.from(id));
      const data = Buffer.concat([cipher.update(JSON.stringify({ upiId, qr }), 'utf8'), cipher.final()]);
      const payload = Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64');
      const result = this.db.prepare('INSERT OR IGNORE INTO private_trade_details VALUES(?,?)').run(id, payload);
      if (!result.changes) return fail('Payment details are already fixed for this offer. Create a new offer to change them.', 409);
      return { saved: true };
    }
    const row = this.db.prepare('SELECT payload FROM private_trade_details WHERE trade = ?').get(id) as { payload: string } | undefined;
    if (!row) return fail('Seller has not saved payment details yet.', 404);
    const bytes = Buffer.from(row.payload, 'base64'); const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(id));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  }
}
export function privateTradeRouter(auth: WalletAccounts, service?: PrivateTradeDetails) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('X-GhostChat-Private-P2P', service ? '1' : 'unconfigured'); res.setHeader('X-GhostChat-P2P-Flow', service ? 'mutual-utr-v1' : 'unconfigured'); res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Pragma', 'no-cache'); next(); });
  router.use((req, res, next) => { try { res.locals.wallet = auth.authenticate(req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] || ''); next(); } catch (e) { next(e); } });
  router.post('/:action', async (req, res) => {
    if (!service) return fail('Private P2P storage is not configured on this server.', 503);
    if (req.params.action === 'utr') { res.json(await service.utr(res.locals.wallet, req.body)); return; }
    if (['simple-config', 'simple-register'].includes(req.params.action)) { res.json(await service.simpleConfig(req.params.action === 'simple-register' ? req.body : undefined)); return; }
    if (['profile-read', 'profile-save'].includes(req.params.action)) { res.json(await service.profile(res.locals.wallet, req.body, req.params.action === 'profile-save')); return; }
    if (req.params.action.startsWith('offers-')) { res.json(await service.offers.access(res.locals.wallet, req.params.action.slice(7), req.body)); return; }
    if (!['read', 'save'].includes(req.params.action)) return fail('Unknown action.', 404);
    res.json(await service.access(res.locals.wallet, req.body, req.params.action === 'save'));
  });
  return router;
}
