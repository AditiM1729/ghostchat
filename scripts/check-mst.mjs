import { createPublicClient, http, zeroAddress } from 'viem';
import { readFile } from 'node:fs/promises';
import { mstTestnet, MST_RPC_URL, MST_EXPLORER } from '../shared/network.ts';
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const client = createPublicClient({ chain: mstTestnet, transport: http(process.env.MST_RPC_URL || MST_RPC_URL, { timeout: 20000 }) });
if (await client.getChainId() !== mstTestnet.id) throw new Error('Wrong RPC chain: MST Testnet is required.');
const block = await client.getBlock();
console.log(JSON.stringify({ network: mstTestnet.name, symbol: mstTestnet.nativeCurrency.symbol, chainId: mstTestnet.id, latestBlock: String(block.number), blockTime: new Date(Number(block.timestamp) * 1000).toISOString() }, null, 2));
let deployment;
try { deployment = JSON.parse(await readFile(new URL('../deployments/mst-testnet.json', import.meta.url), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!deployment) console.log('MST escrow is not deployed yet. Open /setup and deploy with your wallet using faucet tMSTC.');
else {
  if (deployment.chainId !== mstTestnet.id || deployment.address === zeroAddress) throw new Error('Invalid MST deployment manifest.');
  const code = await client.getBytecode({ address: deployment.address });
  if (!code || code === '0x') throw new Error('No contract exists at the saved MST address.');
  console.log(`On-chain code found: ${MST_EXPLORER}/address/${deployment.address}`);
}
