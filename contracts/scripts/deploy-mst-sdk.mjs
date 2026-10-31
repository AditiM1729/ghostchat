import mstSdk from '@mstblockchain/mst-sdk';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
const { Client } = mstSdk;
const root = new URL('../../', import.meta.url);
try { process.loadEnvFile(fileURLToPath(new URL('.env', root))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const target = process.argv.includes('--mainnet') ? { id: 4646, name: 'MST Mainnet', symbol: 'MSTC', rpc: process.env.MST_MAINNET_RPC_URL || 'https://mariorpc.mstblockchain.com', key: 'MST_MAINNET_PRIVATE_KEY', file: 'mst-mainnet.json', explorer: 'https://mstscan.com' } : { id: 91562037, name: 'MST Testnet', symbol: 'tMSTC', rpc: process.env.MST_RPC_URL || 'https://testnetrpc.mstblockchain.com', key: 'MST_PRIVATE_KEY', file: 'mst-testnet.json', explorer: 'https://testnet.mstscan.com' };
const submit = process.argv.includes('--send');
const key = process.env[target.key];
if (submit && !key) throw new Error(`Set ${target.key} in your local deployment shell. Do not paste it into chat.`);
const sdk = new Client(target.rpc, submit ? key : undefined);
const provider = sdk.provider.ethersProvider;
try {
  if (Number((await provider.getNetwork()).chainId) !== target.id) throw new Error('RPC chain mismatch. No deployment submitted.');
  const artifact = JSON.parse(await readFile(new URL('contracts/artifacts/contracts/GhostPayEscrow.sol/GhostPayEscrow.json', root), 'utf8'));
  const info = { network: target.name, chainId: target.id, latestBlock: await sdk.provider.getBlockNumber(), contract: 'GhostPayEscrow', creationCodeHash: keccak256(artifact.bytecode), mode: submit ? 'submit' : 'check only' };
  const savedUrl = new URL(`deployments/${target.file}`, root);
  if (!submit) { console.log(JSON.stringify(info, null, 2)); console.log('No transaction submitted. Add --send and a funded deployer only when ready.'); }
  else {
    // Prevent replacing a known contract or losing track of a previously submitted tx.
    for (const url of [savedUrl, new URL(`deployments/${target.file}.pending`, root)]) {
      try { await readFile(url); throw new Error(`A deployment record already exists: ${fileURLToPath(url)}. Verify that transaction before deploying again.`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const deployer = await sdk.signer.getAddress();
    const gas = await provider.estimateGas({ from: deployer, data: artifact.bytecode, value: 0n });
    const fee = await provider.getFeeData(); const gasPrice = fee.maxFeePerGas || fee.gasPrice;
    if (!gasPrice) throw new Error('Cannot obtain a deployment gas price.');
    const budget = gas * gasPrice * 120n / 100n;
    if (await sdk.provider.getBalance(deployer) < budget) throw new Error(`Insufficient ${target.symbol} for estimated deployment gas.`);
    await mkdir(new URL('deployments/', root), { recursive: true });
    console.log(JSON.stringify({ ...info, deployer, estimatedGas: gas.toString(), gasBudgetWei: budget.toString() }, null, 2));
    const transactionHash = await sdk.signer.deploy(artifact.abi, artifact.bytecode);
    await writeFile(new URL(`deployments/${target.file}.pending`, root), JSON.stringify({ chainId: target.id, transactionHash }, null, 2), { flag: 'wx' });
    console.log(`Submitted: ${target.explorer}/tx/${transactionHash}`);
    const receipt = await provider.waitForTransaction(transactionHash, 2, 240000);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) throw new Error('Deployment is pending or failed; retain the pending record and inspect its transaction.');
    const tx = await provider.getTransaction(transactionHash);
    const block = await provider.getBlock(receipt.blockNumber);
    if (!tx || tx.to !== null || tx.data.toLowerCase() !== artifact.bytecode.toLowerCase() || block?.hash !== receipt.blockHash || await provider.getCode(receipt.contractAddress) === '0x') throw new Error('Deployment verification failed.');
    const deployment = { address: receipt.contractAddress, chainId: target.id, blockNumber: String(receipt.blockNumber), configured: true, transactionHash };
    await writeFile(new URL(`deployments/${target.file}.tmp`, root), JSON.stringify(deployment, null, 2));
    await rename(new URL(`deployments/${target.file}.tmp`, root), savedUrl);
    console.log(`Verified contract: ${target.explorer}/address/${receipt.contractAddress}`);
  }
} finally { provider.destroy(); }
