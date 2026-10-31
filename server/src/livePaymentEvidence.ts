/** Normalized evidence supplied only by an authenticated, approved provider adapter.
 * This module does not authenticate a provider or authorize token release. */
export interface LiveTradeTerms {
  tradeId: string; provider: string; beneficiaryAccountId: string; orderId: string;
  amountPaise: number; acceptedAt: number; payUntil: number;
}
export interface LivePaymentEvidence {
  provider: string; beneficiaryAccountId: string; orderId: string; paymentId: string;
  amountPaise: number; currency: string; status: string; creditedAt: number;
}
export function validateLivePaymentEvidence(trade: LiveTradeTerms, evidence: LivePaymentEvidence, now: number) {
  if (!trade.tradeId || !trade.provider || !trade.beneficiaryAccountId || !trade.orderId || !evidence.paymentId) throw new Error('Missing trade or provider identifiers.');
  if (![trade.amountPaise, trade.acceptedAt, trade.payUntil, evidence.amountPaise, evidence.creditedAt, now].every(Number.isSafeInteger) || trade.amountPaise <= 0 || trade.acceptedAt > trade.payUntil) throw new Error('Invalid payment amount or time window.');
  if (evidence.provider !== trade.provider || evidence.beneficiaryAccountId !== trade.beneficiaryAccountId || evidence.orderId !== trade.orderId) throw new Error('Payment does not match the approved trade or recipient.');
  if (evidence.status !== 'credited' || evidence.currency !== 'INR' || evidence.amountPaise !== trade.amountPaise) throw new Error('Payment is not a matching INR credit.');
  if (evidence.creditedAt < trade.acceptedAt || evidence.creditedAt > trade.payUntil || evidence.creditedAt > now) throw new Error('Payment occurred outside the accepted window.');
  return { provider: evidence.provider, paymentId: evidence.paymentId, tradeId: trade.tradeId };
}
