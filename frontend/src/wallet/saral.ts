import { getAddress, isAddress, zeroAddress, type EIP1193Provider } from 'viem';
import { mstChain, MST_CHAIN_ID } from '../../../shared/network';
// GhostChat integration boundary, NOT a claimed API of the unpublished SARAL SDK.
export interface SaralSession { provider: EIP1193Provider; googleIdToken: string }
export interface SaralDriver { loginWithGoogle(): Promise<SaralSession>; logout(): Promise<void> }
let driver: SaralDriver | undefined;
let session: SaralSession | undefined;
let pending: Promise<SaralSession> | undefined;
export function registerSaralDriver(implementation: SaralDriver) { driver = implementation; }
export const saralAvailable = () => !!driver;
export const saralSession = () => session;
export async function loginSaral() {
  if (session) return session;
  if (!driver) throw new Error('SARAL Google sign-in is awaiting the official authentication SDK. No wallet has been created.');
  if (pending) return pending;
  pending = (async () => {
    const candidate = await driver!.loginWithGoogle();
    if (!candidate.googleIdToken || !candidate.provider?.request) throw new Error('SARAL must return a verifiable Google session and EVM provider.');
    const accounts = await candidate.provider.request({ method: 'eth_accounts' });
    if (!accounts.length || !isAddress(accounts[0]) || getAddress(accounts[0]) === zeroAddress) throw new Error('SARAL did not return a valid wallet.');
    mstChain(Number(await candidate.provider.request({ method: 'eth_chainId' })));
    session = candidate; return candidate;
  })().finally(() => { pending = undefined; });
  return pending;
}
export async function logoutSaral() { session = undefined; await driver?.logout(); }
export async function switchSaralChain(id: number) {
  const chain = mstChain(id); const current = await loginSaral();
  try { await current.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${id.toString(16)}` }] }); }
  catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await current.provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${id.toString(16)}`, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: [...chain.rpcUrls.default.http], blockExplorerUrls: [chain.blockExplorers.default.url] }] });
    await current.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${id.toString(16)}` }] });
  }
  if (Number(await current.provider.request({ method: 'eth_chainId' })) !== id) throw new Error('The wallet did not switch to the requested MST network.');
  return chain;
}
