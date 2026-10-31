import { parsePayment, type ChatMessage, type PaymentReference } from '../messenger/model';
export function paymentKey(ref: PaymentReference): string {
  return ref.version === 3 ? `direct:${ref.chainId}:${ref.hash.toLowerCase()}` : ref.version === 4 ? `campaign:${ref.chainId}:${ref.contract.toLowerCase()}:${ref.campaignId}` : `escrow:${ref.version}:${ref.chainId}:${ref.contract.toLowerCase()}:${ref.paymentId}`;
}
export function paymentRecords(messages: ChatMessage[], saved: PaymentReference[], wallet?: string) {
  const entries = new Map<string, { reference: PaymentReference; timestamp: number; label: string }>();
  for (const message of [...messages].sort((a,b) => b.timestamp-a.timestamp)) {
    const reference = parsePayment(message.payment); if (!reference) continue;
    if (reference.version === 3 && wallet && ![reference.from, reference.to].some(value => value.toLowerCase() === wallet.toLowerCase())) continue;
    const key = paymentKey(reference);
    if (!entries.has(key)) entries.set(key, { reference, timestamp: message.timestamp, label: message.own ? 'Shared by you' : `Shared by ${message.senderName}` });
  }
  for (const value of saved) {
    const reference = parsePayment(value); if (!reference) continue;
    if (reference.version === 3 && (!wallet || ![reference.from, reference.to].some(value => value.toLowerCase() === wallet.toLowerCase()))) continue;
    const key = paymentKey(reference);
    if (!entries.has(key)) entries.set(key, { reference, timestamp: 0, label: 'Saved on this device' });
  }
  return [...entries.values()];
}
