import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrivateTradeDetails } from '../src/privateTradeDetails.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverTypedDataAddress } from 'viem';
import { utrDomain, utrConfirmationTypes } from '../../shared/utrConfirmation.js';
const seller = `0x${'11'.repeat(20)}`; const buyer = `0x${'22'.repeat(20)}`; const stranger = `0x${'33'.repeat(20)}`;
const ref = { escrow: `0x${'44'.repeat(20)}`, creation: `0x${'55'.repeat(32)}`, tradeId: '1' };
const input = { ...ref, upiId: 'seller@bank', qr: 'data:image/png;base64,iVBORw0KGgo=' };
it('registers only the verified simple escrow, persists it once, and preserves existing configuration', async () => {
  let simple = false;
  const service = new PrivateTradeDetails(':memory:', randomBytes(32), async () => ({ seller, buyer, state: 0, simple, protocol: 3 }));
  try {
    assert.equal((await service.simpleConfig()).configured, false);
    await assert.rejects(service.simpleConfig(ref), /not the mutual UTR/);
    simple = true;
    assert.equal((await service.simpleConfig(ref)).configured, true);
    await service.simpleConfig(ref);
    await assert.rejects(service.simpleConfig({ ...ref, escrow: buyer }), /already configured/);
    assert.equal((await service.simpleConfig()).escrow.toLowerCase(), ref.escrow);
  } finally { service.close(); }
});
it('privately matches independent references and signs only the authenticated actor and exact trade', async () => {
  let state = 1; let verifier = '';
  const service = new PrivateTradeDetails(':memory:', randomBytes(32), async () => ({ seller, buyer, state, simple: true, protocol: 3, verifier }));
  try {
    verifier = (await service.simpleConfig()).utrVerifier;
    await service.access(seller, input, true);
    assert.equal((await service.access(buyer, ref)).upiId, input.upiId); // No separate buyer acceptance for V3.
    await assert.rejects(service.utr(stranger, ref), /Only this trade/);
    await assert.rejects(service.utr(seller, { ...ref, utr: '123456789012' }), /bank app/);
    await assert.rejects(service.utr(buyer, { ...ref, utr: '123456789012' }), /sent/);
    const first = await service.utr(buyer, { ...ref, utr: '1234 5678 9012', paymentSent: true });
    assert.equal(first.otherSubmitted, false);
    assert.equal(first.bankVerified, false);
    assert.ok(!JSON.stringify(first).includes('123456789012'));
    const mismatch = await service.utr(seller, { ...ref, utr: '123456789013', paymentReceived: true });
    assert.equal(mismatch.referencesMatch, false);
    const match = await service.utr(seller, { ...ref, utr: '123456789012', paymentReceived: true });
    assert.equal(match.referencesMatch, true);
    assert.equal(match.commitment, first.commitment);
    assert.notEqual(match.signature, first.signature);
    const recovered = await recoverTypedDataAddress({ domain: utrDomain(91562037, ref.escrow as `0x${string}`), types: utrConfirmationTypes, primaryType: 'UTRConfirmation', message: { tradeId: 1n, actor: seller as `0x${string}`, commitment: match.commitment! }, signature: match.signature! });
    assert.equal(recovered.toLowerCase(), verifier.toLowerCase());
    const another = await service.utr(buyer, { ...ref, tradeId: '2', utr: '123456789012', paymentSent: true });
    assert.notEqual(another.commitment, first.commitment);
    state = 5;
    await assert.rejects(service.utr(seller, { ...ref, utr: '123456789012', paymentReceived: true }), /closed/);
    assert.equal((await service.utr(seller, ref)).signature, undefined);
    await assert.rejects(service.access(buyer, ref), /accepted buyer/);
  } finally { service.close(); }
});
it('persists an encrypted wallet-owned UPI profile and snapshots it into immutable trades', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ghostchat-upi-')); const path = join(dir, 'private.sqlite'); const key = randomBytes(32);
  const check = async () => ({ seller, buyer, state: 1 });
  let service = new PrivateTradeDetails(path, key, check);
  try {
    await service.profile(seller, input, true);
    await assert.rejects(service.profile(buyer, {}, false), /No saved/);
    await service.access(seller, { ...ref, useProfile: true }, true);
    await service.profile(seller, { ...input, upiId: 'changed@bank' }, true);
    assert.equal((await service.access(seller, ref)).upiId, 'seller@bank');
    service.close();
    assert.ok(!readFileSync(path).includes(Buffer.from('changed@bank')));
    service = new PrivateTradeDetails(path, key, check);
    assert.equal((await service.profile(seller, {}, false)).upiId, 'changed@bank');
    assert.equal((await service.access(seller, ref)).upiId, 'seller@bank');
    await assert.rejects(service.profile(seller, { ...input, qr: 'bad' }, true), /Upload/);
  } finally { service.close(); rmSync(dir, { recursive: true, force: true }); }
});
it('keeps details private, immutable, and scoped to the accepted buyer', async () => {
  let state = 1;
  const service = new PrivateTradeDetails(':memory:', randomBytes(32), async () => ({ seller, buyer, state }));
  try {
    await assert.rejects(service.access(stranger, input, true), /private/);
    await service.access(seller, input, true);
    await assert.rejects(service.access(seller, input, true), /already fixed/);
    await assert.rejects(service.access(buyer, ref), /accepted buyer/);
    state = 2;
    assert.equal((await service.access(buyer, ref)).upiId, input.upiId);
    await assert.rejects(service.access(stranger, ref), /private/);
    await assert.rejects(service.access(buyer, input, true), /Only the seller/);
    await assert.rejects(service.access(seller, input, true), /before acceptance/);
    state = 5;
    await assert.rejects(service.access(buyer, ref), /accepted buyer/);
  } finally { service.close(); }
});
it('rejects unsafe QR content and malformed trade identifiers', async () => {
  const service = new PrivateTradeDetails(':memory:', randomBytes(32), async () => ({ seller, buyer, state: 1 }));
  try {
    await assert.rejects(service.access(seller, { ...input, qr: 'data:image/svg+xml;base64,PHN2Zz4=' }, true), /Upload/);
    await assert.rejects(service.access(seller, { ...input, tradeId: '-1' }, true), /Invalid trade/);
  } finally { service.close(); }
});
