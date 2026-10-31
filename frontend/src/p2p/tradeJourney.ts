import { parseEther } from 'viem';
import type { BuyOffer } from './OfferBoard';

export function matchesOffer(offer: BuyOffer, trade: readonly [string, string, string, bigint, bigint, number, boolean]) {
  return trade[5] > 0 && trade[0].toLowerCase() === offer.seller?.toLowerCase() && trade[1].toLowerCase() === offer.buyer.toLowerCase() && trade[3] === parseEther(offer.amount) && trade[4] === BigInt(offer.paise);
}
export function nextTradeStep(state: number, role: 'seller' | 'buyer' | 'arbitrator' | 'visitor', arbitrationAccepted: boolean, paymentReady: boolean, simple = false, mutualUTR = false) {
  if (role === 'visitor') return 'This wallet is not a participant. Switch BridgeKey to the buyer, seller or arbitrator wallet shown in Trade wallets and amounts.';
  if (mutualUTR) {
    if (state === 1) return role === 'buyer' ? paymentReady ? 'Pay the exact INR amount using the UPI ID or QR below, then enter your UPI transaction ID and confirm in BridgeKey.' : 'Waiting for the seller to attach their UPI details. Do not pay yet.' : paymentReady ? 'The buyer can now see your UPI details. After receiving INR, check your bank app and enter the credited transaction’s UPI transaction ID independently.' : 'Attach your saved UPI profile below so your assigned buyer can pay.';
    if (state === 3) return 'Waiting for matching UPI transaction ID confirmations from both wallets. Enter your own reference independently. Do not pay a second time.';
    if (state === 4) return 'The confirmed references differ. Recheck your own UPI transaction ID and submit a correction. Tokens remain locked until matching confirmations or mutual cancellation.';
  }
  if (simple) {
    if (state === 1) return role === 'seller' ? paymentReady ? 'Tokens are locked. The buyer can now accept the trade and see your UPI payment details.' : 'Attach your saved UPI profile below so the buyer can accept and pay.' : paymentReady ? 'Accept this trade below to see the seller’s UPI ID and QR. No arbitrator is needed.' : 'Waiting for the seller to attach UPI details. Do not send INR yet.';
    if (state === 2) return role === 'buyer' ? 'Pay the exact INR total using the UPI ID or QR below. Then report the payment with your UPI transaction ID.' : 'Waiting for the buyer to pay. Check your own UPI or bank app for the exact credit.';
    if (state === 3) return role === 'seller' ? 'The buyer reports payment. Confirm the exact credit in your bank app, then release the escrowed tokens.' : 'Waiting for the seller to confirm receipt and release tokens. Do not pay again.';
    if (state === 4) return 'Disputed: the contract cannot check UPI credits. Contact the other party. Tokens stay locked unless the seller releases them or the buyer agrees to return them.';
  }
  if (state === 1) {
    if (role === 'seller' && !paymentReady) return 'Attach your saved UPI profile to this trade so the buyer can pay after accepting.';
    if (!arbitrationAccepted) return role === 'arbitrator' ? 'Accept the arbitrator role below. The buyer can then accept the trade.' : 'Waiting for the arbitrator. Copy this trade link and ask the agreed arbitrator to open it with their wallet and accept the role. Do not send INR yet.';
    if (!paymentReady && role === 'buyer') return 'Waiting for the seller to attach payment details. Do not send INR yet.';
    return role === 'buyer' ? 'Accept the trade below. Your seller’s UPI ID and QR will then appear here.' : 'Waiting for the buyer to accept. Payment details become visible to the buyer after acceptance.';
  }
  if (state === 2) return role === 'buyer' ? 'Pay the exact INR total using the seller’s UPI ID or QR below. Then enter your UPI transaction ID and report the payment.' : role === 'seller' ? 'Waiting for the buyer to pay. Check your own UPI or bank app for receipt.' : 'The buyer can now pay the seller. You act only if a dispute is raised.';
  if (state === 3) return role === 'seller' ? 'The buyer reports payment. Check your bank or UPI app, then confirm receipt to release tokens.' : 'Waiting for the seller to confirm receipt and release tokens. Do not pay a second time.';
  if (state === 4) return role === 'arbitrator' ? 'Review evidence from both people, then choose the dispute outcome below.' : 'Disputed. Contact your agreed arbitrator. Do not send another payment.';
  if (state === 5) return 'Completed: escrow released the tokens to the buyer.';
  if (state === 6) return 'Closed: escrow returned the tokens to the seller. Do not send INR for this trade.';
  return 'Loading the verified trade…';
}
