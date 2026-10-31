import { createConnector } from 'wagmi';
import { mstChain, MST_CHAIN_ID } from '../../../shared/network';
import { loginSaral, logoutSaral, saralSession, switchSaralChain } from './saral';
import './saralDriver';
export function saralWallet() {
  return createConnector(config => {
    let detach = () => {};
    return {
    id: 'mst-saral', name: 'Google · MST SARAL', type: 'saral',
    async connect({ chainId = MST_CHAIN_ID } = {}) {
      await loginSaral(); await switchSaralChain(chainId);
      detach();
      const provider = saralSession()!.provider;
      const accountsChanged = (accounts: string[]) => this.onAccountsChanged(accounts);
      const chainChanged = (id: string) => this.onChainChanged(id);
      const disconnected = () => this.onDisconnect();
      provider.on?.('accountsChanged', accountsChanged); provider.on?.('chainChanged', chainChanged); provider.on?.('disconnect', disconnected);
      detach = () => { provider.removeListener?.('accountsChanged', accountsChanged); provider.removeListener?.('chainChanged', chainChanged); provider.removeListener?.('disconnect', disconnected); };
      return { accounts: await this.getAccounts() as never, chainId };
    },
    async disconnect() { detach(); await logoutSaral(); },
    async getAccounts() { return saralSession() ? saralSession()!.provider.request({ method: 'eth_accounts' }) : []; },
    async getChainId() { return saralSession() ? Number(await saralSession()!.provider.request({ method: 'eth_chainId' })) : MST_CHAIN_ID; },
    async getProvider() { const session = saralSession(); if (!session) throw new Error('Sign in with Google first.'); return session.provider; },
    async isAuthorized() { return !!saralSession(); },
    async switchChain({ chainId }) { const chain = mstChain(chainId); await switchSaralChain(chainId); config.emitter.emit('change', { chainId }); return chain; },
    onAccountsChanged(accounts) { if (!accounts.length) this.onDisconnect(); else config.emitter.emit('change', { accounts: accounts as never }); },
    onChainChanged(chainId) { const id = Number(chainId); try { mstChain(id); config.emitter.emit('change', { chainId: id }); } catch { this.onDisconnect(); } },
    onDisconnect() { detach(); void logoutSaral(); config.emitter.emit('disconnect'); },
  }; });
}
