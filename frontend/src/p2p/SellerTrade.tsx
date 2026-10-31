import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeEventLog, formatEther, getAddress, isAddress, parseEther, type Abi, type Address, type Hex } from 'viem';
import { TEST_TRADE_CHAIN } from '../../../shared/testTrade';
import { useNativeWallet } from '../payments/useNativeWallet';
import { nativeClient, verifyCreation } from '../payments/native';
import { useAction } from '../hooks/useAction';
import { accountApi } from '../wallet/accountApi';
import { normalizeSellerTrade } from '../../../shared/sellerTradeModel';
import OfferBoard, { inrTotal, type BuyOffer } from './OfferBoard';
import { matchesOffer, nextTradeStep } from './tradeJourney';
import { TradePaymentDetails } from './TradePaymentDetails';
import { mergePaymentSnapshot, paymentForScope, type PaymentSnapshot } from './paymentSnapshot';
import UTRPanel from './UTRPanel';
import './trade.css';

type Artifact = { abi: Abi; bytecode: Hex; deployedBytecode: Hex; chainId: number; version: number };
type Trade = readonly [Address, Address, Address, bigint, bigint, number, boolean];
type Pending = { hash: Hex; kind: string; escrow?: Address; creation?: string; bid?: string };
const storage = 'ghostchat.seller-trade.pending';
function savedPending(): Pending | null { try { return JSON.parse(localStorage.getItem(storage) || 'null'); } catch { return null; } }
async function artifact(simple = false, previous = false): Promise<Artifact> {
  const response = await fetch(simple ? previous ? '/contracts/legacy-simple-seller-trade.json' : '/contracts/simple-seller-trade.json' : '/contracts/seller-trade.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Seller-confirmed escrow artifact is unavailable.');
  const a: Artifact = await response.json();
  if (a.version !== (simple ? previous ? 2 : 3 : 1) || a.chainId !== TEST_TRADE_CHAIN || !/^0x[0-9a-f]+$/i.test(a.bytecode)) throw new Error('Invalid escrow artifact.');
  return a;
}
export default function SellerTrade({ onBusyChange }: { onBusyChange?(busy: boolean): void }) {
  const [params, setParams] = useSearchParams();
  const id = params.get('sellerTrade') || '';
  const [simpleConfig, setSimpleConfig] = useState<{ configured: boolean; escrow?: string; creation?: string; utrVerifier?: Address }>();
  const [configError, setConfigError] = useState('');
  const [tradeSnapshot, setTradeSnapshot] = useState<{ key: string; t: Trade; simple: boolean; utr: boolean }>();
  const escrow = id ? params.get('sellerEscrow') || '' : simpleConfig?.escrow || '';
  const creation = id ? params.get('sellerCreation') || '' : simpleConfig?.creation || '';
  const tradeScope = `${escrow.toLowerCase()}:${creation.toLowerCase()}:${id}`;
  const loadedTrade = tradeSnapshot?.key === tradeScope ? tradeSnapshot : undefined;
  const trade = loadedTrade?.t; const simpleMode = !id || !!loadedTrade?.simple; const utrMode = !id || !!loadedTrade?.utr;

  const [detailsRefresh, setDetailsRefresh] = useState(0);
  const [selected, setSelected] = useState<BuyOffer>();
  const [upi, setUpi] = useState(''); const [utr, setUtr] = useState(''); const [qr, setQr] = useState<string>();
  const [paymentSnapshot, setPaymentSnapshot] = useState<PaymentSnapshot>();
  const paymentSnapshotRef = useRef<PaymentSnapshot | undefined>(undefined); paymentSnapshotRef.current = paymentSnapshot;
  const [savedUpi, setSavedUpi] = useState<{ upiId: string; qr: string }>();
  const [profileLoading, setProfileLoading] = useState(false);

  const [checked, setChecked] = useState(false); const [pending, setPending] = useState<Pending | null>(savedPending);
  const fundingForm = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected && !id) { fundingForm.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); fundingForm.current?.focus({ preventScroll: true }); } }, [selected, id]);
  const action = useAction(); const wallet = useNativeWallet(TEST_TRADE_CHAIN); const guard = useRef(false);
  useEffect(() => { let active = true; setConfigError(''); if (wallet.address) accountApi<{ configured: boolean; escrow?: string; creation?: string; utrVerifier?: Address }>('/p2p-details/simple-config', {}).then(v => { if (active) setSimpleConfig(v); }).catch(e => { if (active) setConfigError(e.message); }); return () => { active = false; }; }, [wallet.address]);
  useEffect(() => { onBusyChange?.(action.busy || !!pending); }, [action.busy, pending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => {
    let active = true; setSelected(undefined); setUpi(''); setQr(undefined); setUtr(''); setSavedUpi(undefined);
    setProfileLoading(!!wallet.address);
    if (wallet.address) accountApi<{ upiId: string; qr: string }>('/p2p-details/profile-read', {}).then(v => { if (active) { setUpi(v.upiId); setQr(v.qr); setSavedUpi(v); } }).catch(() => {}).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [wallet.address]);
  async function run(fn: () => Promise<void>) { if (guard.current) return; guard.current = true; try { await action.run(fn); } finally { guard.current = false; } }
  function link(address: string, hash: string, tradeId?: string) { setParams(new URLSearchParams({ sellerEscrow: address, sellerCreation: hash, ...(tradeId ? { sellerTrade: tradeId } : {}) })); }
  async function verified(address = escrow, hash = creation) {
    if (!isAddress(address) || !/^0x[\da-f]{64}$/i.test(hash)) throw new Error('Open a complete seller-confirmed trade link.');
    const client = nativeClient(TEST_TRADE_CHAIN); const addr = getAddress(address);
    const [legacy, previous, direct, code] = await Promise.all([artifact(), artifact(true, true), artifact(true), client.getCode({ address: addr })]);
    const utr = code?.toLowerCase() === direct.deployedBytecode.toLowerCase();
    const simple = utr || code?.toLowerCase() === previous.deployedBytecode.toLowerCase();
    const a = utr ? direct : simple ? previous : legacy;
    if (code?.toLowerCase() !== a.deployedBytecode.toLowerCase()) throw new Error('Unrecognized P2P escrow code.');
    await verifyCreation(TEST_TRADE_CHAIN, addr, hash, a.bytecode);
    return { a, client, address: addr, simple, utr };
  }
  async function readTrade() {
    if (!/^[1-9]\d{0,76}$/.test(id) || BigInt(id) >= 2n ** 256n) throw new Error('Invalid trade number.');
    const v = await verified();
    const t = normalizeSellerTrade(await v.client.readContract({ address: v.address, abi: v.a.abi, functionName: 'trades', args: [BigInt(id)] }), v.simple);
    if (!t[5]) throw new Error('Trade not found.'); return { key: tradeScope, t, simple: v.simple, utr: v.utr };
  }
  async function refresh() { const value = await readTrade(); setTradeSnapshot(value); setDetailsRefresh(n => n + 1); }
  async function openOffer(o: BuyOffer) {
    const v = await verified(o.escrow, o.creation);
    if (!o.tradeId || !/^[1-9]\d{0,76}$/.test(o.tradeId) || BigInt(o.tradeId) >= 2n ** 256n) throw new Error('Invalid trade reference.');
    const t = normalizeSellerTrade(await v.client.readContract({ address: v.address, abi: v.a.abi, functionName: 'trades', args: [BigInt(o.tradeId)] }), v.simple);
    if (!matchesOffer(o, t)) throw new Error('This offer link does not match the on-chain buyer, seller or amounts. Do not pay. Open the correct trade link from your counterparty.');
    setSelected(undefined); link(o.escrow!, o.creation!, o.tradeId);
  }
  useEffect(() => {
    let active = true; // Keep the last verified snapshot during background refreshes.
    const load = () => { if (id && !guard.current && !pending) readTrade().then(value => { if (active) { setTradeSnapshot(value); setDetailsRefresh(n => n + 1); } }).catch(e => { if (active) action.setError(e.message); }); };
    load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [escrow, creation, id, pending]);
  async function confirmed(p: Pending) {
    const client = nativeClient(TEST_TRADE_CHAIN); const receipt = await client.waitForTransactionReceipt({ hash: p.hash, confirmations: 2 });
    if (receipt.status !== 'success') { localStorage.removeItem(storage); setPending(null); throw new Error('Transaction reverted.'); }
    if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('Transaction confirmation changed; check again.');
    if (p.kind === 'deploySimple') {
      if (!receipt.contractAddress) throw new Error('Deployment did not return a contract address.');
      const v = await verified(receipt.contractAddress, p.hash); if (!v.utr) throw new Error('Wrong escrow version.');
      const config = await accountApi<{ configured: boolean; escrow: string; creation: string }>('/p2p-details/simple-register', { escrow: receipt.contractAddress, creation: p.hash });
      setSimpleConfig(config); setParams(new URLSearchParams()); action.setNotice('Shared mutual UPI transaction ID escrow activated. No separate buyer acceptance or arbitrator is needed.');
    } else if (p.kind === 'deploy') {
      if (!receipt.contractAddress) throw new Error('No contract address in receipt.');
      await verified(receipt.contractAddress, p.hash); link(receipt.contractAddress, p.hash);
    } else if (p.kind === 'offer') {
      if (!p.escrow || !p.creation) throw new Error('Missing pending escrow reference.');
      const { a } = await verified(p.escrow, p.creation); let tradeId: string | undefined;
      for (const log of receipt.logs) if (log.address.toLowerCase() === p.escrow?.toLowerCase()) {
        try { const event = decodeEventLog({ abi: a.abi, data: log.data, topics: log.topics }) as any; if (event.eventName === 'Offered') tradeId = String(event.args.id); } catch { /* Ignore other events. */ }
      }
      if (!tradeId || !p.escrow || !p.creation) throw new Error('Could not recover the trade link from the receipt.');
      if (p.bid) await accountApi('/p2p-details/offers-link', { id: p.bid, escrow: p.escrow, creation: p.creation, tradeId });
      let attached = false;
      if (p.bid) {
        const ref = { escrow: p.escrow, creation: p.creation, tradeId };
        try {
          const ready = await accountApi<{ ready: boolean }>('/p2p-details/read', { ...ref, statusOnly: true });
          if (!ready.ready) await accountApi('/p2p-details/save', { ...ref, useProfile: true });
          attached = true;
        } catch { /* Funding is confirmed: allow profile setup and manual attachment without funding again. */ }
      }
      setSelected(undefined); link(p.escrow, p.creation, tradeId);
      action.setNotice(attached ? 'Tokens locked. Your saved UPI details are attached privately to this trade. Share its link with your buyer.' : 'Tokens are locked. Save your UPI profile and use it for this trade below. Do not fund again.');
    } else { await refresh(); action.setNotice('Testnet transaction confirmed.'); }
    localStorage.removeItem(storage); setPending(null);
  }
  async function send(kind: string, submit: () => Promise<Hex>, address: Address) {
    if (((kind === 'offer' || kind === 'deploySimple' || !simpleMode) && !checked) || pending) throw new Error('Acknowledge the terms and resolve any pending transaction first.');
    const hash = await submit(); const p: Pending = { hash, kind, escrow: address, creation, ...(kind === 'offer' && selected ? { bid: selected.id } : {}) };
    localStorage.setItem(storage, JSON.stringify(p)); setPending(p); await confirmed(p);
  }
  async function deploySimple() {
    if (simpleConfig?.configured) throw new Error('A shared escrow is already configured. Refresh P2P.');
    const a = await artifact(true); const w = await wallet.wallet();
    const gas = await nativeClient(TEST_TRADE_CHAIN).estimateGas({ account: w.account.address, data: a.bytecode });
    await send('deploySimple', () => w.deployContract({ abi: a.abi, bytecode: a.bytecode, gas: gas * 12n / 10n }), '0x0000000000000000000000000000000000000000');
  }
  async function offer() {
    if (!selected || selected.seller?.toLowerCase() !== wallet.address?.toLowerCase()) throw new Error('Select a buyer request first.');
    if (!savedUpi || upi.trim() !== savedUpi.upiId || qr !== savedUpi.qr) throw new Error('Save your UPI profile before funding.');
    const claimed = await accountApi<BuyOffer>('/p2p-details/offers-select', { id: selected.id });
    if (claimed.buyer !== selected.buyer || claimed.amount !== selected.amount || claimed.paise !== selected.paise) throw new Error('Request terms changed. Reload offers.');
    if (!simpleConfig?.utrVerifier || !isAddress(simpleConfig.utrVerifier)) throw new Error('The relay UPI transaction ID verifier is not configured.');
    const w = await wallet.wallet(); const v = await verified();
    if (!v.utr) throw new Error('New offers must use the shared mutual UPI transaction ID escrow.');
    await send('offer', () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: 'offer', args: [getAddress(claimed.buyer), BigInt(claimed.paise), simpleConfig!.utrVerifier!], value: parseEther(claimed.amount) }), v.address);
  }
  async function chain(kind: string) {
    if (kind === 'accept') { const status = await accountApi<{ ready: boolean }>('/p2p-details/read', { escrow, creation, tradeId: id, statusOnly: true }); if (!status.ready) throw new Error('Wait for the seller to save private UPI details.'); }
    if (kind === 'refund' && simpleMode && [2, 3, 4].includes(state) && !window.confirm('Return all tokens to the seller? This does not refund any INR you sent. Only continue if you agree to give up the tokens.')) return;
    if (kind === 'reportPaid' && !window.confirm('Have you actually sent the agreed INR? GhostChat cannot verify this payment.')) return;
    if (kind === 'release' && !window.confirm('Have you checked your own bank or UPI app and confirmed receipt? This releases the tokens.')) return;
    const w = await wallet.wallet(); const v = await verified(); await send(kind, () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: kind, args: [BigInt(id)] }), v.address);
  }
  async function confirmUTR(commitment: Hex, signature: Hex) {
    await run(async () => { const w = await wallet.wallet(); const v = await verified();
      if (!v.utr) throw new Error('This is an older trade.');
      await send('confirmUTR', () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: 'confirmUTR', args: [BigInt(id), commitment, signature] }), v.address);
    });
  }
  async function cancelMutual(revoke = false) {
    if (!revoke && !window.confirm('Approve returning tokens to the seller? Both parties must approve. This does not refund INR. Only agree if no payment was made or you have separately settled the INR.')) return;
    const w = await wallet.wallet(); const v = await verified(); const kind = revoke ? 'revokeCancellation' : 'approveCancellation';
    await send(kind, () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: kind, args: [BigInt(id)] }), v.address);
  }
  async function resolve(toBuyer: boolean) {
    if (!window.confirm(`Resolve by sending all tokens to the ${toBuyer ? 'buyer' : 'seller'}? This cannot be undone.`)) return;
    const w = await wallet.wallet(); const v = await verified(); await send('resolve', () => w.writeContract({ address: v.address, abi: v.a.abi, functionName: 'resolve', args: [BigInt(id), toBuyer] }), v.address);
  }
  const state = trade?.[5] || 0; const seller = trade?.[0].toLowerCase() === wallet.address?.toLowerCase(); const isBuyer = trade?.[1].toLowerCase() === wallet.address?.toLowerCase(); const isArbitrator = trade?.[2].toLowerCase() === wallet.address?.toLowerCase();
  const role = seller ? 'seller' : isBuyer ? 'buyer' : isArbitrator ? 'arbitrator' : 'visitor';
  const tradeKey = `${escrow}:${id}`;
  const paymentScope = `${tradeScope}:${wallet.address?.toLowerCase() || ''}`;
  const privateSnapshot = paymentForScope(paymentSnapshot, paymentScope);
  const canReadPayment = !!wallet.address && !!id && (seller || (isBuyer && ([2, 3, 4].includes(state) || (utrMode && state === 1))));
  const visibleDetails = canReadPayment ? privateSnapshot?.details : undefined;
  const paymentReady = !!privateSnapshot?.ready;
  const detailsError = privateSnapshot?.error || '';
  useEffect(() => {
    let active = true;
    const scope = paymentScope;
    async function loadPayment() {
      if (!wallet.address || !id || (!seller && !isBuyer)) return;
      const cached = paymentForScope(paymentSnapshotRef.current, scope);
      // Trade payment snapshots are immutable. Background polling must not reload their image.
      if (cached?.ready && (!canReadPayment || cached.details)) return;
      try {
        const status = await accountApi<{ ready: boolean }>('/p2p-details/read', { escrow, creation, tradeId: id, statusOnly: true });
        if (!active) return;
        if (!status.ready) { setPaymentSnapshot(p => mergePaymentSnapshot(p, scope, { ready: false, details: undefined, error: 'The seller has not attached payment details yet.' })); return; }
        if (canReadPayment) {
          const value = await accountApi<{ upiId: string; qr: string }>('/p2p-details/read', { escrow, creation, tradeId: id });
          if (active) setPaymentSnapshot(p => mergePaymentSnapshot(p, scope, { ready: true, details: value, error: '' }));
        } else if (active) setPaymentSnapshot(p => mergePaymentSnapshot(p, scope, { ready: true, error: '' }));
      } catch (e) {
        if (active) setPaymentSnapshot(p => mergePaymentSnapshot(p, scope, { error: (e as Error).message || 'Could not refresh payment details.' }));
      }
    }
    void loadPayment();
    return () => { active = false; };
  }, [escrow, creation, id, wallet.address, state, seller, isBuyer, detailsRefresh, utrMode, paymentScope, canReadPayment]);
  async function saveProfile() {
    if (!qr) throw new Error('Choose a UPI QR image.');
    await accountApi('/p2p-details/profile-save', { upiId: upi, qr });
    setSavedUpi({ upiId: upi.trim(), qr }); action.setNotice('UPI profile saved privately. It will be reused for future trades.');
  }
  async function saveDetails() {
    if (!qr) throw new Error('Choose a UPI QR image.');
    await accountApi('/p2p-details/save', { escrow, creation, tradeId: id, useProfile: true });
    const value = await accountApi<{ upiId: string; qr: string }>('/p2p-details/read', { escrow, creation, tradeId: id });
    setPaymentSnapshot(p => mergePaymentSnapshot(p, paymentScope, { ready: true, details: value, error: '' })); action.setNotice('Private payment details saved.');
  }
  const disabled = action.busy || !!pending || (!simpleMode && !checked);
  const profileReady = !!savedUpi && upi.trim() === savedUpi.upiId && qr === savedUpi.qr;
  const fundingBlocker = pending ? 'A transaction is pending. Check it below before funding again.' : !simpleConfig?.configured ? 'Activate the shared simplified escrow before funding.' : profileLoading ? 'Loading your saved UPI profile…' : !profileReady ? 'Save your UPI profile before funding.' : !checked ? 'Confirm the trade acknowledgement below to enable funding.' : '';

  return <section className="gp-trade-lab panel">
    {!id && <div className="gp-trade-lab-title"><span className="gp-trade-tag">Experimental · MST Testnet</span><h2>Choose a rate. Agree a trade.</h2><p>Buyers post a token amount and desired INR rate. Sellers browse requests and fund the terms they accept. The buyer sees your UPI details immediately after locking. Both people independently enter the UPI transaction ID and confirm in their wallets. Matching confirmations release the tokens.</p><p>UPI transfers use real INR; tMSTC is a test asset with no real value. This is experimental and unaudited. GhostChat does not verify bank payments.</p></div>}
    {(!id || !simpleMode) && <label className="gp-trade-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>I understand INR is real, tMSTC is a test asset, and matching references are mutual confirmation, not bank verification. Without agreement in a dispute, tokens may stay locked.</span></label>}
    {!id && !simpleConfig?.configured && <div className="gp-trade-offer"><h3>One-time shared escrow activation</h3><p>The mutual UPI transaction ID flow needs its own contract. Existing funded trades keep their original rules.</p>{configError && <p role="alert">{configError} — update the EC2 relay, then refresh.</p>}{params.get('setup') === 'simple' ? <button className="button primary" disabled={action.busy || !!pending || !checked || !simpleConfig} onClick={() => run(deploySimple)}>Deploy mutual UPI transaction ID escrow on MST Testnet</button> : <button className="button secondary" onClick={() => setParams(new URLSearchParams({ setup: 'simple' }))}>Open one-time setup</button>}<p>Deployment spends testnet gas only, without depositing trading funds. Once configured, everyone reuses the contract.</p></div>}
    {trade && !simpleMode && <p className="gp-trade-offer">This is an existing arbitrated trade. Its contract cannot be changed. If it is still awaiting acceptance, the seller can cancel it and refund the tokens, then arrange a new seller-confirmed trade.</p>}
    {trade && <div className="gp-trade-live"><h3>Trade #{id} · {(utrMode ? ({ 1: 'Tokens locked — buyer can pay', 3: 'Waiting for matching wallet confirmations', 4: 'References differ — recheck UPI transaction ID', 5: 'Tokens released', 6: 'Tokens returned' } as Record<number, string>)[state] : state === 1 ? trade[6] ? 'Waiting for buyer acceptance' : 'Waiting for arbitrator acceptance' : ['Not found', '', 'Ready for UPI payment', 'Waiting for seller confirmation', 'Disputed', 'Tokens released', 'Tokens returned'][state])}</h3><div className="gp-trade-offer" role="status"><strong>You are the {role === 'visitor' ? 'viewer' : role}</strong><p className="gp-trade-wallet-identity">Connected wallet: {wallet.address || 'not connected'}</p><p><strong>Buyer pays seller ₹{inrTotal(String(trade[4]))} via UPI.</strong> Seller supplies {formatEther(trade[3])} tMSTC; escrow releases them to the buyer after confirmation.</p><p>{nextTradeStep(state, role, trade[6], paymentReady, simpleMode, utrMode)}</p><p>{formatEther(trade[3])} tMSTC · ₹{inrTotal(String(trade[4]))} total · MST Testnet</p></div>{![4, 6].includes(state) && <ol className="gp-trade-progress" aria-label="Trade progress">{(utrMode ? ['Tokens locked', 'Buyer pays using UPI', 'Both confirm their UPI transaction ID', 'Matching confirmations release tokens'] : simpleMode ? ['Tokens locked', 'Buyer accepts & sees UPI', 'Buyer reports payment', 'Seller releases tokens'] : ['Tokens locked', 'Arbitrator accepts', 'Buyer accepts', 'Buyer reports payment', 'Seller releases tokens']).map((step, i) => { const stage = utrMode ? state === 1 ? 1 : state === 3 ? 2 : 3 : simpleMode ? state === 1 ? 1 : state === 2 ? 2 : 3 : state === 1 ? trade[6] ? 2 : 1 : state === 2 ? 3 : 4; return <li key={step} aria-current={i === stage && state !== 5 ? 'step' : undefined}>{step}{i < stage || state === 5 ? ' ✓' : ''}</li>; })}</ol>}<details><summary>Trade wallets and amounts</summary><dl className="gp-trade-breakdown"><div><dt>Seller</dt><dd>{trade[0]}</dd></div><div><dt>Buyer</dt><dd>{trade[1]}</dd></div>{!simpleMode && <div><dt>Arbitrator</dt><dd>{trade[2]} · {trade[6] ? 'accepted' : 'awaiting acceptance'}</dd></div>}<div><dt>Test tokens</dt><dd>{formatEther(trade[3])} tMSTC</dd></div><div><dt>Real INR</dt><dd>₹{inrTotal(String(trade[4]))}</dd></div></dl></details>
      {visibleDetails && <TradePaymentDetails role={role} details={visibleDetails} amount={inrTotal(String(trade[4]))} canPay={isBuyer && (state === 2 || (utrMode && state === 1))} onCopy={() => run(async () => { await navigator.clipboard.writeText(visibleDetails.upiId); action.setNotice('Seller UPI ID copied.'); })}/>}
      {isBuyer && ([2, 3, 4].includes(state) || (utrMode && state === 1)) && !visibleDetails && <p>{detailsError || 'Loading private payment details…'}</p>}
      {!utrMode && isBuyer && state === 2 && <div className="gp-trade-offer"><label>UPI transaction ID (local only)<input value={utr} onChange={e => setUtr(e.target.value)} maxLength={100}/></label><p>Send the reference privately to the seller. GhostChat does not verify it.</p><button className="button primary" disabled={disabled || !utr.trim() || !visibleDetails} onClick={() => run(() => chain('reportPaid'))}>I sent the UPI payment</button></div>}
      {seller && state === 3 && <p>Check your own bank or UPI app before confirming receipt.</p>}
      {utrMode && (seller || isBuyer) && [1, 3, 4].includes(state) && <UTRPanel key={`${tradeKey}:${wallet.address}`} escrow={escrow} creation={creation} tradeId={id} seller={seller} busy={action.busy || !!pending} refresh={detailsRefresh} onConfirm={confirmUTR}/>}
      {utrMode && (seller || isBuyer) && [1, 3, 4].includes(state) && <details><summary>Cancel this trade by mutual agreement</summary><p>Tokens are returned only after both buyer and seller approve. Cancellation does not return INR.</p><button className="button secondary" disabled={disabled} onClick={() => run(() => cancelMutual())}>Approve cancellation</button><button className="button secondary" disabled={disabled} onClick={() => run(() => cancelMutual(true))}>Revoke my cancellation approval</button></details>}
      {!utrMode && <div className="gp-trade-actions">
        {!simpleMode && state === 1 && isArbitrator && !trade[6] && <button className="button primary" disabled={disabled} onClick={() => run(() => chain('acceptArbitration'))}>Accept arbitrator role</button>}
        {state === 1 && isBuyer && <button className="button primary" disabled={disabled || !trade[6] || !paymentReady} onClick={() => run(() => chain('accept'))}>{simpleMode ? 'Accept & view seller UPI' : 'Accept terms and arbitrator'}</button>}
        {(state === 3 || (simpleMode && state === 4)) && seller && <button className="button primary" disabled={disabled} onClick={() => run(() => chain('release'))}>Confirm receipt & release tMSTC</button>}
        {[2, 3].includes(state) && (seller || isBuyer) && <button className="button secondary" disabled={disabled} onClick={() => run(() => chain('dispute'))}>Raise dispute</button>}
        {((state === 1 && seller) || (isBuyer && (state === 2 || (simpleMode && [3, 4].includes(state))))) && <button className="button secondary" disabled={disabled} onClick={() => run(() => chain('refund'))}>{state === 1 ? 'Cancel trade' : 'Return allocation to seller'}</button>}
        {!simpleMode && state === 4 && isArbitrator && <><button className="button secondary" disabled={disabled} onClick={() => run(() => resolve(true))}>Resolve: release to buyer</button><button className="button secondary" disabled={disabled} onClick={() => run(() => resolve(false))}>Resolve: return to seller</button></>}
      </div>}{!utrMode && state === 4 && <p>{simpleMode ? 'No automatic bank verification or third-party decision exists. Tokens remain locked until the seller releases them or the buyer agrees to return them. Returning tokens does not refund INR.' : 'Only the agreed arbitrator can resolve this dispute. If unavailable, tokens remain locked.'}</p>}
    </div>}
    {(!id || (seller && state === 1 && !visibleDetails)) && <div className="gp-trade-offer" id="private-upi-profile"><h3>Your private UPI ID & QR</h3><p>Save once and reuse for future trades. Updating your profile does not change payment details already attached to a trade.</p><label>Private UPI ID<input value={upi} onChange={e => setUpi(e.target.value)} placeholder="name@bank" maxLength={195}/></label><label>Private UPI QR image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; setQr(undefined); if (!file) return; if (file.size > 1000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { action.setError('Choose a supported QR image under 1 MB.'); return; } const reader = new FileReader(); reader.onload = () => setQr(String(reader.result)); reader.readAsDataURL(file); }}/></label>{qr && <img src={qr} alt="Private QR preview" style={{ maxWidth: 180 }}/>}<p>Only the seller and accepted buyer can retrieve saved details. They never appear in the market or chat.</p>{profileLoading && <p role="status">Loading saved UPI profile…</p>}{savedUpi && <p>Saved privately to your wallet account. Future funded trades reuse this profile automatically.</p>}<button className="button primary" disabled={action.busy || !!pending || profileLoading || !qr || !upi.trim()} onClick={() => run(saveProfile)}>{savedUpi ? 'Update saved UPI profile' : 'Save UPI profile'}</button>{id && <button className="button secondary" disabled={disabled || !savedUpi || upi.trim() !== savedUpi.upiId || qr !== savedUpi.qr} onClick={() => run(saveDetails)}>Use saved profile for this trade</button>}</div>}
    {!id && !selected && <OfferBoard wallet={wallet.address} disabled={action.busy || !!pending} onSelect={o => { setSelected({ ...o }); link(escrow, creation); }} onOpen={openOffer}/>}
    {id && <div className="gp-trade-actions"><button className="button secondary" disabled={action.busy || !!pending} onClick={() => { setSelected(undefined); link(escrow, creation); }}>Back to offers</button><button className="button secondary" disabled={action.busy} onClick={() => run(refresh)}>Refresh trade</button><button className="button secondary" onClick={() => run(async () => { await navigator.clipboard.writeText(`${location.origin}/trade?${params}`); action.setNotice('Trade link copied.'); })}>Copy trade link</button></div>}
    {!id && selected && <div className="gp-trade-offer" ref={fundingForm} tabIndex={-1} style={{ scrollMarginTop: 24 }}>
      <button className="button secondary" disabled={action.busy || !!pending} onClick={() => setSelected(undefined)}>Back to offers</button><h3>Fund selected buy request</h3><p role="status">Request selected. Complete this form, then click Lock tMSTC to open BridgeKey for approval.</p>
      <p>{selected.amount} tMSTC at ₹{selected.rate} per token · ₹{inrTotal(selected.paise)} total.</p><p>The buyer and amounts come from the selected request and cannot be changed.</p>
      <p>The contract holds tokens. Your assigned buyer sees your saved UPI ID and QR immediately. Both of you submit your own UPI transaction ID independently and confirm in BridgeKey. If both confirmed references match, the contract releases tokens to the buyer.</p>
      <label className="gp-trade-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>I understand INR is real, tMSTC has no real value, and a matching UPI transaction ID is not proof of a bank credit.</span></label>
      {fundingBlocker && <p role="status">{fundingBlocker}</p>}
      {!profileReady && !profileLoading && <button className="button secondary" onClick={() => document.getElementById('private-upi-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Go to UPI profile</button>}
      <button className="button primary" disabled={disabled || !checked || !profileReady || !simpleConfig?.configured || profileLoading} onClick={() => run(offer)}>{action.busy ? 'Waiting for wallet or confirmation…' : 'Lock tMSTC for this request'}</button>
    </div>}
    {id && !trade && <p>Loading the verified trade…</p>}
    {!utrMode && isBuyer && state === 1 && !paymentReady && <p>Wait for the seller to save payment details before accepting.</p>}
    {pending && <button className="button secondary" disabled={action.busy} onClick={() => run(() => confirmed(pending))}>Check pending transaction</button>}
    {action.busy && <p role="status">Waiting for wallet or confirmations…</p>}{action.error && <p role="alert" className="gp-trade-error">{action.error}</p>}{action.notice && <p role="status" className="gp-trade-success">{action.notice}</p>}
  </section>;
}
