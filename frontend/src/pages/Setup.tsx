import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useBalance, usePublicClient, useSendTransaction, useSwitchChain } from 'wagmi';
import { formatEther, type Hex } from 'viem';
import { Check, ExternalLink, Rocket } from 'lucide-react';
import { mstChain, mstChains, MST_CHAIN_ID } from '../../../shared/network';
import { api } from '../lib/api';
import { openWalletAccount } from '../config/reown';

import { useAction } from '../hooks/useAction';
import { Busy, Feedback } from '../components/UI';
interface Deployment { address: string; configured: boolean; transactionHash?: Hex; chainId: number }
const pendingKey = (id: number) => `ghostchat-deployment-transaction-${id}`;
function savedHash(id: number): string { try { return localStorage.getItem(pendingKey(id)) || ''; } catch { return ''; } }
export function Setup({ onBusyChange }: { onBusyChange?(busy: boolean): void } = {}) {
  const { address, chainId } = useAccount(); const [networkId, setNetworkId] = useState(MST_CHAIN_ID); const chain = mstChain(networkId);
  const client = usePublicClient({ chainId: chain.id }); const { data: balance } = useBalance({ address, chainId: chain.id });
  const { sendTransactionAsync } = useSendTransaction(); const { switchChainAsync } = useSwitchChain(); const action = useAction();
  const endpoint = chain.testnet ? '/deployment' : '/mainnet-deployment';
  const deployment = useQuery({ queryKey: ['mst-deployment', networkId], queryFn: () => api<Deployment>(endpoint) });
  const artifact = useQuery({ queryKey: ['mst-artifact', networkId], queryFn: () => api<{ bytecode: Hex; chainId: number }>(`${endpoint}/artifact`) });
  const [hash, setHash] = useState(() => savedHash(networkId)); const [existingHash, setExistingHash] = useState(''); const [mainnetAccepted, setMainnetAccepted] = useState(false);
  useEffect(() => { setHash(savedHash(networkId)); setExistingHash(''); setMainnetAccepted(false); action.setError(''); action.setNotice(''); }, [networkId]);
  useEffect(() => { onBusyChange?.(action.busy); }, [action.busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const cost = useQuery({ queryKey: ['deployment-estimate', networkId, address, artifact.data?.bytecode], enabled: !!address && !!client && !!artifact.data && chainId === networkId && !deployment.data?.configured, staleTime: 30000,
    queryFn: async () => (await client!.estimateGas({ account: address!, data: artifact.data!.bytecode })) * (await client!.getGasPrice()) * 120n / 100n });
  async function finish(transactionHash: Hex) {
    if (!client) throw new Error('Network connection unavailable.');
    action.setNotice(`Waiting for two ${chain.name} confirmations…`);
    const receipt = await client.waitForTransactionReceipt({ hash: transactionHash, confirmations: 2, timeout: 240000 });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('This transaction did not successfully deploy a contract.');
    await api(endpoint, { transactionHash: receipt.transactionHash });
    try { localStorage.removeItem(pendingKey(networkId)); } catch {}
    setHash(''); await deployment.refetch(); action.setNotice(`Contract verified and saved for ${chain.name}.`);
  }
  async function deploy() { await action.run(async () => {
    if (!address || chainId !== networkId || !client || !artifact.data) throw new Error(`Sign into your wallet on ${chain.name} first.`);
    if (artifact.data.chainId !== networkId || await client.getChainId() !== networkId) throw new Error('The artifact or RPC returned a different network.');
    if (!chain.testnet && !mainnetAccepted) throw new Error('Confirm that you want to spend mainnet MSTC on deployment gas.');
    if ((await api<Deployment>(endpoint)).configured) { await deployment.refetch(); return; }
    if (!cost.data || !balance?.value || balance.value < cost.data) throw new Error(`Fund this wallet with ${chain.nativeCurrency.symbol} for deployment gas and wait for an estimate.`);
    action.setNotice(`Review the ${chain.name} contract deployment in your wallet.`);
    const transactionHash = await sendTransactionAsync({ data: artifact.data.bytecode, value: 0n, chainId: networkId });
    setHash(transactionHash); try { localStorage.setItem(pendingKey(networkId), transactionHash); } catch {}
    await finish(transactionHash);
  }); }
  return <div className="page setup-page"><div className="page-heading"><span className="section-kicker">MST CONTRACT DEPLOYMENT</span><h1>Deploy on<br/><em>your MST network.</em></h1><p>Deploy GhostPayEscrow on testnet or mainnet. No payment deposit is sent.</p></div>
    <section className="panel form-panel">
      <label htmlFor="deployment-network">Deployment network</label><select id="deployment-network" value={networkId} disabled={action.busy} onChange={event => setNetworkId(Number(event.target.value))}>{mstChains.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select>
      {deployment.data?.configured ? <><span className="step-icon"><Check size={22}/></span><h2>Deployed on {chain.name}</h2><a className="setup-address" href={`${chain.blockExplorers.default.url}/address/${deployment.data.address}`} target="_blank" rel="noreferrer">{deployment.data.address}<ExternalLink size={15}/></a>{deployment.data.transactionHash && <a className="ms-text" href={`${chain.blockExplorers.default.url}/tx/${deployment.data.transactionHash}`} target="_blank" rel="noreferrer">Deployment transaction</a>}</> : <>
        <div className="panel-title"><Rocket size={20}/><h2>Deploy GhostPayEscrow</h2></div>
        <dl className="payment-details"><div><dt>Network</dt><dd>{chain.name} · {chain.id}</dd></div><div><dt>Wallet balance</dt><dd>{balance ? formatEther(balance.value) : '—'} {chain.nativeCurrency.symbol}</dd></div><div><dt>Estimated gas budget</dt><dd>{cost.data ? `~${formatEther(cost.data)} ${chain.nativeCurrency.symbol}` : cost.isFetching ? 'Estimating…' : 'Connect and fund your wallet'}</dd></div><div><dt>Payment deposit</dt><dd>0 {chain.nativeCurrency.symbol}</dd></div></dl>
        {!address && <button className="button secondary full" disabled={action.busy} onClick={() => { void action.run(() => openWalletAccount('Connect')); }}>Connect BridgeKey</button>}
        {!address && <p className="feedback neutral">Connect BridgeKey and review the selected MST network before deployment.</p>}
        {address && chainId !== networkId && <button className="button secondary full" disabled={action.busy} onClick={() => { void action.run(async () => { await switchChainAsync({ chainId: networkId }); }); }}>Switch to {chain.name}</button>}
        {!chain.testnet && <label className="ms-fine"><input type="checkbox" checked={mainnetAccepted} disabled={action.busy} onChange={event => setMainnetAccepted(event.target.checked)}/> Deploy on MST Mainnet using real MSTC for gas. This deploys the contract only; P2P remains a testnet sandbox.</label>}
        <Feedback action={action}/>{(cost.error || artifact.error || deployment.error) && <p className="feedback error">Deployment checks unavailable. Check your RPC and restart the relay.</p>}
        {hash ? <><a className="setup-address" href={`${chain.blockExplorers.default.url}/tx/${hash}`} target="_blank" rel="noreferrer">Pending deployment<ExternalLink size={15}/></a><button className="button primary full" disabled={action.busy} onClick={() => { void action.run(() => finish(hash as Hex)); }}>{action.busy ? <Busy>Checking deployment…</Busy> : 'Verify saved transaction'}</button></> : <button className="button primary full" disabled={action.busy || !address || chainId !== networkId || !artifact.data || !cost.data || !chain.testnet && !mainnetAccepted} onClick={() => { void deploy(); }}>{action.busy ? <Busy>Deploying…</Busy> : `Deploy on ${chain.name}`}</button>}
        <details className="setup-import"><summary>Register a deployment made through the CLI</summary><label htmlFor="deployment-hash">{chain.name} creation transaction hash</label><input id="deployment-hash" value={existingHash} onChange={event => setExistingHash(event.target.value.trim())} placeholder="0x…"/><button className="button secondary" disabled={action.busy || !/^0x[\da-fA-F]{64}$/.test(existingHash)} onClick={() => { void action.run(() => finish(existingHash as Hex)); }}>Verify & register contract</button></details>
      </>}
    </section></div>;
}
