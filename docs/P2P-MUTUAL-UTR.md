# GhostChat mutual UTR demo

Status: implemented and tested locally; the new contract is not deployed. Existing deployed trades keep their original rules. This is an experimental MST Testnet module, not a bank-verified or audited exchange.

## Presentation workflow

1. Buyer posts the token amount and their desired INR rate in My buy offers.
2. Seller selects that request, saves a private UPI ID/QR once, and locks the exact token allocation in escrow. The buyer and amounts are fixed on-chain.
3. The assigned buyer immediately sees the seller's saved UPI ID and QR inside this trade. No arbitrator or separate buyer-acceptance transaction is required. Other wallets cannot retrieve these details. Details must finish attaching before paying.
4. Buyer sends the exact INR amount directly through their UPI app. GhostChat does not move INR.
5. Buyer independently enters the reference from their payment record and confirms that they sent the money. Seller checks the actual incoming credit in their own bank app and independently enters its reference. Neither UI displays the other person's raw entry.
6. Each person confirms their own entry in BridgeKey. Matching reference commitments from both assigned wallets cause the contract to release tokens to the fixed buyer. A single confirmation never releases tokens.
7. A mismatch keeps tokens locked. Either party can correct their own reference and confirm again. Otherwise, both parties may approve returning tokens to the seller; this does not refund INR. There is no unilateral seller reclaim while a buyer may already have paid. Without matching confirmations or mutual cancellation, tokens can remain locked indefinitely.

For a demo, show a mismatch first, inspect the still-funded escrow, then correct the reference and show the Released event and buyer token balance. If INR is actually transferred, describe it as real INR paired with testnet tokens with no real value. Do not describe matching dummy references as evidence of a bank payment.

## What the intermediate layer does

The authenticated relay checks the canonical escrow deployment and the connected wallet's on-chain role. It normalizes each reference, derives a keyed SHA-256 commitment scoped to chain + escrow + trade, and persists only that commitment. Raw UTRs are processed transiently by the relay; do not log request bodies or place them in analytics. Candidate records survive reloads without storing the plaintext UTR.

An EIP-712 attestation binds the candidate commitment to a particular wallet, trade, chain and contract. The contract requires both the actual wallet transaction and a valid attestation for that actor. Copying the other actor's visible commitment or signature does not produce a usable confirmation. The contract pays only its fixed buyer after equality; it cannot redirect escrow to the relay.

The relay is trusted to compute commitments and attest entries. Its attestation key is derived with a separate domain from the existing private storage key; back up the existing database and key together. Loss or replacement of that key can prevent future confirmations for existing offers. The configured relay verifier is fixed per funded trade.

The equality result and wallet transactions are public. Hash commitments, actor wallets, token amounts, INR totals, transaction timing and the release outcome are not hidden. Other trade parties do not receive a raw UTR from the application, but the payer, recipient, their banks and the relay naturally know their own relevant information. UPI payee information necessarily reaches the buyer to make payment.

## Claims and limits

Matching UTR entries establish mutual agreement on the same reference, not that INR reached the correct UPI account. They do not establish payee, credited amount, successful settlement, uniqueness across all banks, or authenticity of a bank record. Both people can knowingly enter the same invented reference. The API deliberately returns `bankVerified: false`. The seller must inspect their own bank credit before confirming. NPCI directs users to participating-bank UPI apps for transaction status: https://www.npci.org.in/what-we-do/upi/faqs

This version is not a zero-knowledge proof. It uses keyed commitments, relay attestations and two wallet authorizations. Do not label it ZK, bank verified, automatic bank reconciliation or trustless fiat settlement.

ZK can be a future privacy upgrade: each participant could prove knowledge of a private reference and secret salt behind a shared commitment, with proofs bound to the same trade and participant. Equality is necessarily disclosed. Designing secret-salt sharing, witness handling, proof generation and verifier integration is required; this is not implemented here. Even a sound equality proof would still accept two identical invented inputs. Authenticating payment requires a separate trusted bank/provider statement or authenticated payment evidence. NIST describes ZK as proving a mathematical statement without disclosing its witness: https://csrc.nist.gov/Projects/pec/zkproof

## Implementation and later deployment

- `contracts/contracts/GhostChatUTRTrade.sol`: testnet-only escrow; offer, actor-bound UTR confirmations, matching release, mismatch correction and mutual cancellation.
- `shared/utrConfirmation.ts`: common normalization and typed-signature domain.
- `server/src/privateTradeDetails.ts`: authenticated private matching, role-scoped attestations, private payment snapshots and registry.
- `frontend/src/p2p/UTRPanel.tsx`: independent buyer/seller input and confirmation controls.
- `frontend/public/contracts/simple-seller-trade.json`: new version 3 ABI and deployment bytecode.
- Previous version 2 seller-confirmed and version 1 arbitrated contracts remain recognized for existing links. They cannot adopt these rules automatically.

Build contracts, run `node scripts/build-p2p.mjs`, build the server and run `node scripts/build-relay.mjs`, then build the frontend. The relay bundle now needs all six JSON/runtime artifact files: relay.mjs, GhostPayEscrow.json, GhostChatTestTrade.json, GhostChatArbitratedTrade.json, GhostChatSellerTrade.json and GhostChatUTRTrade.json. Do not use an older four/five-file update archive for this version.

When deployment is requested later: update the relay and frontend, then deploy the new contract through `/trade?setup=simple` using BridgeKey. The registration checks exact creation bytecode, runtime bytecode, testnet chain and canonical confirmations. The relay uses a separate `mutual-utr-v1` registration key, preserving prior registrations and funded balances. No deployment or real payment is performed as part of this implementation.

Validated locally: wallet-role isolation; immediate assigned-buyer QR access for V3; no raw reference in API responses; reference normalization and mismatch/correction; distinct attestations for each actor; trade-scoped commitments; signature actor/chain/contract/trade binding; matching payout exactly once; bilateral cancellation and revocation; mainnet rejection; compatibility of old trade state mappings. A real two-device deployed demonstration remains outstanding.
