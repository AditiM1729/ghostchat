import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { keccak256, stringToHex, type Address, type Hex } from 'viem';
import { utrDomain, utrConfirmationTypes } from '../../shared/utrConfirmation.js';

async function setup() {
  const { viem } = await network.connect();
  const [seller, buyer, attestor, stranger] = await viem.getWalletClients();
  const escrow = await viem.deployContract('GhostChatUTRTrade');
  await escrow.write.offer([buyer.account.address, 1000n, attestor.account.address], { account: seller.account, value: 1000000n });
  const sign = (actor: Address, commitment: Hex, id = 1n, address = escrow.address, chainId = 31337) => attestor.signTypedData({ domain: utrDomain(chainId, address), types: utrConfirmationTypes, primaryType: 'UTRConfirmation', message: { tradeId: id, actor, commitment } });
  return { seller, buyer, attestor, stranger, escrow, sign, client: await viem.getPublicClient() };
}
const a = keccak256(stringToHex('test-reference-A')), b = keccak256(stringToHex('test-reference-B'));
describe('mutual UTR test escrow', () => {
  it('releases to the fixed buyer only after both wallet-bound matching attestations', async () => {
    const x = await setup();
    await x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a)], { account: x.buyer.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 3);
    const before = await x.client.getBalance({ address: x.buyer.account.address });
    await x.escrow.write.confirmUTR([1n, a, await x.sign(x.seller.account.address, a)], { account: x.seller.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 4);
    assert.equal(await x.client.getBalance({ address: x.buyer.account.address }), before + 1000000n);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a)], { account: x.buyer.account }), /WrongStateOrParty/);
  });
  it('locks mismatches and permits an independently attested correction', async () => {
    const x = await setup();
    await x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a)], { account: x.buyer.account });
    await x.escrow.write.confirmUTR([1n, b, await x.sign(x.seller.account.address, b)], { account: x.seller.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 6);
    assert.equal(await x.client.getBalance({ address: x.escrow.address }), 1000000n);
    await x.escrow.write.confirmUTR([1n, b, await x.sign(x.buyer.account.address, b)], { account: x.buyer.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 4);
  });
  it('rejects copying a party proof and replays across trades, contracts, or chains', async () => {
    const x = await setup();
    const buyerSignature = await x.sign(x.buyer.account.address, a);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, buyerSignature], { account: x.stranger.account }), /WrongStateOrParty/);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, buyerSignature], { account: x.seller.account }), /InvalidReferenceAttestation/);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a, 2n)], { account: x.buyer.account }), /InvalidReferenceAttestation/);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a, 1n, x.escrow.address, 91562037)], { account: x.buyer.account }), /InvalidReferenceAttestation/);
    await assert.rejects(x.escrow.write.confirmUTR([1n, a, await x.sign(x.buyer.account.address, a, 1n, x.stranger.account.address)], { account: x.buyer.account }), /InvalidReferenceAttestation/);
  });
  it('requires both parties to cancel, allows revocation, and forbids unilateral seller reclaim', async () => {
    const x = await setup();
    await assert.rejects(x.escrow.write.approveCancellation([1n], { account: x.stranger.account }), /WrongStateOrParty/);
    await x.escrow.write.approveCancellation([1n], { account: x.seller.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 1);
    await x.escrow.write.revokeCancellation([1n], { account: x.seller.account });
    await x.escrow.write.approveCancellation([1n], { account: x.buyer.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 1);
    await x.escrow.write.approveCancellation([1n], { account: x.seller.account });
    assert.equal((await x.escrow.read.trades([1n]))[4], 5);
  });
  it('refuses mainnet deployment', async () => {
    const { viem } = await network.create({ network: 'default', override: { chainId: 4646 } });
    await assert.rejects(viem.deployContract('GhostChatUTRTrade'), /TestnetOnly/);
  });
});
