import { normalizeSellerTrade } from '../../shared/sellerTradeModel.js';
import { AccountDirectory } from './accounts.js';
import { WalletAccounts } from './walletAccounts.js';
import { PrivateTradeDetails } from './privateTradeDetails.js';
import { randomBytes } from 'node:crypto';
import { TestPayments, testPaymentConfig, type TestTrade } from './testPayments.js';
import { privateKeyToAccount } from 'viem/accounts';
import type { Abi, Address } from 'viem';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPublicClient, encodeDeployData, http, type Hex } from 'viem';
import { mstTestnet, mstMainnet } from '../../shared/network.js';
import { createApp } from './app.js';
import { DeploymentRegistry } from './deployment.js';
import { MST_RPC_URL } from '../../shared/network.js';
const root = resolve(process.cwd(), '..');
if (process.env.GHOSTCHAT_SKIP_DOTENV !== '1') {
  try { process.loadEnvFile(resolve(root, '.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const dataDirectory = resolve(process.env.GHOSTCHAT_DATA_DIR || resolve(root, 'data'));
const deploymentDirectory = resolve(process.env.GHOSTCHAT_DEPLOYMENTS_DIR || resolve(root, 'deployments'));
async function runtimeArtifact(name: string) {
  try { return JSON.parse(await readFile(resolve(root, `server/runtime/${name}.json`), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return JSON.parse(await readFile(resolve(root, `contracts/artifacts/contracts/${name}.sol/${name}.json`), 'utf8'));
}
const artifact = await runtimeArtifact('GhostPayEscrow') as { bytecode: Hex };
const client = createPublicClient({ chain: mstTestnet, transport: http(process.env.MST_RPC_URL || MST_RPC_URL, { timeout: 20000 }) });
if (await client.getChainId() !== mstTestnet.id) throw new Error('RPC must be MST Testnet (91562037).');
const registry = new DeploymentRegistry(client, artifact.bytecode, resolve(deploymentDirectory, 'mst-testnet.json'));
await registry.load();
const mainnetClient = createPublicClient({ chain: mstMainnet, transport: http(process.env.MST_MAINNET_RPC_URL || mstMainnet.rpcUrls.default.http[0], { timeout: 20000 }) });
const mainnet = new DeploymentRegistry(mainnetClient, artifact.bytecode, resolve(deploymentDirectory, 'mst-mainnet.json'), mstMainnet.id);
await mainnet.load();
await mkdir(dataDirectory, { recursive: true });
const directory = new AccountDirectory(resolve(dataDirectory, 'accounts.sqlite'));
const paymentConfig = testPaymentConfig();
let testPayments: TestPayments | undefined;
if (paymentConfig) {
  const testArtifact = await runtimeArtifact('GhostChatTestTrade') as { abi: Abi; bytecode: Hex; deployedBytecode: Hex };
  const attestor = privateKeyToAccount(paymentConfig.attestorKey).address;
  testPayments = new TestPayments(paymentConfig, resolve(dataDirectory, 'test-payments.sqlite'), async (address: Address, id: bigint, creation: Hex) => {
    if (await client.getChainId() !== 91562037) throw new Error('Test payment RPC must be MST Testnet.');
    const head = await client.getBlockNumber({ cacheTime: 0 });
    if (head < 1n) throw new Error('Wait for testnet confirmations.');
    const blockNumber = head - 1n;
    const [transaction, receipt] = await Promise.all([client.getTransaction({ hash: creation }), client.getTransactionReceipt({ hash: creation })]);
    const input = encodeDeployData({ abi: testArtifact.abi, bytecode: testArtifact.bytecode, args: [attestor] });
    if (transaction.to !== null || transaction.input.toLowerCase() !== input.toLowerCase() || receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== address.toLowerCase() || receipt.blockNumber > blockNumber || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The escrow creation transaction is not a confirmed canonical GhostChat test deployment.');
    const code = await client.getCode({ address, blockNumber });
    if (code?.toLowerCase() !== testArtifact.deployedBytecode.toLowerCase()) throw new Error('Unrecognized test payment escrow.');
    const signer = await client.readContract({ address, abi: testArtifact.abi, functionName: 'attestor', blockNumber }) as Address;
    if (signer.toLowerCase() !== attestor.toLowerCase()) throw new Error('This escrow uses a different test payment attestor.');
    return await client.readContract({ address, abi: testArtifact.abi, functionName: 'getTrade', args: [id], blockNumber }) as TestTrade;
  });
}
const port = Number(process.env.PORT || 3001);
const keyPath = resolve(dataDirectory, 'private-p2p.key');
try { await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
const privateArtifact = await runtimeArtifact('GhostChatArbitratedTrade') as { abi: Abi; bytecode: Hex; deployedBytecode: Hex };
const simplePrivateArtifact = await runtimeArtifact('GhostChatSellerTrade') as { abi: Abi; bytecode: Hex; deployedBytecode: Hex };
const mutualArtifact = await runtimeArtifact('GhostChatUTRTrade') as { abi: Abi; bytecode: Hex; deployedBytecode: Hex };
const privateDetails = new PrivateTradeDetails(resolve(dataDirectory, 'private-p2p.sqlite'), await readFile(keyPath), async (address, id, creation) => {
  if (await client.getChainId() !== 91562037) throw new Error('Private P2P requires MST Testnet.');
  const block = await client.getBlockNumber({ cacheTime: 0 });
  const [transaction, receipt] = await Promise.all([client.getTransaction({ hash: creation as Hex }), client.getTransactionReceipt({ hash: creation as Hex })]);
  const mutual = transaction.input.toLowerCase() === mutualArtifact.bytecode.toLowerCase();
  const simple = mutual || transaction.input.toLowerCase() === simplePrivateArtifact.bytecode.toLowerCase();
  const selectedArtifact = mutual ? mutualArtifact : simple ? simplePrivateArtifact : privateArtifact;
  if (transaction.to !== null || transaction.input.toLowerCase() !== selectedArtifact.bytecode.toLowerCase() || receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== address.toLowerCase() || receipt.blockNumber + 1n > block || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('Invalid P2P escrow deployment.');
  if ((await client.getCode({ address: address as Address }))?.toLowerCase() !== selectedArtifact.deployedBytecode.toLowerCase()) throw new Error('Unrecognized escrow.');
  const t = normalizeSellerTrade(await client.readContract({ address: address as Address, abi: selectedArtifact.abi, functionName: 'trades', args: [id], blockTag: 'latest' }), simple);
  const verifier = mutual ? await client.readContract({ address: address as Address, abi: mutualArtifact.abi, functionName: 'verifiers', args: [id] }) as string : undefined;
  const confirmations = mutual ? await client.readContract({ address: address as Address, abi: mutualArtifact.abi, functionName: 'confirmations', args: [id] }) as readonly [string, string] : undefined;
  return { seller: t[0], buyer: t[1], state: t[5], amount: t[3], inrPaise: t[4], simple, protocol: mutual ? 3 : simple ? 2 : 1, verifier, buyerCommitment: confirmations?.[0], sellerCommitment: confirmations?.[1] };
});
const host = process.env.GHOSTCHAT_HOST || '127.0.0.1';
createApp(client, registry.current, process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173', { registry, bytecode: artifact.bytecode, mainnet }, directory, testPayments, new WalletAccounts(resolve(dataDirectory, 'wallet-sessions.sqlite')), privateDetails).listen(port, host, () => console.log(`GhostChat relay listening on ${host}:${port} · ${registry.current.configured ? registry.current.address : 'Wallet deployment required at /setup'}`));
