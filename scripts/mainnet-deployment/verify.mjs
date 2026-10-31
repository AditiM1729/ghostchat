import { readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, http, getAddress } from 'viem';
export const RPC = 'https://mariorpc.mstblockchain.com';
export const CHAIN_ID = 4646;
export const names = ['GhostChatMainnetSuite', 'GhostPayNativeEscrow', 'GhostPayCommunity', 'GhostChatMainnetTrade'];
export async function artifacts(root) {
  const suite=JSON.parse(await readFile(new URL('contracts/artifacts/contracts/GhostChatMainnetSuite.sol/GhostChatMainnetSuite.json',root),'utf8'));
  // Imported child contracts have compilation metadata from the suite's build job.
  // Standalone artifact metadata can differ despite identical executable logic.
  const {output}=JSON.parse(await readFile(new URL(`contracts/artifacts/build-info/${suite.buildInfoId}.output.json`,root),'utf8'));
  return names.map(name=>{const c=output.contracts[`project/contracts/${name}.sol`][name];return {contractName:name,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object};});
}
export async function verifyDeployment(hash, compiled, rpc = RPC) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Enter a valid deployment transaction hash.');
  const client = createPublicClient({ transport: http(rpc, { timeout: 20000 }) });
  if (await client.getChainId() !== CHAIN_ID) throw new Error('RPC is not MST Mainnet.');
  const [receipt, tx, latest] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash }), client.getBlockNumber()]);
  if (receipt.status !== 'success' || !receipt.contractAddress || tx.to || tx.value !== 0n || tx.input.toLowerCase() !== compiled[0].bytecode.toLowerCase()) throw new Error('Transaction is not a successful deployment of this exact suite with zero value.');
  if (latest < receipt.blockNumber + 1n) throw new Error('Wait for two block confirmations, then recover again.');
  const suite = getAddress(receipt.contractAddress);
  const children = await Promise.all(['nativeEscrow','community','p2p'].map(functionName => client.readContract({ address: suite, abi: compiled[0].abi, functionName })));
  const addresses = [suite, ...children.map(getAddress)];
  for (let i = 0; i < addresses.length; i++) {
    const code = await client.getCode({ address: addresses[i] });
    if (code?.toLowerCase() !== compiled[i].deployedBytecode.toLowerCase()) throw new Error(`Runtime mismatch: ${names[i]}.`);
    if (await client.getBalance({ address: addresses[i] }) !== 0n) throw new Error('A deployed module already holds funds. Review it before recording this initial deployment.');
  }
  return { chainId: CHAIN_ID, network: 'MST Mainnet', transactionHash: hash, blockNumber: receipt.blockNumber.toString(), deployer: getAddress(tx.from), suite: addresses[0], nativeEscrow: addresses[1], community: addresses[2], p2p: addresses[3], app: 'https://ghostchat-rho.vercel.app', verifiedAt: new Date().toISOString(), appMainnetEnabled: false };
}
export async function recordDeployment(root, result) {
  const path = new URL('deployments/mst-mainnet.json', root);
  let previous;
  try { previous = JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (previous && previous.transactionHash !== result.transactionHash) throw new Error('A different Mainnet deployment is already recorded. Review it manually before replacing it.');
  const readmePath = new URL('README.md', root);
  const readme = await readFile(readmePath, 'utf8');
  if (!readme.includes('<!-- MAINNET_DEPLOYMENT_START -->') || !readme.includes('<!-- MAINNET_DEPLOYMENT_END -->')) throw new Error('README deployment markers are missing.');
  const entries = [['Suite',result.suite],['Payment links',result.nativeEscrow],['Community funds',result.community],['P2P escrow',result.p2p]];
  const section = '\n\nVerified MST Mainnet deployment (chain 4646):\n\n| Module | Address |\n| --- | --- |\n' + entries.map(([label,address])=>`| ${label} | [${address}](https://mstscan.com/address/${address}) |`).join('\n') + `\n\n[Deployment transaction](https://mstscan.com/tx/${result.transactionHash}). These contracts are deployed; the hosted application's Mainnet payment integration remains disabled until separately configured and validated.\n\n`;
  await writeFile(path, JSON.stringify(result,null,2)+'\n');
  await writeFile(readmePath, readme.replace(/<!-- MAINNET_DEPLOYMENT_START -->[\s\S]*?<!-- MAINNET_DEPLOYMENT_END -->/, '<!-- MAINNET_DEPLOYMENT_START -->'+section+'<!-- MAINNET_DEPLOYMENT_END -->'));
}
