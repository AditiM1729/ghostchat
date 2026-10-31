import { createPublicClient, createWalletClient, formatEther, getAddress, hexToString, http, isAddress, type Address, type EIP1193Provider, type Hex, type PrivateKeyAccount } from 'viem';
import { mstChain, MST_CHAIN_ID } from '../../../shared/network';

export interface SigningReview { title: string; rows: [string, string][] }
export type ConfirmSigning = (review: SigningReview) => Promise<boolean>;
const reject = () => Object.assign(new Error('Wallet request cancelled.'), { code: 4001 });
export function createEmbeddedProvider(signer: PrivateKeyAccount, confirm: ConfirmSigning) {
  let chainId = MST_CHAIN_ID; let active = true; let signing = false;
  const events = new Map<string, Set<(...args: any[]) => void>>();
  const emit = (event: string, ...args: any[]) => events.get(event)?.forEach(listener => listener(...args));
  const ensure = () => { if (!active) throw new Error('Your wallet is locked. Sign in and unlock it again.'); };
  const checkAccount = (address: unknown) => { if (typeof address !== 'string' || !isAddress(address) || getAddress(address) !== signer.address) throw new Error('The requested account does not match your wallet.'); };
  const quantity = (value: unknown, field: string): bigint | undefined => {
    if (value === undefined) return;
    if (typeof value !== 'string' || !/^0x[\da-f]+$/i.test(value) || value.length > 66) throw new Error(`Invalid transaction ${field}.`);
    return BigInt(value);
  };
  async function reviewed<T>(review: SigningReview, operation: () => Promise<T>, expectedChain = chainId) {
    ensure(); if (chainId !== expectedChain) throw new Error('The network changed. Review the request again.'); if (signing) throw new Error('Finish the current wallet confirmation first.'); signing = true;
    try { if (!await confirm(review)) throw reject(); ensure(); if (chainId !== expectedChain) throw new Error('The network changed during confirmation. Review again.'); return await operation(); }
    finally { signing = false; }
  }
  const request = async ({ method, params = [] }: { method: string; params?: any }) => {
    ensure(); const chain = mstChain(chainId); const parameters = params as any[];
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [signer.address];
    if (method === 'eth_chainId') return `0x${chainId.toString(16)}`;
    if (method === 'net_version') return String(chainId);
    if (method === 'wallet_switchEthereumChain') {
      if (signing) throw new Error('Finish the current confirmation before switching networks.');
      const next = mstChain(Number(parameters[0]?.chainId)); chainId = next.id; emit('chainChanged', `0x${chainId.toString(16)}`); return null;
    }
    if (method === 'wallet_addEthereumChain') { mstChain(Number(parameters[0]?.chainId)); return null; }
    if (method === 'personal_sign') {
      const [data, address] = parameters; checkAccount(address);
      if (typeof data !== 'string' || !/^0x([\da-f]{2})*$/i.test(data) || data.length > 32770) throw new Error('Invalid or oversized signing message.');
      let message: string; try { message = hexToString(data as Hex); } catch { message = data; }
      return reviewed({ title: 'Approve this wallet signature?', rows: [['Wallet', signer.address], ['Message', message]] }, () => signer.signMessage({ message: { raw: data as Hex } }));
    }
    if (method === 'eth_signTypedData_v4') {
      checkAccount(parameters[0]); const raw = parameters[1];
      if (typeof raw !== 'string' || raw.length > 32768) throw new Error('Invalid typed-data request.');
      const typed = JSON.parse(raw);
      if (!typed.domain || Number(typed.domain.chainId) !== chainId || !typed.primaryType || !typed.types || !typed.message) throw new Error('The signature domain must match the selected MST network.');
      const { EIP712Domain: _domain, ...types } = typed.types;
      return reviewed({ title: 'Approve this structured signature?', rows: [['Network', chain.name], ['Domain / contract', JSON.stringify(typed.domain)], ['Authorization', JSON.stringify({ type: typed.primaryType, message: typed.message }, null, 2)]] }, () => signer.signTypedData({ ...typed, types }));
    }
    if (method === 'eth_sendTransaction') {
      const raw = parameters[0]; if (!raw || typeof raw !== 'object') throw new Error('Invalid transaction.'); checkAccount(raw.from);
      const allowed = new Set(['from','to','data','value','gas','gasPrice','maxFeePerGas','maxPriorityFeePerGas','nonce','chainId','type']);
      if (Object.keys(raw).some(key => !allowed.has(key))) throw new Error('Unsupported transaction field.');
      if (raw.chainId !== undefined && Number(raw.chainId) !== chainId) throw new Error('Transaction network mismatch.');
      if (raw.to != null && (!isAddress(raw.to) || /^0x0{40}$/i.test(raw.to))) throw new Error('Invalid transaction recipient.');
      if (raw.data !== undefined && (typeof raw.data !== 'string' || !/^0x([\da-f]{2})*$/i.test(raw.data) || raw.data.length > 100000)) throw new Error('Invalid transaction data.');
      if (!raw.to && (!raw.data || raw.data === '0x')) throw new Error('Contract deployment requires bytecode.');
      const fields: Record<string, any> = { account: signer, chain, ...(raw.to ? { to: getAddress(raw.to) } : {}), ...(raw.data ? { data: raw.data } : {}) };
      for (const field of ['value','gas','gasPrice','maxFeePerGas','maxPriorityFeePerGas']) { const value = quantity(raw[field], field); if (value !== undefined) fields[field] = value; }
      if (raw.nonce !== undefined) { const nonce = quantity(raw.nonce, 'nonce')!; if (nonce > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid nonce.'); fields.nonce = Number(nonce); }
      if (raw.type !== undefined && !['0x0','0x2'].includes(raw.type)) throw new Error('Unsupported transaction type.');
      if (raw.type) fields.type = raw.type === '0x0' ? 'legacy' : 'eip1559';
      const publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
      if (await publicClient.getChainId() !== chainId) throw new Error('The RPC returned a different network.');
      const wallet = createWalletClient({ account: signer, chain, transport: http(chain.rpcUrls.default.http[0]) });
      const expectedChain = chain.id;
      const prepared = await wallet.prepareTransactionRequest(fields as any);
      const maxFee = BigInt(prepared.gas) * BigInt(prepared.maxFeePerGas || prepared.gasPrice || 0n);
      return reviewed({ title: chain.testnet ? 'Confirm MST testnet transaction' : 'Confirm MST MAINNET transaction', rows: [['Network', `${chain.name} · ${chain.id}`], ['From', signer.address], [raw.to ? 'Recipient / contract' : 'Action', raw.to || 'Deploy a new contract'], ['Amount', `${formatEther(prepared.value || 0n)} ${chain.nativeCurrency.symbol}`], ['Maximum gas fee', `${formatEther(maxFee)} ${chain.nativeCurrency.symbol}`], ['Transaction data', raw.data || 'No contract data']] }, () => wallet.sendTransaction(prepared as any), expectedChain);
    }
    // Never proxy arbitrary signing, permissions or raw broadcast requests.
    const reads = new Set(['eth_getBalance','eth_blockNumber','eth_call','eth_estimateGas','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getBlockByHash','eth_gasPrice','eth_maxPriorityFeePerGas','eth_feeHistory','eth_getLogs']);
    if (!reads.has(method)) throw new Error(`Unsupported wallet method: ${method}`);
    const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
    return client.request({ method, params: parameters } as any);
  };
  const provider = { request, on(event: string, listener: (...args: any[]) => void) { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(listener); }, removeListener(event: string, listener: (...args: any[]) => void) { events.get(event)?.delete(listener); } } as EIP1193Provider;
  return { provider, close() { if (!active) return; active = false; emit('disconnect', { code: 4900, message: 'Wallet locked' }); events.clear(); } };
}
