import { defineChain } from 'viem';

// MST's own RPC was checked against the chain registry on 2026-10-24.
// https://github.com/ethereum-lists/chains/blob/master/_data/chains/eip155-91562037.json
export const MST_CHAIN_ID = 91562037;
export const MST_RPC_URL = 'https://testnetrpc.mstblockchain.com';
export const MST_EXPLORER = 'https://testnet.mstscan.com';
export const MST_FAUCET = 'https://faucet.mstblockchain.com';
export const mstTestnet = defineChain({
  id: MST_CHAIN_ID,
  name: 'MST Testnet',
  nativeCurrency: { name: 'MST Native Coin', symbol: 'tMSTC', decimals: 18 },
  rpcUrls: { default: { http: [MST_RPC_URL] } },
  blockExplorers: { default: { name: 'MSTScan', url: MST_EXPLORER } },
  testnet: true,
});
export const MST_MAINNET_CHAIN_ID = 4646;
export const MST_MAINNET_RPC_URL = 'https://mariorpc.mstblockchain.com';
export const mstMainnet = defineChain({
  id: MST_MAINNET_CHAIN_ID, name: 'MST Mainnet',
  nativeCurrency: { name: 'MST Native Coin', symbol: 'MSTC', decimals: 18 },
  rpcUrls: { default: { http: [MST_MAINNET_RPC_URL] } },
  blockExplorers: { default: { name: 'MSTScan', url: 'https://mstscan.com' } }, testnet: false,
});
export const mstChains = [mstTestnet, mstMainnet] as const;
export function mstChain(id: number) {
  const chain = mstChains.find(item => item.id === id);
  if (!chain) throw new Error('Choose MST Testnet or MST Mainnet.');
  return chain;
}
