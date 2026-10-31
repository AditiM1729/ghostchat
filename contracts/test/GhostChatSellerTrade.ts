import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';

describe('seller-confirmed test trade', () => {
  it('requires buyer report and seller approval before releasing to the fixed buyer', async () => {
    const { viem } = await network.connect();
    const [seller, buyer, stranger] = await viem.getWalletClients();
    const client = await viem.getPublicClient();
    const escrow = await viem.deployContract('GhostChatSellerTrade');
    await escrow.write.offer([buyer.account.address, 10000n], { account: seller.account, value: 1000000n });
    await assert.rejects(escrow.write.release([1n], { account: seller.account }), /WrongStateOrParty/);
    await assert.rejects(escrow.write.accept([1n], { account: stranger.account }), /WrongStateOrParty/);
    await escrow.write.accept([1n], { account: buyer.account });
    await assert.rejects(escrow.write.reportPaid([1n], { account: stranger.account }), /WrongStateOrParty/);
    await assert.rejects(escrow.write.refund([1n], { account: seller.account }), /WrongStateOrParty/);
    await escrow.write.reportPaid([1n], { account: buyer.account });
    await assert.rejects(escrow.write.release([1n], { account: buyer.account }), /WrongStateOrParty/);
    const before = await client.getBalance({ address: buyer.account.address });
    await escrow.write.release([1n], { account: seller.account });
    assert.equal(await client.getBalance({ address: buyer.account.address }), before + 1000000n);
    assert.equal((await escrow.read.trades([1n]))[4], 4);
    await assert.rejects(escrow.write.release([1n], { account: seller.account }), /WrongStateOrParty/);
  });
  it('locks disputed funds until seller releases or buyer returns', async () => {
    const { viem } = await network.connect(); const [seller, buyer] = await viem.getWalletClients();
    const escrow = await viem.deployContract('GhostChatSellerTrade');
    await escrow.write.offer([buyer.account.address, 100n], { account: seller.account, value: 100n });
    await escrow.write.accept([1n], { account: buyer.account });
    await escrow.write.dispute([1n], { account: buyer.account });
    await assert.rejects(escrow.write.refund([1n], { account: seller.account }), /WrongStateOrParty/);
    await escrow.write.refund([1n], { account: buyer.account });
    assert.equal((await escrow.read.trades([1n]))[4], 5);
  });
  it('refuses mainnet deployment', async () => {
    const { viem } = await network.create({ network: 'default', override: { chainId: 4646 } });
    await assert.rejects(viem.deployContract('GhostChatSellerTrade'), /TestnetOnly/);
  });
  it('has no unilateral seller withdrawal after payment or dispute and permits only party-approved outcomes', async () => {
    const { viem } = await network.connect(); const [seller, buyer, stranger] = await viem.getWalletClients();
    const escrow = await viem.deployContract('GhostChatSellerTrade');
    await escrow.write.offer([buyer.account.address, 100n], { account: seller.account, value: 100n });
    await escrow.write.accept([1n], { account: buyer.account });
    await escrow.write.reportPaid([1n], { account: buyer.account });
    await assert.rejects(escrow.write.refund([1n], { account: seller.account }), /WrongStateOrParty/);
    await escrow.write.dispute([1n], { account: buyer.account });
    await assert.rejects(escrow.write.release([1n], { account: stranger.account }), /WrongStateOrParty/);
    await assert.rejects(escrow.write.refund([1n], { account: seller.account }), /WrongStateOrParty/);
    await escrow.write.release([1n], { account: seller.account });
    assert.equal((await escrow.read.trades([1n]))[4], 4);
    await assert.rejects(escrow.write.refund([1n], { account: buyer.account }), /WrongStateOrParty/);
  });
});
