import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { network } from 'hardhat';
import { keccak256, stringToHex } from 'viem';
import { utrDomain, utrConfirmationTypes } from '../../shared/utrConfirmation.js';
import { artifacts } from '../../scripts/mainnet-deployment/verify.mjs';

describe('Mainnet batch deployment',()=>{
  it('atomically deploys the exact three empty modules on chain 4646 and settles matching confirmations',async()=>{
    const {viem}=await network.create({network:'default',override:{chainId:4646}});
    const [seller,buyer,verifier]=await viem.getWalletClients();
    const suite=await viem.deployContract('GhostChatMainnetSuite');
    const client=await viem.getPublicClient();
    const names=['GhostPayNativeEscrow','GhostPayCommunity','GhostChatMainnetTrade'];
    const compiled=await artifacts(new URL('../../',import.meta.url));
    const addresses=await Promise.all([suite.read.nativeEscrow(),suite.read.community(),suite.read.p2p()]);
    for(let i=0;i<3;i++){
      const artifact=compiled[i+1];
      assert.equal((await client.getCode({address:addresses[i]}))?.toLowerCase(),artifact.deployedBytecode.toLowerCase());
      assert.equal(await client.getBalance({address:addresses[i]}),0n);
    }
    const p2p=await viem.getContractAt('GhostChatMainnetTrade',addresses[2]);
    await p2p.write.offer([buyer.account.address,100n,verifier.account.address],{account:seller.account,value:1000n});
    const commitment=keccak256(stringToHex('shared-transaction-id'));
    for(const actor of [buyer,seller]){
      const signature=await verifier.signTypedData({domain:utrDomain(4646,p2p.address),types:utrConfirmationTypes,primaryType:'UTRConfirmation',message:{tradeId:1n,actor:actor.account.address,commitment}});
      await p2p.write.confirmUTR([1n,commitment,signature],{account:actor.account});
    }
    assert.equal((await p2p.read.trades([1n]))[4],4);
    assert.equal(await client.getBalance({address:p2p.address}),0n);
  });
  it('rejects deploying the Mainnet suite on the Testnet chain',async()=>{
    const {viem}=await network.create({network:'default',override:{chainId:91562037}});
    await assert.rejects(viem.deployContract('GhostChatMainnetSuite'),/MSTMainnetOnly/);
  });
  it('preserves the mutual-confirmation implementation except the name and deployment chain guard',async()=>{
    const original=await readFile(new URL('../contracts/GhostChatUTRTrade.sol',import.meta.url),'utf8');
    const variant=await readFile(new URL('../contracts/GhostChatMainnetTrade.sol',import.meta.url),'utf8');
    const expected=original.replace('Mutual reference confirmation, NOT bank-payment verification. Testnet only.','Mutual reference confirmation, NOT bank-payment verification. MST Mainnet deployment variant.').replace('contract GhostChatUTRTrade','contract GhostChatMainnetTrade').replace('block.chainid == 91562037 || block.chainid == 31337, "TestnetOnly"','block.chainid == 4646 || block.chainid == 31337, "MSTMainnetOnly"');
    assert.equal(variant.trim(),expected.trim());
  });
});
