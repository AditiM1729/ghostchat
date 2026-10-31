import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { keccak256, stringToHex } from 'viem';
import { testPaymentDomain, testPaymentTypes } from '../../shared/testTrade.js';
import { testOrderMessage } from '../../shared/testTrade.js';
import { TestPayments } from '../../server/src/testPayments.js';
import { privateKeyToAccount } from 'viem/accounts';
const paymentId = keccak256(stringToHex('razorpay:test:canonical-payment'));
async function setup() {
  const { viem } = await network.connect();
  const [seller, buyer, attestor, attacker] = await viem.getWalletClients();
  const client = await viem.getPublicClient();
  const escrow = await viem.deployContract('GhostChatTestTrade', [attestor.account.address]);
  const expiry = (await client.getBlock()).timestamp + 3600n;
  await escrow.write.offer([buyer.account.address, 10000n, expiry], { value: 100000000000000000n, account: seller.account });
  const t = await escrow.read.getTrade([1n]);
  await escrow.write.accept([1n, t.termsHash], { account: buyer.account });
  const trade = await escrow.read.getTrade([1n]);
  const paidAt = (await client.getBlock()).timestamp; const validUntil = trade.payUntil + 3600n;
  const signature = await attestor.signTypedData({ domain: testPaymentDomain(escrow.address, 31337), types: testPaymentTypes, primaryType: 'TestPayment', message: { tradeId: 1n, termsHash: trade.termsHash, paymentId, paidAt, validUntil } });
  return { escrow, seller, buyer, attestor, attacker, client, trade, paidAt, validUntil, signature, viem };
}
describe('Native tMSTC for mock INR', () => {
  it('runs mock INR checkout verification through the server and releases native tokens on a simulated MST Testnet', async () => {
    const { viem } = await network.create({ network: 'default', override: { chainId: 91562037, initialDate: new Date(Date.now() - 60000).toISOString() } });
    const [seller, buyer, relayer] = await viem.getWalletClients(); const client = await viem.getPublicClient();
    const key = `0x${'89'.repeat(32)}` as const; const signer = privateKeyToAccount(key);
    const escrow = await viem.deployContract('GhostChatTestTrade', [signer.address]);
    await escrow.write.offer([buyer.account.address, 10000n, (await client.getBlock()).timestamp + 3600n], { value: 100000000000000000n, account: seller.account });
    const offered = await escrow.read.getTrade([1n]);
    await escrow.write.accept([1n, offered.termsHash], { account: buyer.account });
    const trade = await escrow.read.getTrade([1n]);
    let captured = false; let receipt = '';
    const api: typeof fetch = async (url, init) => {
      const path = String(url).split('/v1/')[1];
      const payment = { id: 'pay_endtoend', order_id: 'order_endtoend', amount: 10000, currency: 'INR', status: captured ? 'captured' : 'authorized', captured, created_at: Number(trade.acceptedAt), amount_refunded: 0 };
      if (path === 'orders' && init?.method === 'POST') { receipt = JSON.parse(String(init.body)).receipt; return Response.json({ id: 'order_endtoend', amount: 10000, currency: 'INR', receipt }); }
      if (path === 'orders/order_endtoend/payments') return Response.json({ items: [payment] });
      if (path === 'orders/order_endtoend') return Response.json({ id: 'order_endtoend', receipt, amount: 10000, currency: 'INR', status: 'paid', amount_paid: 10000, amount_due: 0 });
      throw new Error('Unexpected simulated provider call');
    };
    const service = new TestPayments({ keyId: 'rzp_test_endtoend', keySecret: 'fixture', webhookSecret: 'fixture', attestorKey: key }, ':memory:', async () => await escrow.read.getTrade([1n]), api);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const input = { escrow: escrow.address, creation: `0x${'ab'.repeat(32)}`, tradeId: '1', timestamp, signature: await buyer.signMessage({ message: testOrderMessage(escrow.address, '1', timestamp) }) };
      await service.order(input);
      assert.equal((await service.proof(input)).status, 'pending');
      assert.equal(await client.getBalance({ address: escrow.address }), trade.amount);
      captured = true;
      const p = await service.proof(input) as any;
      const before = await client.getBalance({ address: buyer.account.address });
      await escrow.write.settle([1n, p.paymentId, BigInt(p.paidAt), BigInt(p.validUntil), p.signature], { account: relayer.account });
      assert.equal(await client.getBalance({ address: buyer.account.address }), before + trade.amount);
      assert.equal((await escrow.read.getTrade([1n])).state, 3);
      await assert.rejects(service.proof(input), /completed or returned/);
    } finally { service.close(); }
  });
  it('rejects mainnet deployments', async () => {
    const { viem } = await network.create({ network: 'default', override: { chainId: 4646 } });
    const [signer] = await viem.getWalletClients();
    await assert.rejects(viem.deployContract('GhostChatTestTrade', [signer.account.address]), /TestnetOnly/);
  });
  it('releases the exact native amount only to the fixed buyer and prevents duplicate settlement', async () => {
    const x = await setup(); const before = await x.client.getBalance({ address: x.buyer.account.address });
    await x.escrow.write.settle([1n, paymentId, x.paidAt, x.validUntil, x.signature], { account: x.attacker.account });
    assert.equal(await x.client.getBalance({ address: x.buyer.account.address }), before + x.trade.amount);
    assert.equal(await x.client.getBalance({ address: x.escrow.address }), 0n);
    assert.equal((await x.escrow.read.getTrade([1n])).state, 3);
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.paidAt, x.validUntil, x.signature]), /WrongState/);
  });
  it('rejects forged signatures, altered evidence and cross-escrow replay', async () => {
    const x = await setup();
    const forged = await x.attacker.signTypedData({ domain: testPaymentDomain(x.escrow.address, 31337), types: testPaymentTypes, primaryType: 'TestPayment', message: { tradeId: 1n, termsHash: x.trade.termsHash, paymentId, paidAt: x.paidAt, validUntil: x.validUntil } });
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.paidAt, x.validUntil, forged]), /InvalidAttestation/);
    await assert.rejects(x.escrow.write.settle([1n, keccak256(stringToHex('altered')), x.paidAt, x.validUntil, x.signature]), /InvalidAttestation/);
    const other = await x.viem.deployContract('GhostChatTestTrade', [x.attestor.account.address]);
    await other.write.offer([x.buyer.account.address, 10000n, x.trade.payUntil], { value: 100n });
    const t = await other.read.getTrade([1n]); await other.write.accept([1n, t.termsHash], { account: x.buyer.account });
    await assert.rejects(other.write.settle([1n, paymentId, (await other.read.getTrade([1n])).acceptedAt, x.validUntil, x.signature]), /InvalidAttestation/);
    assert.equal(await x.client.getBalance({ address: x.escrow.address }), x.trade.amount);
  });
  it('prevents seller withdrawal after acceptance; buyer can return test allocation', async () => {
    const x = await setup();
    await assert.rejects(x.escrow.write.refund([1n], { account: x.seller.account }), /WrongStateOrParty/);
    await x.escrow.write.refund([1n], { account: x.buyer.account });
    assert.equal((await x.escrow.read.getTrade([1n])).state, 4);
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.paidAt, x.validUntil, x.signature]), /WrongState/);
  });
  it('rejects pre-acceptance, future and expired payment evidence', async () => {
    const x = await setup();
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.trade.acceptedAt - 1n, x.validUntil, x.signature]), /InvalidPaymentTime/);
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.trade.payUntil + 1n, x.validUntil, x.signature]), /InvalidPaymentTime/);
    await assert.rejects(x.escrow.write.settle([1n, paymentId, x.paidAt, x.paidAt - 1n, x.signature]), /ExpiredProof/);
  });
});
