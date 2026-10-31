import { it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesOffer, nextTradeStep } from '../src/p2p/tradeJourney';
import { parseEther } from 'viem';
import { normalizeSellerTrade } from '../../shared/sellerTradeModel';

it('rejects offer links that point to a different buyer, seller, or payment terms', () => {
  const bid = { id: 'a', buyer: 'buyer', seller: 'seller', amount: '0.1', rate: '100', paise: '1000', status: 'funded' };
  const t = ['seller', 'buyer', 'arb', parseEther('0.1'), 1000n, 1, false] as const;
  assert.equal(matchesOffer(bid, t), true);
  assert.equal(matchesOffer({ ...bid, buyer: 'another-buyer' }, t), false);
  assert.equal(matchesOffer({ ...bid, seller: 'another-seller' }, t), false);
  assert.equal(matchesOffer({ ...bid, paise: '100' }, t), false);
  assert.equal(matchesOffer({ ...bid, amount: '1' }, t), false);
});
it('maps both escrow versions without mistaking released or returned tokens for an active payment', () => {
  const seller = `0x${'11'.repeat(20)}`, buyer = `0x${'22'.repeat(20)}`;
  for (const [actual, expected] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5], [5, 6], [6, 4]]) {
    const t = normalizeSellerTrade([seller, buyer, 100n, 1000n, actual], true);
    assert.equal(t[5], expected); assert.equal(t[3], 100n); assert.equal(t[4], 1000n);
    assert.equal(t[6], true);
  }
  assert.match(nextTradeStep(1, 'buyer', true, true, true), /No arbitrator/);
  assert.match(nextTradeStep(4, 'buyer', true, true, true), /stay locked/);
  assert.match(nextTradeStep(6, 'buyer', true, true, true), /Do not send INR/);
  assert.match(nextTradeStep(1, 'buyer', true, true, true, true), /Pay the exact INR/);
  assert.doesNotMatch(nextTradeStep(1, 'buyer', true, true, true, true), /Accept/);
  assert.match(nextTradeStep(4, 'buyer', true, true, true, true), /correction/);
});
it('guides the exact participant through acceptance before presenting payment as the next step', () => {
  assert.match(nextTradeStep(1, 'visitor', false, true), /Switch BridgeKey/);
  assert.match(nextTradeStep(1, 'buyer', false, true), /Do not send INR/);
  assert.match(nextTradeStep(1, 'arbitrator', false, false), /Accept the arbitrator role/);
  assert.match(nextTradeStep(1, 'buyer', true, false), /Waiting for the seller/);
  assert.match(nextTradeStep(1, 'buyer', true, true), /Accept the trade/);
  assert.match(nextTradeStep(2, 'buyer', true, true), /Pay the exact INR/);
  assert.match(nextTradeStep(3, 'buyer', true, true), /Do not pay a second time/);
  assert.match(nextTradeStep(3, 'seller', true, true), /Check your bank/);
  assert.match(nextTradeStep(6, 'buyer', true, true), /Do not send INR/);
});
