import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

async function setup() {
  const { viem } = await network.connect();
  const [seller, buyer, arbitrator, stranger] = await viem.getWalletClients();
  const contract = await viem.deployContract('GhostChatArbitratedTrade');
  await contract.write.offer([buyer.account.address, arbitrator.account.address, 10000n], { account: seller.account, value: 1000000n });
  return { viem, contract, seller, buyer, arbitrator, stranger };
}
describe('arbitrated P2P escrow', () => {
  it('requires the named arbitrator to opt in before buyer acceptance', async () => {
    const x = await setup();
    await assert.rejects(x.contract.write.accept([1n], { account: x.buyer.account }), /WrongStateOrParty/);
    await assert.rejects(x.contract.write.acceptArbitration([1n], { account: x.stranger.account }), /WrongStateOrParty/);
    await x.contract.write.acceptArbitration([1n], { account: x.arbitrator.account });
    await x.contract.write.accept([1n], { account: x.buyer.account });
    await assert.rejects(x.contract.write.release([1n], { account: x.seller.account }), /WrongStateOrParty/);
    await x.contract.write.reportPaid([1n], { account: x.buyer.account });
    const client = await x.viem.getPublicClient(); const before = await client.getBalance({ address: x.buyer.account.address });
    await x.contract.write.release([1n], { account: x.seller.account });
    assert.equal(await client.getBalance({ address: x.buyer.account.address }), before + 1000000n);
    await assert.rejects(x.contract.write.release([1n], { account: x.seller.account }), /WrongStateOrParty/);
  });
  it('restricts dispute resolution to the agreed arbitrator', async () => {
    const x = await setup();
    await x.contract.write.acceptArbitration([1n], { account: x.arbitrator.account });
    await x.contract.write.accept([1n], { account: x.buyer.account });
    await x.contract.write.reportPaid([1n], { account: x.buyer.account });
    await x.contract.write.dispute([1n], { account: x.buyer.account });
    await assert.rejects(x.contract.write.resolve([1n, true], { account: x.stranger.account }), /WrongStateOrParty/);
    await assert.rejects(x.contract.write.release([1n], { account: x.seller.account }), /WrongStateOrParty/);
    await x.contract.write.resolve([1n, true], { account: x.arbitrator.account });
    assert.equal((await x.contract.read.trades([1n]))[5], 5);
  });
  it('allows arbitrator to refund a disputed trade and prevents seller reclaiming after acceptance', async () => {
    const x = await setup();
    await x.contract.write.acceptArbitration([1n], { account: x.arbitrator.account });
    await x.contract.write.accept([1n], { account: x.buyer.account });
    await assert.rejects(x.contract.write.refund([1n], { account: x.seller.account }), /WrongStateOrParty/);
    await x.contract.write.dispute([1n], { account: x.seller.account });
    await x.contract.write.resolve([1n, false], { account: x.arbitrator.account });
    assert.equal((await x.contract.read.trades([1n]))[5], 6);
  });
});
