import { configVariable, defineConfig } from 'hardhat/config';
import { fileURLToPath } from 'node:url';
import { MST_RPC_URL, MST_MAINNET_RPC_URL } from '../shared/network.js';
import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';
try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: { compilers: [{ version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } }], overrides: { 'contracts/GhostChatMainnetTrade.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } }, 'contracts/GhostChatMainnetSuite.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } }, 'contracts/GhostChatUTRTrade.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } }, 'contracts/GhostPayNativeEscrow.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } }, 'contracts/GhostPayCommunity.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } } } },
  networks: {
    default: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
    mstMainnet: { type: 'http', chainType: 'l1', url: process.env.MST_MAINNET_RPC_URL || MST_MAINNET_RPC_URL, chainId: 4646, accounts: process.env.MST_MAINNET_PRIVATE_KEY ? [configVariable('MST_MAINNET_PRIVATE_KEY')] : [] },
    mst: { type: 'http', chainType: 'l1', url: process.env.MST_RPC_URL || MST_RPC_URL, chainId: 91562037, accounts: process.env.MST_PRIVATE_KEY ? [configVariable('MST_PRIVATE_KEY')] : [] },
  },
});
