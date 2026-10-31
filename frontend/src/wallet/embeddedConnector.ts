import { createConnector } from 'wagmi';
import { mstChain, MST_CHAIN_ID } from '../../../shared/network';
import { googleSession } from './googleSession';
import { signOutEmbeddedWallet } from './embeddedWallet';
export function embeddedWalletConnector() {
  return createConnector(config => {
    let detach = () => {};
    const provider = () => { const current = googleSession()?.provider; if (!current) throw new Error('Sign in with Google and unlock your wallet on the account setup screen.'); return current; };
    return {
      id: 'ghostchat-google', name: 'GhostChat Google wallet', type: 'embedded',
      async connect({ chainId = MST_CHAIN_ID } = {}) {
        mstChain(chainId); const current = provider();
        await current.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] });
        if (Number(await current.request({ method: 'eth_chainId' })) !== chainId) throw new Error('Wallet network mismatch.');
        detach(); const accountsChanged = (accounts: string[]) => this.onAccountsChanged(accounts); const chainChanged = (chain: string) => this.onChainChanged(chain); const disconnected = () => this.onDisconnect();
        current.on('accountsChanged', accountsChanged); current.on('chainChanged', chainChanged); current.on('disconnect', disconnected);
        detach = () => { current.removeListener('accountsChanged', accountsChanged); current.removeListener('chainChanged', chainChanged); current.removeListener('disconnect', disconnected); };
        return { accounts: await current.request({ method: 'eth_accounts' }) as never, chainId };
      },
      async disconnect() { detach(); signOutEmbeddedWallet(); },
      async getAccounts() { return googleSession()?.provider ? provider().request({ method: 'eth_accounts' }) : []; },
      async getChainId() { return googleSession()?.provider ? Number(await provider().request({ method: 'eth_chainId' })) : MST_CHAIN_ID; },
      async getProvider() { return provider(); },
      async isAuthorized() { return !!googleSession()?.provider; },
      async switchChain({ chainId }) { const chain = mstChain(chainId); await provider().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] }); return chain; },
      onAccountsChanged(accounts) { if (!accounts.length) this.onDisconnect(); else config.emitter.emit('change', { accounts: accounts as never }); },
      onChainChanged(chain) { const chainId = Number(chain); mstChain(chainId); config.emitter.emit('change', { chainId }); },
      onDisconnect() { detach(); config.emitter.emit('disconnect'); },
    };
  });
}
