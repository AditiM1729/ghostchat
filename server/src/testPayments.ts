import { DatabaseSync } from 'node:sqlite';
import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getAddress, isAddress, keccak256, recoverMessageAddress, stringToHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TEST_TRADE_CHAIN, testOrderMessage, testPaymentDomain, testPaymentTypes } from '../../shared/testTrade.js';

const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
export interface TestTrade { buyer: Address; state: number; inrPaise: bigint; acceptedAt: bigint; payUntil: bigint; termsHash: Hex }
export interface TestPaymentConfig { keyId: string; keySecret: string; webhookSecret: string; attestorKey: Hex }
export function testPaymentConfig(env = process.env): TestPaymentConfig | undefined {
  if (!env.RAZORPAY_TEST_KEY_ID || !env.RAZORPAY_TEST_KEY_SECRET || !env.TEST_PAYMENT_ATTESTOR_KEY) return;
  if (!/^rzp_test_[a-zA-Z0-9]+$/.test(env.RAZORPAY_TEST_KEY_ID) || !/^0x[0-9a-f]{64}$/i.test(env.TEST_PAYMENT_ATTESTOR_KEY)) throw new Error('Only Razorpay TEST keys and a dedicated test attestor key are supported.');
  return { keyId: env.RAZORPAY_TEST_KEY_ID, keySecret: env.RAZORPAY_TEST_KEY_SECRET, webhookSecret: env.RAZORPAY_TEST_WEBHOOK_SECRET || '', attestorKey: env.TEST_PAYMENT_ATTESTOR_KEY as Hex };
}
export function validHmac(body: string | Buffer, signature: unknown, secret: string) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}
export class TestPayments {
  private db: DatabaseSync;
  readonly account;
  private locks = new Map<string, Promise<unknown>>();
  constructor(readonly config: TestPaymentConfig, path: string, private readTrade: (address: Address, id: bigint, creation: Hex) => Promise<TestTrade>, private request: typeof fetch = fetch) {
    if (!/^rzp_test_[a-zA-Z0-9]+$/.test(config.keyId)) throw new Error('Live Razorpay keys are forbidden.');
    this.account = privateKeyToAccount(config.attestorKey);
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS test_orders (trade_key TEXT PRIMARY KEY, escrow TEXT NOT NULL, trade_id TEXT NOT NULL, terms TEXT NOT NULL, amount INTEGER NOT NULL, order_id TEXT UNIQUE, payment_id TEXT UNIQUE, paid_at INTEGER, receipt TEXT NOT NULL UNIQUE, creation TEXT NOT NULL);`);
  }
  close() { this.db.close(); }
  private async api(path: string, body?: unknown) {
    const response = await this.request(`https://api.razorpay.com/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) return fail('Razorpay Test Mode request failed. Check test credentials and dashboard.', 502);
    return await response.json() as any;
  }
  async authorize(raw: any) {
    if (!isAddress(raw?.escrow || '') || typeof raw?.tradeId !== 'string' || !/^[1-9]\d{0,76}$/.test(raw.tradeId) || BigInt(raw.tradeId) >= 2n ** 256n || !Number.isSafeInteger(raw.timestamp) || Math.abs(Date.now() / 1000 - raw.timestamp) > 300 || typeof raw.signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(raw.signature)) return fail('Invalid test trade authorization.');
    const address = getAddress(raw.escrow);
    if (typeof raw.creation !== 'string' || !/^0x[0-9a-f]{64}$/i.test(raw.creation)) return fail('A verified escrow creation transaction is required.');
    const trade = await this.readTrade(address, BigInt(raw.tradeId), raw.creation);
    const recovered = await recoverMessageAddress({ message: testOrderMessage(address, raw.tradeId, raw.timestamp), signature: raw.signature });
    if (getAddress(trade.buyer) !== getAddress(recovered)) return fail('Only this trade’s buyer can request payment verification.', 403);
    if (trade.state !== 2) return fail('Accept the test trade before payment; completed or returned trades cannot be paid.');
    return { trade, address, id: raw.tradeId, key: `${address.toLowerCase()}:${raw.tradeId}` };
  }
  async order(raw: any) {
    const input = await this.authorize(raw);
    if (input.trade.payUntil < BigInt(Math.floor(Date.now() / 1000))) return fail('The test payment window expired.');
    if (this.locks.has(input.key)) await this.locks.get(input.key);
    const operation = (async () => {
      let row: any = this.db.prepare('SELECT * FROM test_orders WHERE trade_key = ?').get(input.key);
      if (!row) {
        if (input.trade.inrPaise < 100n || input.trade.inrPaise > 10000000n) return fail('Trade amount is outside demo limits.');
        const receipt = keccak256(stringToHex(input.key)).slice(2, 34);
        this.db.prepare('INSERT INTO test_orders(trade_key,escrow,trade_id,terms,amount,receipt,creation) VALUES(?,?,?,?,?,?,?)').run(input.key, input.address, input.id, input.trade.termsHash, Number(input.trade.inrPaise), receipt, raw.creation);
        // Reserve durably BEFORE the remote side effect. Uncertain results must be reconciled, never blindly recreated.
        const order = await this.api('orders', { amount: Number(input.trade.inrPaise), currency: 'INR', receipt, partial_payment: false, notes: { purpose: 'GhostChat testnet demo; no real INR', chain: String(TEST_TRADE_CHAIN) } });
        if (!/^order_[a-zA-Z0-9]+$/.test(order.id) || order.amount !== Number(input.trade.inrPaise) || order.currency !== 'INR' || order.receipt !== receipt) return fail('Unexpected Razorpay test order.', 502);
        this.db.prepare('UPDATE test_orders SET order_id = ? WHERE trade_key = ?').run(order.id, input.key);
        row = this.db.prepare('SELECT * FROM test_orders WHERE trade_key = ?').get(input.key);
      }
      if (!row.order_id) return fail('Order creation is uncertain. Reconcile its receipt in the Test dashboard; no duplicate order was created.', 409);
      if (row.terms !== input.trade.termsHash) return fail('Stored terms do not match the escrow.', 409);
      return { mode: 'test', keyId: this.config.keyId, orderId: row.order_id, amount: row.amount, currency: 'INR' };
    })();
    this.locks.set(input.key, operation);
    try { return await operation; } finally { if (this.locks.get(input.key) === operation) this.locks.delete(input.key); }
  }
  private async recordPayment(row: any, payment: any, trade: TestTrade) {
    if (!/^pay_[a-zA-Z0-9]+$/.test(payment?.id || '') || payment.order_id !== row.order_id || payment.status !== 'captured' || payment.captured !== true || payment.currency !== 'INR' || payment.amount !== row.amount || (payment.amount_refunded ?? 0) !== 0 || payment.refund_status) return fail('No matching, fully captured, unrefunded TEST payment was verified.', 409);
    if (!Number.isSafeInteger(payment.created_at) || BigInt(payment.created_at) < trade.acceptedAt || BigInt(payment.created_at) > trade.payUntil || payment.created_at > Math.floor(Date.now() / 1000)) return fail('Test payment is outside the accepted window.', 409);
    const order = await this.api(`orders/${row.order_id}`);
    if (order.id !== row.order_id || order.receipt !== row.receipt || order.amount !== row.amount || order.currency !== 'INR' || order.status !== 'paid' || order.amount_paid !== row.amount || order.amount_due !== 0) return fail('Razorpay test order is not fully paid.', 409);
    if (row.terms !== trade.termsHash) return fail('Escrow terms changed.', 409);
    try { this.db.prepare('UPDATE test_orders SET payment_id = ?, paid_at = ? WHERE trade_key = ? AND (payment_id IS NULL OR payment_id = ?)').run(payment.id, payment.created_at, row.trade_key, payment.id); }
    catch { return fail('This test payment was already allocated.', 409); }
    const stored: any = this.db.prepare('SELECT payment_id FROM test_orders WHERE trade_key = ?').get(row.trade_key);
    if (stored.payment_id !== payment.id) return fail('A different test payment is already bound.', 409);
    return payment;
  }
  async proof(raw: any) {
    const input = await this.authorize(raw);
    const row: any = this.db.prepare('SELECT * FROM test_orders WHERE trade_key = ?').get(input.key);
    if (!row?.order_id) return fail('Create the test payment order first.', 404);
    let payment: any;
    if (raw.paymentId) {
      if (!/^pay_[a-zA-Z0-9]+$/.test(raw.paymentId) || !validHmac(`${row.order_id}|${raw.paymentId}`, raw.checkoutSignature, this.config.keySecret)) return fail('Checkout signature is invalid.', 403);
      payment = await this.api(`payments/${raw.paymentId}`);
    } else {
      const result = await this.api(`orders/${row.order_id}/payments`);
      payment = result.items?.find((p: any) => p.status === 'captured' && p.captured === true);
      if (!payment) return { mode: 'test', status: 'pending' };
    }
    await this.recordPayment(row, payment, input.trade);
    const now = Math.floor(Date.now() / 1000);
    const validUntil = Number(input.trade.payUntil) + 7 * 86400;
    if (now > validUntil) return fail('The test settlement window expired.');
    // Canonical across this service's escrows. The DB also enforces unique provider payment identity.
    const paymentId = keccak256(stringToHex(`razorpay:test:${this.config.keyId}:${payment.id}`));
    const message = { tradeId: BigInt(input.id), termsHash: input.trade.termsHash, paymentId, paidAt: BigInt(payment.created_at), validUntil: BigInt(validUntil) };
    const signature = await this.account.signTypedData({ domain: testPaymentDomain(input.address), types: testPaymentTypes, primaryType: 'TestPayment', message });
    return { mode: 'test', status: 'verified', paymentId, paidAt: String(payment.created_at), validUntil: String(validUntil), signature };
  }
  async webhook(body: Buffer, signature: unknown) {
    if (!validHmac(body, signature, this.config.webhookSecret)) return fail('Invalid test webhook signature.', 403);
    const event = JSON.parse(body.toString('utf8'));
    if (event.event !== 'payment.captured' && event.event !== 'order.paid') return;
    const payment = event.payload?.payment?.entity;
    if (!/^pay_[a-zA-Z0-9]+$/.test(payment?.id || '') || !/^order_[a-zA-Z0-9]+$/.test(payment?.order_id || '')) return fail('Malformed webhook.');
    const row: any = this.db.prepare('SELECT * FROM test_orders WHERE order_id = ?').get(payment.order_id);
    if (!row) return; // Other orders on the merchant account have no authority here.
    const trade = await this.readTrade(getAddress(row.escrow), BigInt(row.trade_id), row.creation);
    if (trade.state !== 2) return;
    await this.recordPayment(row, await this.api(`payments/${payment.id}`), trade);
  }
}
export function testPaymentRouter(service?: TestPayments) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60000, limit: 30 }));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_req, res) => res.json(service ? { configured: true, mode: 'test', chainId: TEST_TRADE_CHAIN, attestor: service.account.address } : { configured: false, mode: 'test', reason: 'Razorpay Test Mode keys and test attestor are not configured on the relay.' }));
  const required = () => service || fail('Razorpay Test Mode is not configured.', 503);
  router.post('/orders', express.json({ limit: '4kb' }), async (req, res) => res.json(await required().order(req.body)));
  router.post('/verify', express.json({ limit: '4kb' }), async (req, res) => res.json(await required().proof(req.body)));
  router.post('/webhook', express.raw({ type: 'application/json', limit: '32kb' }), async (req, res) => { await required().webhook(req.body, req.headers['x-razorpay-signature']); res.json({ received: true }); });
  return router;
}
