import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentRecords } from '../src/payments/paymentRecords.ts';
import type { ChatMessage, PaymentReference } from '../src/messenger/model.ts';
const from = `0x${'1'.repeat(40)}` as const; const to = `0x${'2'.repeat(40)}` as const;
const ref: PaymentReference = { version: 3, chainId: 91562037, hash: `0x${'a'.repeat(64)}`, from, to };
function message(payment: PaymentReference, timestamp: number): ChatMessage { return { id: String(timestamp), roomId:'room', sender:'friend', senderName:'@friend', body:'Payment', own:false, timestamp, state:'sent', payment }; }
test('activity recovers an incoming payment from Matrix even without local history', () => {
  const records = paymentRecords([message(ref, 10)], [], to);
  assert.equal(records.length, 1); assert.equal(records[0].reference.version, 3); assert.match(records[0].label, /@friend/);
});
test('one transfer shared repeatedly and saved locally appears only once', () => {
  const records = paymentRecords([message(ref, 10), message(ref, 20)], [ref], from);
  assert.equal(records.length, 1); assert.equal(records[0].timestamp, 20);
});
test('local direct payments from another wallet are not shown as this account activity', () => {
  assert.equal(paymentRecords([], [ref], `0x${'3'.repeat(40)}`).length, 0);
  assert.equal(paymentRecords([], [ref], from).length, 1);
  assert.equal(paymentRecords([], [ref]).length, 0);
});
test('malformed payment content is excluded rather than generating a never-ending card', () => {
  assert.equal(paymentRecords([message({...ref, hash:'bad'} as PaymentReference, 10)], [], from).length, 0);
});
