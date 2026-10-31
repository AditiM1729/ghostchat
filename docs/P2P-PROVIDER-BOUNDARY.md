# Live P2P provider boundary

Target: buyer pays INR directly to an onboarded seller; native MSTC is held in escrow. This is a design and validation foundation, not an enabled live payment service. No provider or seller-bank connection is configured. Personal UPI QR codes do not provide payment notifications. The existing P2P contract remains testnet-only.

1. An approved partner onboards each seller and verifies the receiving account. A QR or UPI ID alone does not establish ownership or credit access.
2. Bind an immutable trade to its chain, escrow, buyer, seller, exact INR amount, provider, verified beneficiary, provider order and time window. Lock tokens before requesting payment.
3. A provider-specific adapter authenticates a raw callback using the provider's documented signature and retrieves authoritative payment and beneficiary status through its API. Reconcile retries and status changes; fail closed on ambiguity.
4. `validateLivePaymentEvidence` checks normalized evidence against the bound trade. It assumes the caller already authenticated the source; it is not itself proof of a bank payment. Atomically enforce a unique provider/payment ID across every trade and escrow in durable storage before issuing any settlement authorization.
5. A reviewed settlement contract must verify a trade-bound authorization and replay protection. Handle reversals, disputes, outages and accepted trades without silently releasing or confiscating funds. Review custody, recovery and dispute rules with the provider and legal counsel.
6. ZK is a later addition: a circuit must verify authenticated evidence and public trade bindings, with a deterministic one-payment nullifier and a compatible on-chain verifier. Proving a backend assertion still trusts that backend. No ZK implementation is claimed here.

Before implementation can connect live INR: identify a partner that permits INR-to-MSTC activity and seller-direct credits, obtain its documented APIs and onboarding approval, confirm MST support, and assess Indian VDA obligations. Never put banking credentials, webhook secrets or signing keys in frontend code.

## Seller-initiated proof experiment

The seller starts verification after receiving an INR credit; no automatic bank notification is required. Investigate a bank credit email with ZK Email, or another explicitly supported authenticated source. The seller generates a proof locally where feasible. First prove only against test fixtures: do not connect proof generation to live token release.

The statement must authenticate the actual issuer and signed content, bind the recipient account to the seller's trade, require the exact amount and a credit event within the accepted time window, and derive a deterministic nullifier from the authenticated payment identity. That nullifier must be shared across all accepted escrows, not salted differently per trade. The contract must bind proof inputs to chain, escrow, trade and buyer, and reject a previously consumed nullifier.

Before claiming this works for any bank, verify that its genuine incoming UPI credit alert is DKIM-signed and that the signed fields unambiguously identify the credited account, amount, timestamp and payment. Establish issuer key verification, rotation and revocation, circuit constraints, parser behavior and MST verifier compatibility. A sender address, copied message, screenshot, user confirmation or self-signed receipt is not authenticated bank evidence. A proof of an email does not rule out a later reversal or dispute. Do not request a user's bank credentials or raw private messages in chat.
