// Compatibility import path; active onboarding requires BridgeKey.
import { createConfig, http, type CreateConnectorFn } from 'wagmi';
import { connect, getAccount, reconnect } from '@wagmi/core';
import { waitForBridgeKey } from '../wallet/restoreConnection';
import { mstChains, MST_CHAIN_ID } from '../../../shared/network';
import { bridgeKeyConnection, isBridgeKey } from '../wallet/bridgekey';
export const walletConfig = createConfig({
  ssr: true,
  chains: mstChains, multiInjectedProviderDiscovery: true,
  connectors: [] as CreateConnectorFn[],
  transports: { 91562037: http(mstChains[0].rpcUrls.default.http[0], { timeout: 20000, retryCount: 1 }), 4646: http(mstChains[1].rpcUrls.default.http[0], { timeout: 20000, retryCount: 1 }) },
});
let restoring = true;
let restorePromise: Promise<void> | undefined;
const restorationListeners = new Set<() => void>();
export const walletRestoring = () => restoring;
export const subscribeWalletRestoration = (fn: () => void) => { restorationListeners.add(fn); return () => { restorationListeners.delete(fn); }; };
export function restoreWalletConnection() {
  return restorePromise ||= waitForBridgeKey({
    connectors: () => walletConfig.connectors,
    connected: () => { const account = getAccount(walletConfig); return account.isConnected && !!account.connector && isBridgeKey(account.connector); },
    restore: async connector => { await reconnect(walletConfig, { connectors: [connector] }); },
    pause: () => new Promise(resolve => setTimeout(resolve, 200)),
  }).finally(() => { restoring = false; restorationListeners.forEach(fn => fn()); });
}
export async function openWalletAccount(_view?: 'Connect' | 'Account') {
  const current = getAccount(walletConfig);
  if (current.isConnected && current.connector && isBridgeKey(current.connector)) return;
  await connect(walletConfig, { connector: bridgeKeyConnection(walletConfig.connectors).connector, chainId: mstChains[0].id });
}
