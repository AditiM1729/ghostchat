import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, stringToHex, keccak256, type Address } from 'viem';
import { TestPayments, testPaymentConfig, validHmac } from '../src/testPayments.js';
import { testOrderMessage, testPaymentDomain, testPaymentTypes } from '../../shared/testTrade.js';
const buyer = privateKeyToAccount(`0x${'12'.repeat(32)}`);
const attacker = privateKeyToAccount(`0x${'34'.repeat(32)}`);
const escrow = '0x1111111111111111111111111111111111111111' as Address;
const config = { keyId: 'rzp_test_demo', keySecret: 'fixture-test-secret', webhookSecret: 'fixture-webhook-secret', attestorKey: `0x${'56'.repeat(32)}` as const };
const hmac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex');
async function setup(path = ':memory:') {
  const now = Math.floor(Date.now() / 1000);
  const trade = { buyer: buyer.address, state: 2, inrPaise: 10000n, acceptedAt: BigInt(now - 20), payUntil: BigInt(now + 1200), termsHash: keccak256(stringToHex('accepted terms')) };
  let creates = 0; let captured = true; let amount = 10000; let receipt = ''; let paidAt = now;
  const request: typeof fetch = async (raw, init) => {
    const path = String(raw).split('/v1/')[1];
    const payment = { id: 'pay_test1', order_id: 'order_test1', status: captured ? 'captured' : 'authorized', captured, currency: 'INR', amount, amount_refunded: 0, created_at: paidAt };
    if (path === 'orders' && init?.method === 'POST') { creates++; receipt = JSON.parse(String(init.body)).receipt; return Response.json({ id: 'order_test1', amount, currency: 'INR', receipt }); }
    if (path === 'orders/order_test1/payments') return Response.json({ items: [payment] });
    if (path === 'payments/pay_test1') return Response.json(payment);
    if (path === 'orders/order_test1') return Response.json({ id: 'order_test1', receipt, amount, currency: 'INR', status: 'paid', amount_paid: amount, amount_due: 0 });
    throw new Error('Unexpected test API call');
  };
  const read = async () => trade;
  const service = new TestPayments(config, path, read, request);
  const raw = { escrow, creation: `0x${'78'.repeat(32)}`, tradeId: '1', timestamp: now, signature: await buyer.signMessage({ message: testOrderMessage(escrow, '1', now) }) };
  return { service, raw, trade, read, request, creates: () => creates, capture: (v: boolean) => { captured = v; }, amount: (v: number) => { amount = v; }, time: (v: number) => { paidAt = v; } };
}
describe('Razorpay test payment verification', () => {
  it('rejects live credentials and tampered webhook payloads', () => {
    assert.throws(() => testPaymentConfig({ RAZORPAY_TEST_KEY_ID: 'rzp_live_x', RAZORPAY_TEST_KEY_SECRET: 'secret', TEST_PAYMENT_ATTESTOR_KEY: config.attestorKey }), /TEST/);
    const signature = hmac('{"event":"payment.captured"}', config.webhookSecret);
    assert.equal(validHmac('{"event":"payment.captured"}', signature, config.webhookSecret), true);
    assert.equal(validHmac('{ "event":"payment.captured"}', signature, config.webhookSecret), false);
    assert.equal(validHmac('body', 'not-hex', config.webhookSecret), false);
  });
  it('requires the named buyer and exact signed trade', async () => {
    const x = await setup();
    try {
      await assert.rejects(x.service.order({ ...x.raw, signature: await attacker.signMessage({ message: testOrderMessage(escrow, '1', x.raw.timestamp) }) }), /buyer/);
      await assert.rejects(x.service.order({ ...x.raw, tradeId: '2' }), /buyer/);
      assert.equal(x.creates(), 0);
    } finally { x.service.close(); }
  });
  it('creates one durable order and produces verifiable settlement permission only for a captured payment', async () => {
    const x = await setup();
    try {
      await x.service.order(x.raw); await x.service.order(x.raw); assert.equal(x.creates(), 1);
      x.capture(false); assert.equal((await x.service.proof(x.raw)).status, 'pending');
      x.capture(true); const p = await x.service.proof(x.raw) as any;
      const signer = await recoverTypedDataAddress({ domain: testPaymentDomain(escrow), types: testPaymentTypes, primaryType: 'TestPayment', message: { tradeId: 1n, termsHash: x.trade.termsHash, paymentId: p.paymentId, paidAt: BigInt(p.paidAt), validUntil: BigInt(p.validUntil) }, signature: p.signature });
      assert.equal(signer, x.service.account.address);
      const repeat = await x.service.proof(x.raw) as any; assert.equal(p.paymentId, repeat.paymentId);
    } finally { x.service.close(); }
  });
  it('rejects forged checkout success, wrong amounts and payments outside the trade window', async () => {
    const x = await setup();
    try {
      await x.service.order(x.raw);
      await assert.rejects(x.service.proof({ ...x.raw, paymentId: 'pay_test1', checkoutSignature: '0'.repeat(64) }), /signature/);
      x.amount(9999); await assert.rejects(x.service.proof(x.raw), /matching/);
      x.amount(10000); x.time(Number(x.trade.acceptedAt) - 1); await assert.rejects(x.service.proof(x.raw), /window/);
      x.time(Math.floor(Date.now() / 1000));
      const p = await x.service.proof({ ...x.raw, paymentId: 'pay_test1', checkoutSignature: hmac('order_test1|pay_test1', config.keySecret) }); assert.equal(p.status, 'verified');
    } finally { x.service.close(); }
  });
  it('does not accept a spoofed webhook or trust its claimed amount', async () => {
    const x = await setup();
    try {
      await x.service.order(x.raw);
      const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_test1', order_id: 'order_test1', amount: 10000 } } } }));
      await assert.rejects(x.service.webhook(body, '0'.repeat(64)), /signature/);
      x.amount(9999); await assert.rejects(x.service.webhook(body, hmac(body.toString(), config.webhookSecret)), /matching/);
      x.amount(10000); await x.service.webhook(body, hmac(body.toString(), config.webhookSecret));
      await x.service.webhook(body, hmac(body.toString(), config.webhookSecret));
    } finally { x.service.close(); }
  });
  it('resumes an order after server restart without creating another payment request', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghostchat-test-payments-')); const path = join(dir, 'orders.sqlite');
    const x = await setup(path);
    try {
      await x.service.order(x.raw); x.service.close();
      const restarted = new TestPayments(config, path, x.read, x.request);
      try { assert.equal((await restarted.order(x.raw)).orderId, 'order_test1'); assert.equal(x.creates(), 1); assert.equal((await restarted.proof(x.raw)).status, 'verified'); } finally { restarted.close(); }
    } finally { assert.equal(dirname(resolve(dir)), resolve(tmpdir())); rmSync(dir, { recursive: true, force: true }); }
  });
});
