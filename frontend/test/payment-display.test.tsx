import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { TradePaymentDetails } from '../src/p2p/TradePaymentDetails';
import { mergePaymentSnapshot, paymentForScope } from '../src/p2p/paymentSnapshot';

const details = { upiId: 'seller@bank', qr: 'data:image/png;base64,iVBORw0KGgo=' };
it('shows UPI payment actions only to the buyer, even if canPay is accidentally true for the seller', () => {
  const seller = renderToStaticMarkup(<TradePaymentDetails role="seller" details={details} amount="10.00" canPay onCopy={() => {}}/>);
  assert.match(seller, /You receive/);
  assert.match(seller, /you do not pay INR/);
  assert.doesNotMatch(seller, /upi:\/\/pay|Scan this QR|Copy seller UPI|Open UPI app/);
  const buyer = renderToStaticMarkup(<TradePaymentDetails role="buyer" details={details} amount="10.00" canPay onCopy={() => {}}/>);
  assert.match(buyer, /You pay the seller/);
  assert.match(buyer, /upi:\/\/pay\?pa=seller%40bank/);
  assert.match(buyer, /am=10.00/);
  assert.equal(renderToStaticMarkup(<TradePaymentDetails role="visitor" details={details} amount="10.00" canPay onCopy={() => {}}/>), '');
});
it('does not offer another payment after the buyer has reported paying', () => {
  const html = renderToStaticMarkup(<TradePaymentDetails role="buyer" details={details} amount="10.00" canPay={false} onCopy={() => {}}/>);
  assert.doesNotMatch(html, /upi:\/\/pay/);
  assert.match(html, /do not pay again/);
});
it('keeps a loaded QR and ready state through background refresh errors without crossing wallet or trade scopes', () => {
  const scope = 'escrow:creation:1:buyer';
  const loaded = mergePaymentSnapshot(undefined, scope, { ready: true, details });
  const refreshed = mergePaymentSnapshot(loaded, scope, { error: 'Temporary network issue' });
  assert.equal(refreshed.ready, true);
  assert.equal(refreshed.details, details);
  assert.equal(paymentForScope(refreshed, 'escrow:creation:1:seller'), undefined);
  assert.equal(paymentForScope(refreshed, 'escrow:creation:2:buyer'), undefined);
  const switched = mergePaymentSnapshot(refreshed, 'escrow:creation:2:buyer', { error: 'Not loaded yet' });
  assert.equal(switched.details, undefined);
  assert.equal(switched.ready, false);
});
