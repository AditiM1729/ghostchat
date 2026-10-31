import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeEventLog, encodeDeployData, formatEther, getAddress, isAddress, parseEther, type Abi, type Address, type Hex } from 'viem';
import { TEST_TRADE_CHAIN, testOrderMessage } from '../../../shared/testTrade';
import { useNativeWallet } from '../payments/useNativeWallet';
import { checkRpc, nativeClient, verifyCreation } from '../payments/native';
import { useAction } from '../hooks/useAction';
import './trade.css';

interface Artifact { abi: Abi; bytecode: Hex; deployedBytecode: Hex; testOnly: boolean; chainId: number; version: number }
interface Trade { seller: Address; buyer: Address; amount: bigint; inrPaise: bigint; acceptedAt: bigint; payUntil: bigint; termsHash: Hex; state: number }
interface Config { configured: boolean; attestor?: Address; reason?: string; mode: string; chainId?: number }
let artifactPromise: Promise<Artifact> | undefined;
async function artifact() {
  return artifactPromise ||= fetch('/contracts/test-trade.json', { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error('Test trade contract artifact is unavailable.');
    const a = await r.json() as Artifact;
    if (a.version !== 1 || a.chainId !== TEST_TRADE_CHAIN || a.testOnly !== true || !/^0x[0-9a-f]+$/i.test(a.bytecode) || !/^0x[0-9a-f]+$/i.test(a.deployedBytecode)) throw new Error('Invalid test trade artifact.');
    return a;
  }).catch(e => { artifactPromise = undefined; throw e; });
}
let checkoutScript: Promise<void> | undefined;
function loadCheckout() {
  return checkoutScript ||= new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return; }
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => (window as any).Razorpay ? resolve() : reject(new Error('Razorpay Checkout did not load.'));
    script.onerror = () => { script.remove(); reject(new Error('Unable to load Razorpay Checkout.')); };
    document.head.appendChild(script);
  }).catch(e => { checkoutScript = undefined; throw e; });
}
async function api(path: string, body?: unknown) {
  const r = await fetch(`/api/p2p/test-payments/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Test payment request failed.'); return data;
}
const savedKey = 'ghostchat.test-trade.deployment';
const pendingKey = 'ghostchat.test-trade.pending';
function stored(key: string) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
export default function TestTrade({ onBusyChange }: { onBusyChange?(busy: boolean): void }) {
  const [params, setParams] = useSearchParams();
  const initial = params.has('testEscrow') ? { escrow: params.get('testEscrow'), creation: params.get('testCreation') } : stored(savedKey);
  const [escrow, setEscrow] = useState(initial?.escrow || ''); const [creation, setCreation] = useState(initial?.creation || '');
  const [config, setConfig] = useState<Config>(); const [trade, setTrade] = useState<Trade>();
  const [buyer, setBuyer] = useState(''); const [amount, setAmount] = useState('0.1'); const [inr, setInr] = useState('100.00');
  const [checked, setChecked] = useState(false); const [tx, setTx] = useState<Hex>();
  const [pending, setPending] = useState<{ hash: Hex; kind: string; escrow?: Address; creation?: string; signer: Address; attestor: Address } | null>(() => stored(pendingKey));
  const action = useAction(); const wallet = useNativeWallet(TEST_TRADE_CHAIN); const root = useRef<HTMLElement>(null); const guard = useRef(false);
  const id = params.get('testTrade') || '';
  useEffect(() => { api('config').then(setConfig).catch(() => setConfig({ configured: false, mode: 'test', reason: 'The test payment relay is unavailable.' })); }, []);
  useEffect(() => { onBusyChange?.(action.busy || !!pending); }, [action.busy, pending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  async function run(fn: () => Promise<void>) { if (guard.current) return; guard.current = true; try { await action.run(fn); } finally { guard.current = false; } }
  async function verify(address = escrow, hash = creation) {
    if (!config?.configured || !config.attestor || config.mode !== 'test' || config.chainId !== TEST_TRADE_CHAIN) throw new Error(config?.reason || 'Configure Razorpay Test Mode first.');
    if (!isAddress(address) || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Deploy an escrow or open a complete test trade link.');
    await checkRpc(TEST_TRADE_CHAIN); const a = await artifact(); const client = nativeClient(TEST_TRADE_CHAIN);
    await verifyCreation(TEST_TRADE_CHAIN, getAddress(address), hash, encodeDeployData({ abi: a.abi, bytecode: a.bytecode, args: [config.attestor] }));
    if ((await client.getCode({ address }))?.toLowerCase() !== a.deployedBytecode.toLowerCase()) throw new Error('Unrecognized test escrow.');
    const signer = await client.readContract({ address, abi: a.abi, functionName: 'attestor' }) as Address;
    if (signer.toLowerCase() !== config.attestor.toLowerCase()) throw new Error('The test payment signing service changed. Use the original signer or a new escrow.');
    return { a, address: getAddress(address), client };
  }
  async function refresh() {
    const v = await verify();
    if (id) {
      if (!/^[1-9]\d{0,76}$/.test(id) || BigInt(id) >= 2n ** 256n) throw new Error('Invalid trade ID.');
      const t = await v.client.readContract({ address: v.address, abi: v.a.abi, functionName: 'getTrade', args: [BigInt(id)] }) as Trade;
      if (!t.state) throw new Error('Test trade was not found.'); setTrade(t);
    }
  }
  useEffect(() => {
    if (params.has('testEscrow')) { setEscrow(params.get('testEscrow') || ''); setCreation(params.get('testCreation') || ''); }
  }, [params]);
  useEffect(() => {
    let active = true; setTrade(undefined);
    if (escrow && config?.configured) {
      (async () => {
        const v = await verify();
        if (id) {
          if (!/^[1-9]\d{0,76}$/.test(id) || BigInt(id) >= 2n ** 256n) throw new Error('Invalid trade ID.');
          const t = await v.client.readContract({ address: v.address, abi: v.a.abi, functionName: 'getTrade', args: [BigInt(id)] }) as Trade;
          if (!t.state) throw new Error('Test trade was not found.'); if (active) setTrade(t);
        }
      })().catch(e => { if (active) action.setError(e.message || 'Trade verification failed.'); });
    }
    return () => { active = false; };
  }, [escrow, creation, id, config]);
  function link(address: string, hash: string, tradeId?: string) {
    setParams(new URLSearchParams({ testEscrow: address, testCreation: hash, ...(tradeId ? { testTrade: tradeId } : {}) }));
  }
  async function confirmed(p: NonNullable<typeof pending>) {
    const client = nativeClient(TEST_TRADE_CHAIN);
    const receipt = await client.waitForTransactionReceipt({ hash: p.hash, confirmations: 2 });
    if (receipt.status !== 'success') { localStorage.removeItem(pendingKey); setPending(null); throw new Error('The testnet transaction reverted.'); }
    if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The confirmation block changed. Check this transaction again.');
    if (p.kind === 'deploy') {
      if (!receipt.contractAddress || p.attestor.toLowerCase() !== config?.attestor?.toLowerCase()) throw new Error('Deployment signer changed; verify the original test configuration.');
      const address = receipt.contractAddress; await verify(address, p.hash);
      localStorage.setItem(savedKey, JSON.stringify({ escrow: address, creation: p.hash }));
      setEscrow(address); setCreation(p.hash); link(address, p.hash);
      action.setNotice('Testnet escrow deployed. Fund an offer with faucet tMSTC.');
    } else if (p.kind === 'offer') {
      const a = await artifact(); let found: string | undefined;
      for (const log of receipt.logs) if (log.address.toLowerCase() === p.escrow?.toLowerCase()) {
        try { const event = decodeEventLog({ abi: a.abi, data: log.data, topics: log.topics }) as any; if (event.eventName === 'Offered') found = String(event.args.tradeId); } catch { /* Ignore unrelated logs. */ }
      }
      if (!found) throw new Error('Deposit confirmed but no trade event was found. Check the transaction before funding another offer.');
      if (!p.creation) throw new Error('The original escrow creation transaction is missing. Recover it from the setup link.');
      setEscrow(p.escrow!); setCreation(p.creation); link(p.escrow!, p.creation, found); action.setNotice('tMSTC locked. Share this trade link with the named buyer.');
    } else { await refresh(); action.setNotice(p.kind === 'settle' ? 'Payment verified in Razorpay Test Mode. tMSTC released to the agreed buyer.' : 'Testnet transaction confirmed.'); }
    localStorage.removeItem(pendingKey); setPending(null);
  }
  async function send(kind: string, write: () => Promise<Hex>, signer: Address, address?: Address) {
    if (!checked || pending) throw new Error('Confirm test-only use and resolve the existing transaction first.');
    const hash = await write(); setTx(hash);
    const p = { hash, kind, signer, attestor: config!.attestor!, creation, ...(address ? { escrow: address } : {}) };
    // Public transaction identifiers only. Keep recovery available if receipt polling fails.
    localStorage.setItem(pendingKey, JSON.stringify(p)); setPending(p); await confirmed(p);
  }
  async function deploy() {
    if (!config?.configured) throw new Error(config?.reason || 'Test Mode is not configured.');
    const w = await wallet.wallet(); const a = await artifact();
    await send('deploy', () => w.deployContract({ abi: a.abi, bytecode: a.bytecode, args: [config.attestor] }), w.account.address);
  }
  async function offer() {
    if (!isAddress(buyer) || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,18})?$/.test(amount) || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(inr)) throw new Error('Enter a buyer address, tMSTC amount and mock INR amount.');
    const value = parseEther(amount); const [whole, fraction = ''] = inr.split('.'); const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (value <= 0n || value > parseEther('10') || paise < 100n || paise > 10000000n) throw new Error('Demo limits: up to 10 tMSTC and ₹1–₹100,000 mock INR.');
    const w = await wallet.wallet(); const v = await verify();
    const now = (await v.client.getBlock()).timestamp;
    await send('offer', () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: 'offer', args: [getAddress(buyer), paise, now + 3600n], value }), w.account.address, v.address);
  }
  async function chainAction(kind: string, functionName: string, args: unknown[]) {
    const w = await wallet.wallet(); const v = await verify();
    await send(kind, () => w.writeContract({ address: v.address, abi: v.a.abi, functionName, args }), w.account.address, v.address);
  }
  async function authorization() {
    const w = await wallet.wallet(); const v = await verify(); const timestamp = Math.floor(Date.now() / 1000);
    const signature = await w.signMessage({ message: testOrderMessage(v.address, id, timestamp) });
    return { escrow: v.address, creation, tradeId: id, timestamp, signature };
  }
  async function release(callback?: { razorpay_payment_id: string; razorpay_signature: string }) {
    const body = await authorization();
    const result = await api('verify', { ...body, ...(callback ? { paymentId: callback.razorpay_payment_id, checkoutSignature: callback.razorpay_signature } : {}) });
    if (result.mode !== 'test') throw new Error('Unexpected payment mode.');
    if (result.status === 'pending') { action.setNotice('No captured test payment yet. Finish Test Checkout, then check again.'); return; }
    if (result.status !== 'verified' || !/^0x[0-9a-f]{64}$/i.test(result.paymentId) || !/^\d{1,20}$/.test(result.paidAt) || !/^\d{1,20}$/.test(result.validUntil) || !/^0x[0-9a-f]{130}$/i.test(result.signature)) throw new Error('Invalid test payment attestation.');
    action.setNotice('Mock INR payment verified. Approve the testnet transaction to release tMSTC.');
    await chainAction('settle', 'settle', [BigInt(id), result.paymentId, BigInt(result.paidAt), BigInt(result.validUntil), result.signature]);
  }
  async function checkout() {
    const order = await api('orders', await authorization());
    if (order.mode !== 'test' || !/^rzp_test_[a-zA-Z0-9]+$/.test(order.keyId) || !/^order_[a-zA-Z0-9]+$/.test(order.orderId)) throw new Error('Live payment checkout is forbidden.');
    await loadCheckout();
    // Standard Checkout lives in a body-level overlay. Temporarily leave the native dialog top layer.
    const dialog = root.current?.closest('dialog'); const reopen = dialog?.open; if (reopen) dialog.close();
    try {
      const callback = await new Promise<any>((resolve) => {
        const r = new (window as any).Razorpay({ key: order.keyId, order_id: order.orderId, amount: order.amount, currency: 'INR', name: 'GhostChat TEST', description: 'Mock INR for testnet tMSTC. No real money.', handler: resolve, modal: { ondismiss: () => resolve(null) } });
        r.open();
      });
      if (reopen && dialog?.isConnected) dialog.showModal();
      if (callback) await release(callback); else action.setNotice('Checkout closed. Use “Check payment & release” to recover any completed test payment.');
    } finally { if (reopen && dialog?.isConnected && !dialog.open) dialog.showModal(); }
  }
  const isBuyer = trade?.buyer.toLowerCase() === wallet.address?.toLowerCase(); const isSeller = trade?.seller.toLowerCase() === wallet.address?.toLowerCase();
  const disabled = action.busy || !!pending || !checked;
  return <section ref={root} className="gp-trade-lab panel">
    <div className="gp-trade-lab-title"><span className="gp-trade-tag">Razorpay Test Mode · MST Testnet</span><h2>Pay mock INR. Receive tMSTC.</h2><p>The seller locks faucet tokens. A captured test payment is checked by the server before the buyer approves release. No real INR, mainnet MSTC or ZK proof.</p></div>
    <label className="gp-trade-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>I understand this is a testnet demo with simulated INR.</span></label>
    {!config?.configured && <p role="status">{config?.reason || 'Checking Test Mode configuration…'}</p>}
    <a href="https://faucet.mstblockchain.com" target="_blank" rel="noreferrer">Get faucet tMSTC for deposits and gas</a>
    <div className="gp-trade-actions"><button className="button secondary" disabled={disabled} onClick={() => run(async () => { await wallet.wallet(); })}>Connect / unlock wallet</button><button className="button secondary" disabled={disabled || !config?.configured} onClick={() => run(deploy)}>Deploy test escrow</button></div>
    {escrow && <><p>Escrow: <a href={`https://testnet.mstscan.com/address/${escrow}`} target="_blank" rel="noreferrer">{escrow}</a></p><div className="gp-trade-actions"><button className="button secondary" disabled={action.busy} onClick={() => run(refresh)}>Refresh trade</button>{id && <button className="button secondary" disabled={action.busy} onClick={() => run(async () => { await navigator.clipboard.writeText(`${location.origin}/trade?${params}`); action.setNotice('Test trade link copied.'); })}>Copy trade link</button>}<button className="button secondary" disabled={disabled} onClick={() => { link(escrow, creation); setTrade(undefined); }}>New offer</button></div></>}
    {escrow && !id && <div className="gp-trade-offer"><h3>Fund a test offer</h3><label>Buyer wallet<input value={buyer} onChange={e => setBuyer(e.target.value)} maxLength={42} placeholder="0x…" disabled={disabled}/></label><label>tMSTC to lock<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" disabled={disabled}/></label><label>Mock INR total<input value={inr} onChange={e => setInr(e.target.value)} inputMode="decimal" disabled={disabled}/></label><p>You set both demo amounts. This is not a market quote. No protocol fee is charged.</p><button className="button primary" disabled={disabled} onClick={() => run(offer)}>Lock tMSTC</button></div>}
    {id && !trade && <p>Refresh to verify this trade.</p>}
    {trade && <div className="gp-trade-live"><h3>Trade #{id} · {['Missing', 'Awaiting acceptance', 'Awaiting test payment', 'Tokens released', 'Returned to seller'][trade.state]}</h3><dl className="gp-trade-breakdown"><div><dt>Seller</dt><dd>{trade.seller}</dd></div><div><dt>Buyer</dt><dd>{trade.buyer}</dd></div><div><dt>Buyer receives</dt><dd>{formatEther(trade.amount)} tMSTC</dd></div><div><dt>Mock INR</dt><dd>₹{(Number(trade.inrPaise) / 100).toFixed(2)}</dd></div></dl>
      <div className="gp-trade-actions">{trade.state === 1 && isBuyer && <button className="button primary" disabled={disabled} onClick={() => run(() => chainAction('accept', 'accept', [BigInt(id), trade.termsHash]))}>Accept exact terms</button>}
      {trade.state === 2 && isBuyer && <><button className="button primary" disabled={disabled} onClick={() => run(checkout)}>Pay mock INR</button><button className="button secondary" disabled={disabled} onClick={() => run(() => release())}>Check payment & release</button></>}
      {trade.state === 1 && isSeller && <button className="button secondary" disabled={disabled} onClick={() => run(() => chainAction('refund', 'refund', [BigInt(id)]))}>Cancel unaccepted offer</button>}</div>
      {trade.state === 2 && <p>The buyer has 30 minutes to create the test payment. Verification and release can be retried afterward. Seller timeout withdrawal is disabled.</p>}
      {trade.state === 2 && isBuyer && <details><summary>Return my test allocation</summary><p>This returns tMSTC to the seller and ends this demo trade, including if a mock payment was already made.</p><button className="button secondary" disabled={disabled} onClick={() => run(() => chainAction('refund', 'refund', [BigInt(id)]))}>Forfeit allocation & return tMSTC</button></details>}
      {trade.state === 3 && <p className="gp-trade-success" role="status">tMSTC was released on MST Testnet.</p>}
    </div>}
    {pending && <button className="button secondary" disabled={action.busy} onClick={() => run(() => confirmed(pending))}>Check submitted {pending.kind} transaction</button>}
    {action.busy && <p role="status">Waiting for your wallet, Test Mode verification or testnet confirmations…</p>}
    {action.error && <p role="alert" className="gp-trade-error">{action.error}</p>}{action.notice && <p role="status" className="gp-trade-success">{action.notice}</p>}
    {(tx || pending?.hash) && <a href={`https://testnet.mstscan.com/tx/${tx || pending?.hash}`} target="_blank" rel="noreferrer">View testnet transaction</a>}
  </section>;
}
