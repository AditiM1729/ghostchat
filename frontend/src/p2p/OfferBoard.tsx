import { useEffect, useState } from 'react';
import { accountApi } from '../wallet/accountApi';
import { useNavigate } from 'react-router-dom';

export type BuyOffer = { id: string; buyer: string; seller?: string; amount: string; rate: string; paise: string; status: string; escrow?: string; creation?: string; tradeId?: string };
export const inrTotal = (paise: string) => `${BigInt(paise) / 100n}.${String(BigInt(paise) % 100n).padStart(2, '0')}`;
export default function OfferBoard({ wallet, disabled, onSelect, onOpen }: { wallet?: string; disabled: boolean; onSelect(offer: BuyOffer): void; onOpen(offer: BuyOffer): void | Promise<void> }) {
  const [tab, setTab] = useState('Market');
  const [offers, setOffers] = useState<BuyOffer[]>([]);
  const [amount, setAmount] = useState('0.1'); const [rate, setRate] = useState('100');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const owner = wallet?.toLowerCase();
  const navigate = useNavigate();
  async function contact(address: string) {
    const response = await fetch(`/api/profiles/address/${address}`, { cache: 'no-store' });
    const profile = response.ok ? await response.json() : null;
    if (!profile?.username) throw new Error('This wallet has no registered GhostChat username yet.');
    navigate(`/chat?contact=${encodeURIComponent(profile.username)}`);
  }
  async function load() { const value = await accountApi<{ offers: BuyOffer[] }>('/p2p-details/offers-list', {}); setOffers(value.offers); }
  useEffect(() => { let active = true; setOffers([]); setError(''); if (wallet) accountApi<{ offers: BuyOffer[] }>('/p2p-details/offers-list', {}).then(v => { if (active) setOffers(v.offers); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [wallet]);
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update offers.'); } finally { setBusy(false); } }
  const locked = disabled || busy || !wallet;
  const visible = offers.filter(o => tab === 'Market' ? o.status === 'open' : tab === 'My buy offers' ? o.buyer === owner : o.seller === owner);
  return <div className="gp-trade-offer">
    <h3>Offer board</h3><p>Buyers choose their INR rate. Sellers select a request and fund its fixed terms. UPI details are never listed here.</p>
    <div className="gp-trade-actions" role="tablist" aria-label="P2P offers">{['Market', 'My buy offers', 'My sell trades'].map(t => <button key={t} role="tab" aria-selected={tab === t} className={`button ${tab === t ? 'primary' : 'secondary'}`} onClick={() => setTab(t)}>{t}</button>)}<button className="button secondary" disabled={locked} onClick={() => run(load)}>Refresh offers</button></div>
    {tab === 'My buy offers' && <form onSubmit={e => { e.preventDefault(); void run(async () => { await accountApi('/p2p-details/offers-create', { amount, rate }); }); }}>
      <h4>Post a buy request</h4><label>Tokens to buy (tMSTC)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required/></label><label>Your desired rate (INR per tMSTC)<input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} required/></label><p>The final INR total is rounded up to the nearest paise. Maximum 10 tMSTC per request.</p><button className="button primary" disabled={locked}>Post buy request</button>
    </form>}
    {!visible.length && <p>No offers in this section yet.</p>}
    {visible.map(o => <article className="gp-trade-offer" key={o.id}><h4>{o.amount} tMSTC · ₹{o.rate} per token</h4><p>Total: ₹{inrTotal(o.paise)} · {o.status === 'selected' ? 'Seller selected — awaiting funding' : o.status === 'funded' ? 'Trade funded — open for current status' : o.status}</p><p style={{ overflowWrap: 'anywhere' }}>Buyer: {o.buyer}{o.seller && <><br/>Seller: {o.seller}</>}</p>
      {o.buyer !== owner && <button className="button secondary" disabled={locked} onClick={() => run(() => contact(o.buyer))}>Message buyer</button>}
      {o.buyer === owner && o.seller && <button className="button secondary" disabled={locked} onClick={() => run(() => contact(o.seller!))}>Message seller</button>}
      {o.status === 'open' && o.buyer !== owner && <button className="button primary" disabled={locked} onClick={() => run(async () => { const selected = await accountApi<BuyOffer>('/p2p-details/offers-select', { id: o.id }); setTab('My sell trades'); onSelect(selected); })}>Sell to this buyer</button>}
      {o.status === 'open' && o.buyer === owner && <button className="button secondary" disabled={locked} onClick={() => run(async () => { await accountApi('/p2p-details/offers-cancel', { id: o.id }); })}>Withdraw request</button>}
      {o.status === 'selected' && o.seller === owner && <button className="button primary" disabled={locked} onClick={() => onSelect(o)}>Continue funding</button>}
      {o.tradeId && <button className="button primary" disabled={locked} onClick={() => run(async () => { await onOpen(o); })}>{o.buyer === owner ? 'View trade & payment steps' : 'Manage trade'}</button>}
    </article>)}
    {error && <p className="gp-trade-error" role="alert">{error}</p>}
  </div>;
}
