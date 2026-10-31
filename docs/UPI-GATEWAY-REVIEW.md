# UPI integration and ZK feasibility for GhostChat

Reviewed October 28, 2026. No merchant credentials, real-money transfer or live UPI integration was used in this review.

**October 29 scope update:** the requested product is now real native MSTC on MST Mainnet, with INR going directly to each seller's bank account. See [the live trading plan](P2P-LIVE-TRADING-PLAN.md) for current provider findings, bank notifications, proof requirements and implementation gates. The test-token pilot discussion below is historical, not the selected product.

## Repository identified

The likely project is [darshankparmar/UPI-Payment-Gateway](https://github.com/darshankparmar/UPI-Payment-Gateway). Its MERN app wraps UPIGateway.com's merchant service and needs a merchant key. It is not a self-contained UPI network or ZK system. The [provider's public site](https://upigateway.com/) describes its product as dynamic QR generation and expressly distinguishes it from a payment gateway.

The [server code](https://github.com/darshankparmar/UPI-Payment-Gateway/blob/main/server/index.js) creates orders, polls a provider status endpoint and stores customer/payment records in MongoDB. Its `/getAllUser` route has no authentication. Order input comes from the client, pending polling lives in memory, and settlement is not bound to a GhostChat trade. No ZK verifier or explicit reuse license appeared in the inspected repository tree. Confirm permission before copying code.

**Decision:** use it as a reference, not a drop-in trusted settlement service. Confirm current merchant endpoints and account eligibility in the actual provider portal. Similarly named `.dev`, `.in` or plural-domain services are not assumed to be this provider.

## Can someone pay real UPI and receive test tokens?

A real bank transfer and a test-token transfer can be performed as separate actions. The current application cannot authenticate or atomically coordinate them. The freely minted gpUSD token has no redemption value; the INR transfer would still be real money. Do not present this as buying redeemable USDC or as risk-free payment verification.

A future controlled pilot needs the payment provider's acceptance of this exact use, consent about worthless demonstration tokens, an explicit amount limit/refund arrangement, an authenticated payee account and a reviewed resolution process. Calling an asset a test token does not automatically establish provider permission. No legal eligibility or approval is asserted here.

## First integration: authenticated backend verification

Build an adapter in GhostChat's existing backend rather than copying another frontend and database model:

1. Create an immutable server-side order bound to chain, escrow, trade, buyer, seller/payee, INR amount in integer paise, asset amount, accepted terms and payment deadline. Do not accept a replacement amount/payee from the browser.
2. Create the provider order using server-only credentials and an idempotency key. Preserve its identity and lifecycle durably before returning a checkout reference.
3. Treat browser redirects, typed UTRs and webhook bodies as triggers for verification. Independently retrieve status through the authenticated provider channel. Match successful status, exact amount/currency, payee/account, order identity and payment window to the stored order. If a required field is unavailable, fail closed.
4. Enforce canonical provider-payment uniqueness across every accepting trade/deployment. Authenticate all application endpoints and restrict each order to authorized participants. Keep customer records and provider payloads private.
5. Process verification and settlement idempotently using durable jobs. Recover after restarts, duplicates and concurrent calls. Keep paid-but-unsettled orders visible for recovery. Preserve a transaction hash before retrying a chain write.
6. If a backend signs the result, call it a **trusted payment attestation**. It is still dependent on the provider and backend, and needs a reviewed contract/deployment. Never silently reinterpret the sandbox deployer's signature as bank verification.

Provider outage, partial/late payment, refunds, reversals and buyer-paid/seller-disputed cases need explicit handling. A timeout does not prove nonpayment. Do not add a seller timeout sweep to accepted trades just to avoid locked funds.

## Genuine ZK integration: separate engineering work

Hashing a receipt, hiding a UTR, checking a callback signature or signing JSON does not establish a ZK proof.

Two candidate evidence approaches need feasibility work:

- A compatible authenticated HTTPS/zkTLS mechanism could prove selected fields from the chosen provider's supported status response. Confirm the actual endpoint, source authentication, allowed proving access, freshness and provider trust before selecting a protocol. Ordinary HTTPS fetch results in our backend are not automatically transferable cryptographic proofs.
- A suitable bank-issued, DKIM-signed receipt might support a narrowly defined ZKEmail claim if the authenticated fields cover the payment requirements. [ZKEmail](https://docs.zk.email/getting-started) verifies email properties using DKIM and ZK, with [issuer, key and cryptographic trust assumptions](https://docs.zk.email/architecture/security-considerations). An arbitrary forwarded email or sender-written receipt is insufficient.

For either route, review circuit constraints and canonical field parsing. Bind amount, currency, payee, payment identity/status/time, chain, escrow, trade and fixed recipient. Define payment-derived nullifiers and their cross-contract/chain scope. Check actual MST verifier deployment, precompiles and gas use. Public inputs and payouts may remain linkable. Proof of an observed receipt does not guarantee irreversible bank settlement.

Before enabling automatic release, demonstrate real valid and invalid evidence, wrong amount/payee/trade/chain, expired/reused proofs, key rotation, provider failure and settlement races. Keep credentials and complete payment evidence out of chat, frontend storage, analytics and public chain state.

## Current UI and next requirements

Messaging, payment creation, payment activity and the P2P sandbox now use the same application workspace. Financial tools open in a centered popup from the left navigation. The P2P popup explicitly says that UPI is unconnected and genuine ZK remains planned. Real INR collection remains disabled.

To proceed beyond this review, obtain current provider API documentation and a provider-approved merchant account/use case, select the authenticated proof mechanism and specify the test-payment/refund policy. The owner must enter credentials privately on the server. No new gateway dependency, production token or guessed live endpoint was enabled.
