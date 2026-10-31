import { it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parseEther } from 'viem';
import { BuyOffers } from '../src/buyOffers.js';

const buyer = `0x${'11'.repeat(20)}`, seller = `0x${'22'.repeat(20)}`, other = `0x${'33'.repeat(20)}`;
it('binds authenticated buyers, reserves one seller and verifies the funded terms', async () => {
  const db = new DatabaseSync(':memory:'); let wrong = true;
  const service = new BuyOffers(db, async () => ({ buyer, seller, state: 1, amount: parseEther(wrong ? '2' : '0.1'), inrPaise: 1000n }));
  try {
    const bid: any = await service.access(buyer, 'create', { buyer: other, amount: '0.1', rate: '100' });
    assert.equal(bid.buyer, buyer); assert.equal(bid.paise, '1000');
    await assert.rejects(service.access(buyer, 'select', { id: bid.id }), /own/);
    await service.access(seller, 'select', { id: bid.id });
    await assert.rejects(service.access(other, 'select', { id: bid.id }), /already selected/);
    assert.equal((await service.access(other, 'list', {}) as any).offers.length, 0);
    const ref = { id: bid.id, escrow: `0x${'44'.repeat(20)}`, creation: `0x${'55'.repeat(32)}`, tradeId: '1' };
    await assert.rejects(service.access(other, 'link', ref), /selected seller/);
    await assert.rejects(service.access(seller, 'link', ref), /does not match/);
    wrong = false;
    assert.equal((await service.access(seller, 'link', ref) as any).status, 'funded');
    assert.equal((await service.access(seller, 'link', ref) as any).tradeId, '1');
    await assert.rejects(service.access(seller, 'link', { ...ref, tradeId: '2' }), /already has/);
  } finally { db.close(); }
});
it('rounds INR conservatively and allows only open buyer withdrawals', async () => {
  const db = new DatabaseSync(':memory:'); const service = new BuyOffers(db, async () => { throw new Error('unused'); });
  try {
    const bid: any = await service.access(buyer, 'create', { amount: '0.333', rate: '10' });
    assert.equal(bid.paise, '333');
    await assert.rejects(service.access(seller, 'cancel', { id: bid.id }), /Only the buyer/);
    await service.access(buyer, 'cancel', { id: bid.id });
    await assert.rejects(service.access(seller, 'select', { id: bid.id }), /already selected/);
    await assert.rejects(service.access(buyer, 'create', { amount: '11', rate: '100' }), /up to 10/);
  } finally { db.close(); }
});
