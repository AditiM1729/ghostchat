# Live P2P: INR directly to sellers, native MSTC to buyers

Reviewed October 29, 2026. Research and implementation plan, not an enabled payment integration. No bank account was connected, INR collected, proof generated or mainnet escrow deployed during this review.

## Confirmed product scope

- Asset: real native MSTC on MST Mainnet, chain ID 4646.
- Buyer pays INR by UPI directly to the seller's own bank account.
- GhostChat links the seller's payment identity to their application account and wallet; it does not pool INR in a GhostChat merchant account.
- Seller locks MSTC before payment. The buyer receives the agreed MSTC only through the escrow's authorized release path.
- Keep the existing messenger layout and use its P2P popup. Matrix integration is paused.

Saving a UPI ID is not bank-account authentication, ownership verification or permission to read incoming payments. These must have separate status fields and an actual verification mechanism. A matching display name is insufficient.

## Recommendation for the first payment-evidence experiment

Use an existing seller bank account before opening a new one. HDFC is a reasonable candidate for investigating the email route because its official [InstaAlerts description](https://v.hdfc.bank.in/htdocs/mobile/instaAlert.html) explicitly covers selected debit/credit transactions by email. This is a research candidate, not confirmation of crypto trading eligibility, a public webhook API or ZK compatibility. Confirm incoming UPI coverage, thresholds, available fields and DKIM signatures on the actual account first. A bank advertisement alone cannot establish these.

For a proof-of-payment alternative, Peer documents buyer verification through Amazon Pay and receipt at any valid seller UPI ID. Evaluate that source before building notification scraping. Its documented protocol currently settles Base USDC, so it does not meet the confirmed MSTC requirement as a drop-in integration.

Do not instruct users to send INR into the present sandbox to test these ideas. Payment evidence can first be studied independently of any token sale. If live trading is pursued, confirm provider/bank permission for this exact use and applicable launch obligations; ordinary personal-account availability does not establish permission to operate this service.

## Gateway and proof options

| Option | What research establishes | Missing for our scope |
| --- | --- | --- |
| [Darshan Parmar repository](https://github.com/darshankparmar/UPI-Payment-Gateway) | Public MERN wrapper around a merchant API, not its own UPI rail | Confirmed reuse license, current provider API contract, permitted P2P use and per-seller onboarding/status access |
| [UPIGateway](https://upigateway.com/) | Advertises dynamic QR and status webhook for connected merchants; explicitly describes itself as QR service | Evidence that each individual seller can be connected with correct beneficiary attribution and authenticated credit status |
| [Peer Cash](https://github.com/zkp2p/peer-cash) | MIT SDK documents UPI/INR, valid seller VPAs and Amazon Pay buyer verification; standard UPI only, no UPI Lite or merchant payments | MST-native settlement and a supported MST deployment; Cash is maker/offramp-only, not the full embedded buyer workflow |
| [ZKEmail](https://docs.zk.email/getting-started) | Can prove selected authenticated email properties | A real seller-bank credit template with sufficient DKIM-covered fields, circuit/parser, key registry, MST verifier and measured gas |
| [Reclaim](https://docs.reclaimprotocol.org/onchain/solidity) / other zkTLS | Candidate for proving selected authenticated HTTPS response fields | Actual supported source, precise trust model and proof schema, access rights, payee binding, freshness and MST verification |

Do not install a gateway merely to mark the application live. Public source is not automatically licensed for reuse, and QR creation does not establish bank access. The Darshan repository's backend also needs authorization, server-owned immutable orders and durable job processing before use as a settlement component.

Peer upstream documentation describes UPI availability, but availability was not tested with a live account. Its current payment catalog and deployed verifier must be checked before integration; some documentation snapshots differ. Its TEE-TLS verification and signed attestations must be described with their actual trust assumptions, not automatically as a pure on-chain ZK circuit. No MST bridge or supported MST route was established. Adopting Base USDC would change the confirmed product scope.

## Bank notifications and release authority

1. **Informational notification:** SMS, phone notification, UTR entry, screenshot, UPI app redirect or a buyer pressing Paid. These may initiate verification; they cannot authorize automatic release.
2. **Authenticated credit evidence:** a seller-authorized bank/PSP source confirms the credited beneficiary, exact INR amount, unique transaction identity, successful credit status and relevant time. A merchant webhook applies only to accounts that integration can actually observe. Independently query authenticated status when supported; do not trust a caller-supplied success object.
3. **Verifiable payment claim:** a selected proof mechanism authenticates the required evidence and binds it to the immutable accepted trade. A backend EIP-712 signature is a trusted attestation, not a ZK proof.
4. **Settlement notification:** after the verifier accepts and the finalized escrow transaction is observed, notify both parties that MSTC was released.

A browser/PWA cannot directly read the phone's bank SMS or notification tray. A consenting native Android notification listener would still receive device-reported data, not cryptographically bank-authenticated evidence. Seller-click confirmation could support a clearly labelled manual-release workflow, but it cannot be advertised as bank-verified automatic or ZK settlement.

## Proposed MST-native flow

1. Authenticate seller, bind wallet by signed challenge, register a private payment profile. Separately verify the payee through the selected source and seller consent. Never request bank passwords, OTPs or UPI PINs in GhostChat.
2. Seller creates a funded native-MSTC escrow offer. Store MSTC in integer base units and INR in integer paise. Agree an explicit rate; the existing gpUSD illustrative rate is not an MSTC market price.
3. Buyer reviews immutable buyer/seller wallets, MSTC gross/fee/net, INR amount, payee commitment, deadline and evidence policy, then accepts those exact terms.
4. Show the seller's agreed UPI details/QR to the buyer privately. Lock that payment identity for this trade; later profile edits cannot redirect an accepted trade.
5. A bank/provider event or proof submission starts verification. Match beneficiary, amount, currency, source transaction identity, credit status and payment window. Buyer debit evidence alone does not establish seller credit.
6. Prove the required claim or explicitly use the chosen trusted-attestation mode. Keep the complete bank evidence and unrelated balance/history out of public chain state and analytics. Small/guessable identifiers require protected commitments, not bare public hashes.
7. Verify on MST against the reviewed source/verifier policy and the chain, escrow, accepted trade and fixed buyer. Enforce payment uniqueness across all accepting deployments. A user-chosen random nullifier is unsuitable; chain-scoping a nullifier alone would allow the same payment to settle on another chain.
8. Settle only once. Persist the submitted transaction hash and reconcile its receipt before retrying. Track chain reorganization/finality before showing completion.
9. Send private in-app notifications for payment reported, verification pending, evidence accepted, tokens released and dispute updates. Browser push requires user opt-in and must omit bank data.

An authenticated receipt proves an observation under its source assumptions; it does not make a bank transfer irreversible. Handle reversals and disputes explicitly.

## Required implementation changes

### Contracts

- Create a separate native-asset escrow. `GhostPayP2PSandbox.sol` deliberately rejects mainnet and escrows a freely minted ERC-20; changing its network constant is not a native MSTC integration.
- Define the actual proof/verifier ABI only after the source and proof format are validated. Keep fixed payout recipients, exact accounting, replay protection and reentrancy protection.
- Define cancellations, expiry, late/partial/duplicate payments, disputes and recovery. A timeout is not evidence of nonpayment. The existing sandbox can lock accepted funds indefinitely and is unsuitable for production.
- Review native payout failure handling and allow withdrawals/recovery without exposing another party's paid allocation to unilateral timeout theft.
- Verify compiler/EVM compatibility, verifier precompiles and measured proof gas on MST, then test and independently review before a funded deployment.

### Server

- Private seller payment profiles and explicit linkage/ownership/evidence-access statuses.
- Immutable accepted terms, persistent provider-order mapping and payment records; participant authorization on every endpoint.
- Provider-specific authenticated status adapter, raw callback authentication where supported, evidence normalization and canonical payment identity registry.
- Durable verification/settlement jobs with idempotency, retry/reconciliation and a transactional notification outbox.
- Proof source/key lifecycle, bounded evidence retention, encrypted sensitive fields and redacted logs.

### Existing popup

- Distinct live MSTC product state, with sandbox kept explicitly separate until replacement is ready. No cosmetic removal of sandbox labels while using the demo contract.
- Seller payment linkage, funded offers, exact acceptance, UPI payment instructions, evidence/settlement progress and dispute recovery in the existing layout.
- Never display Bank confirmed from an SMS, redirect or local state. Show the source and meaningful verification result.

## Acceptance evidence before enabling real trades

- Valid authenticated payment to the agreed seller; failure for wrong payee, wrong amount/currency, debit-only, pending, failed, late and malformed evidence.
- Source signature/DKIM and field coverage, template changes, key rotation, expired proof and proof source outage.
- Same payment replay against another trade/escrow/deployment/accepting chain; mutations of buyer, amounts, terms, timestamps and chain.
- Concurrent callbacks, process restart, duplicate jobs, RPC timeout after submission, failed native payout and chain reorganization without double settlement.
- Credited-but-not-yet-proven and paid-but-not-yet-settled recovery; disputed/reversed/partial transfers and explicit liability policy.
- No plaintext bank credentials, full receipts or unrelated banking data exposed in frontend persistence, logs, push payloads or on-chain events.

## Immediate dependency

The user has confirmed real MSTC and direct-to-seller UPI, but no first bank or provider account is selected. Next validate one real evidence source before choosing the SDK, circuit or production settlement contract. No mainnet-money path is enabled by this document.
