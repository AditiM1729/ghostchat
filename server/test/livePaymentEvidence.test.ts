import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLivePaymentEvidence } from '../src/livePaymentEvidence.js';
const trade = { tradeId:'trade-1', provider:'approved-bank', beneficiaryAccountId:'seller-1', orderId:'order-1', amountPaise:10000, acceptedAt:100, payUntil:200 };
const credit = { provider:'approved-bank', beneficiaryAccountId:'seller-1', orderId:'order-1', paymentId:'credit-1', amountPaise:10000, currency:'INR', status:'credited', creditedAt:150 };
test('accepts only the exact credited payment and returns its replay identity', () => {
  assert.deepEqual(validateLivePaymentEvidence(trade,credit,160), {provider:'approved-bank',paymentId:'credit-1',tradeId:'trade-1'});
});
test('rejects incorrect recipient, order, amount, currency and pending status', () => {
  for (const change of [{beneficiaryAccountId:'seller-2'}, {orderId:'other'}, {amountPaise:9999}, {currency:'USD'}, {status:'pending'}, {provider:'other'}]) assert.throws(() => validateLivePaymentEvidence(trade,{...credit,...change},160));
});
test('rejects future, stale and malformed payment evidence', () => {
  for (const change of [{creditedAt:99}, {creditedAt:201}, {creditedAt:161}, {amountPaise:NaN}, {paymentId:''}]) assert.throws(() => validateLivePaymentEvidence(trade,{...credit,...change},160));
});
