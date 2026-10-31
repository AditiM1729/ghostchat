import { walletConfig } from './reown';
import { mstTestnet } from '../../../shared/network';
import { isAddress, zeroAddress, type Address } from 'viem';
import { MST_RPC_URL, MST_EXPLORER } from '../../../shared/network';
import { setAllowedEscrow } from '../wallet/vault';
export { escrowAbi } from '../../../shared/abi';
export { claimDomain, claimTypes, requestMessage, rejectMessage } from '../../../shared/protocol';
export let contractAddress: Address = zeroAddress;
export let deployed = false;
export let deploymentBlock = 0n;
export let deploymentIssue = '';
const browserRpcUrl = import.meta.env.VITE_MST_RPC_URL || MST_RPC_URL;
export const chain = { ...mstTestnet, rpcUrls: { default: { http: [browserRpcUrl] } } } as const;
export const explorer = MST_EXPLORER;
export function configureDeployment(data: { address?: string; chainId?: number; blockNumber?: string; configured?: boolean }) {
  if (data.chainId !== chain.id) throw new Error('The relay is not configured for MST Testnet.');
  if (!data.configured) return;
  if (!isAddress(data.address || '') || data.address === zeroAddress || !/^\d+$/.test(data.blockNumber || '')) throw new Error('Invalid MST Testnet deployment configuration.');
  contractAddress = data.address as Address; deploymentBlock = BigInt(data.blockNumber!); deployed = true; setAllowedEscrow(contractAddress);
}
export function setDeploymentIssue(message: string) { deploymentIssue = message; }
export const config = walletConfig;
