import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wallet } from 'lucide-react';
import { useMessenger } from '../messenger/MessengerContext';
import { PaymentCard } from '../messenger/Payments';
import { directHistory } from './DirectPayment';
import { nativeHistory } from './native';
import { campaignHistory } from './community';
import { paymentRecords, paymentKey } from './paymentRecords';

export function PaymentActivity({ compact = false }: { compact?: boolean }) {
  const chat = useMessenger(); const { address } = useAccount(); const cache = useQueryClient();
  const messages = Object.values(chat.messages).flat();
  const records = paymentRecords(messages, [...directHistory(), ...nativeHistory(), ...campaignHistory()], address);
  return <section className={`ms-payment-activity${compact ? ' is-compact' : ''}`} aria-label="Payment transactions">
    <header><div><h2>{compact ? 'Payments' : 'Your payment activity'}</h2><p>Saved transactions and receipts shared in your chats. Amounts and status are checked on-chain.</p></div><button className="ms-icon" aria-label="Refresh payment status" onClick={() => { void cache.invalidateQueries({ predicate: query => ['direct-receipt', 'native-payment', 'campaign'].some(key => String(query.queryKey[0]).includes(key)) }); }}><RefreshCw size={17}/></button></header>
    {!records.length ? <div className="ms-list-empty"><Wallet size={27}/><strong>No payment records yet.</strong><p>Send a payment or open a shared receipt. Transfers outside GhostChat may not appear here.</p></div> : <div className="ms-payment-records">{records.map(item => <article key={paymentKey(item.reference)}><small>{item.label}{item.timestamp ? ` · ${new Date(item.timestamp).toLocaleDateString()}` : ''}</small><PaymentCard payment={item.reference} onOpen={id => { window.location.assign(`/pay/${id}`); }} onCreate={() => { window.location.assign('/create'); }}/></article>)}</div>}
  </section>;
}
