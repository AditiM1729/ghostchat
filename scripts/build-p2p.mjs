import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await build({ entryPoints: ['shared/p2pOracle.ts'], outfile: 'vercel-site/lib/p2p-oracle.js', bundle: true, platform: 'node', target: 'node24', format: 'esm' });
const destination = new URL('../frontend/public/contracts/p2p-sandbox.json', import.meta.url);
const contractNames = ['GhostPayP2PSandbox', 'GhostPayP2PSandboxEscrow', 'GhostPayMockUSDC'];
const artifacts = {};
for (const name of contractNames) {
  const artifact = JSON.parse(await readFile(new URL(`../contracts/artifacts/contracts/GhostPayP2PSandbox.sol/${name}.json`, import.meta.url), 'utf8'));
  artifacts[name] = { abi: artifact.abi, bytecode: artifact.bytecode, deployedBytecode: artifact.deployedBytecode };
}
await mkdir(new URL('../frontend/public/contracts', import.meta.url), { recursive: true });
await writeFile(destination, JSON.stringify({ version: 1, chainId: 91562037, sandboxOnly: true, ...artifacts }) + '\n');
console.log('Prepared P2P sandbox artifacts and the read-only oracle adapter.');
const testTrade = JSON.parse(await readFile(new URL('../contracts/artifacts/contracts/GhostChatTestTrade.sol/GhostChatTestTrade.json', import.meta.url), 'utf8'));
const sellerTrade = JSON.parse(await readFile(new URL('../contracts/artifacts/contracts/GhostChatArbitratedTrade.sol/GhostChatArbitratedTrade.json', import.meta.url), 'utf8'));
await writeFile(new URL('../frontend/public/contracts/seller-trade.json', import.meta.url), JSON.stringify({ version: 1, chainId: 91562037, abi: sellerTrade.abi, bytecode: sellerTrade.bytecode, deployedBytecode: sellerTrade.deployedBytecode }) + '\n');
await writeFile(new URL('../frontend/public/contracts/test-trade.json', import.meta.url), JSON.stringify({ version: 1, chainId: 91562037, testOnly: true, abi: testTrade.abi, bytecode: testTrade.bytecode, deployedBytecode: testTrade.deployedBytecode }) + '\n');

const simpleTrade = JSON.parse(await readFile(new URL('../contracts/artifacts/contracts/GhostChatSellerTrade.sol/GhostChatSellerTrade.json', import.meta.url), 'utf8'));
await writeFile(new URL('../frontend/public/contracts/legacy-simple-seller-trade.json', import.meta.url), JSON.stringify({ version: 2, chainId: 91562037, abi: simpleTrade.abi, bytecode: simpleTrade.bytecode, deployedBytecode: simpleTrade.deployedBytecode }) + '\n');

const mutualTrade = JSON.parse(await readFile(new URL('../contracts/artifacts/contracts/GhostChatUTRTrade.sol/GhostChatUTRTrade.json', import.meta.url), 'utf8'));
await writeFile(new URL('../frontend/public/contracts/simple-seller-trade.json', import.meta.url), JSON.stringify({ version: 3, chainId: 91562037, abi: mutualTrade.abi, bytecode: mutualTrade.bytecode, deployedBytecode: mutualTrade.deployedBytecode }) + '\n');
