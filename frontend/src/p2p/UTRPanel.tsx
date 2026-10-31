import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { accountApi } from '../wallet/accountApi';
type Status = { ownConfirmed?: boolean; otherConfirmed?: boolean; ownSubmitted: boolean; otherSubmitted: boolean; referencesMatch: boolean | null; commitment?: Hex; signature?: Hex; bankVerified: false };
export default function UTRPanel({ escrow, creation, tradeId, seller, busy, refresh, onConfirm }: { escrow: string; creation: string; tradeId: string; seller: boolean; busy: boolean; refresh: number; onConfirm(commitment: Hex, signature: Hex): Promise<void> }) {
  const [reference, setReference] = useState(''); const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<Status>(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const ref = { escrow, creation, tradeId };
  useEffect(() => { let active = true; accountApi<Status>('/p2p-details/utr', ref).then(v => { if (active) setStatus(v); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [escrow, creation, tradeId, refresh]);
  async function submit() {
    if (!checked || loading) return;
    setLoading(true); setError('');
    try {
      const value = await accountApi<Status>('/p2p-details/utr', { ...ref, ...(reference.trim() ? { utr: reference, paymentReceived: seller, paymentSent: !seller } : {}) });
      setStatus(value);
      if (!value.commitment || !value.signature) throw new Error('Enter your UPI transaction ID first.');
      await onConfirm(value.commitment, value.signature);
      setReference('');
      const latest = await accountApi<Status>('/p2p-details/utr', ref); setStatus(latest);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm reference.'); }
    finally { setLoading(false); }
  }
  return <div className="gp-trade-offer"><h3>{seller ? 'Confirm received payment' : 'Confirm your UPI payment'}</h3>
    <p>{seller ? 'Check the actual credit in your own bank or UPI app, then enter its reference independently.' : 'After paying the seller, copy the transaction reference from your UPI app.'}</p>
    <label>{seller ? 'UPI transaction ID — received payment' : 'UPI transaction ID — sent payment'}<input value={reference} onChange={e => setReference(e.target.value)} autoComplete="off" maxLength={48} placeholder={status?.ownSubmitted ? 'Saved privately — enter a correction if needed' : 'Enter your transaction reference'}/></label>
    <p>Use the shared bank reference shown in both payment records, not an app-only order or receipt ID. Different references cannot be matched automatically.</p>
    <label className="gp-trade-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/><span>{seller ? 'I checked my bank app and received the exact INR amount for this trade.' : 'I sent the exact INR amount to this seller’s UPI account.'}</span></label>
    {status && <p role="status">{status.referencesMatch === false ? 'The references differ. Recheck and correct your own entry; tokens remain locked.' : status.referencesMatch === true ? 'Both submitted references match. Both wallet confirmations must also be completed before the contract releases tokens.' : status.ownSubmitted ? 'Your reference is saved. Waiting for the other person’s independent entry.' : status.otherSubmitted ? 'The other person has submitted their reference. Enter yours independently.' : 'Waiting for both people to submit their references.'}</p>}
    {status?.ownConfirmed && <p role="status">Your wallet confirmation is recorded.{status.otherConfirmed ? ' The other wallet has also confirmed; refresh the trade for the outcome.' : ' Waiting for the other wallet to confirm.'}</p>}
    <p>Raw UPI transaction IDs are not shared with the other person or put on-chain. The relay processes each entry privately. Matching references are mutual confirmation, not bank verification or a zero-knowledge proof.</p>
    <button className="button primary" disabled={busy || loading || !checked || (!reference.trim() && (!status?.ownSubmitted || status?.ownConfirmed))} onClick={submit}>{loading ? 'Preparing confirmation…' : seller ? 'Confirm receipt & UPI transaction ID in BridgeKey' : 'Confirm payment & UPI transaction ID in BridgeKey'}</button>
    {error && <p role="alert" className="gp-trade-error">{error}</p>}
  </div>;
}
