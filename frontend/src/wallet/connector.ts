import { createConnector } from 'wagmi';
import { mstTestnet } from '../../../shared/network';
import { lockVault, registerVaultLock, vaultAccount, vaultClient, vaultSnapshot } from './vault';

export function ghostWallet() {
  return createConnector(config => ({
    id: 'ghostpay-local', name: 'GhostPay wallet', type: 'ghostpay',
    async setup() { registerVaultLock(() => config.emitter.emit('disconnect')); },
    async connect() { const address = vaultAccount().address; return { accounts: [address] as never, chainId: mstTestnet.id }; },
    async disconnect() { lockVault(); },
    async getAccounts() { return vaultSnapshot().unlocked ? [vaultAccount().address] : []; },
    async getChainId() { return mstTestnet.id; },
    async getClient() { return vaultClient(); },
    async getProvider() { return { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [vaultAccount().address];
      if (method === 'eth_chainId') return `0x${mstTestnet.id.toString(16)}`;
      if (method === 'wallet_switchEthereumChain') { if (Number((params?.[0] as { chainId: string })?.chainId) !== mstTestnet.id) throw new Error('Only MST Testnet is supported.'); return null; }
      throw new Error('Use the GhostPay signing client for this operation.');
    } }; },
    async isAuthorized() { return vaultSnapshot().unlocked; },
    async switchChain({ chainId }) { if (chainId !== mstTestnet.id) throw new Error('Only MST Testnet is supported.'); return mstTestnet; },
    onAccountsChanged(accounts) { if (!accounts.length) this.onDisconnect(); else config.emitter.emit('change', { accounts: accounts as never }); },
    onChainChanged() { config.emitter.emit('change', { chainId: mstTestnet.id }); },
    onDisconnect() { config.emitter.emit('disconnect'); },
  }));
}
