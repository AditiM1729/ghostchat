## Latest implementation: mutual UTR demo (deployment pending)

See [P2P-MUTUAL-UTR.md](P2P-MUTUAL-UTR.md) for the current workflow, implementation, trust model and ZK limitations. New version 3 trades remove the separate buyer-acceptance step and release only after matching wallet-bound UTR confirmations from both parties. This is mutual reference confirmation, not verification that INR arrived. The new contract has not been deployed. The older workflow notes below describe earlier versions and existing deployed trades.

---

## Current seller-confirmed path (replaces arbitration for new offers)

New marketplace trades use GhostChatSellerTrade on MST Testnet after one shared deployment is activated. The app registers the creation transaction only after checking exact creation input, runtime, chain and confirmations. Existing GhostChatArbitratedTrade links remain usable under their original rules; balances and contract rules are never migrated automatically.

Flow: seller funds a buyer request and attaches saved private UPI details; buyer clicks Accept & view seller UPI; buyer pays real INR directly and reports the payment; seller checks their own bank app and releases escrow. There is no third-party acceptance and no claim that the contract verifies a bank credit.

A dispute has no automatic winner. The seller may release tokens to the fixed buyer; the buyer may voluntarily return tokens to the fixed seller. The seller cannot reclaim accepted tokens unilaterally. There is no deadline-based seller withdrawal after a reported payment. If neither agrees, tokens remain locked indefinitely. Returning tokens does not refund INR. This simpler model requires counterparty trust and is experimental, not a trustless fiat exchange.

Shared UI states normalize the two contract versions without exposing seller payment details to a buyer before acceptance or after completion. Existing database and encrypted UPI profiles are retained.

Activation: apply the seller-confirmed EC2 runtime update, open /trade?setup=simple, acknowledge the testnet/INR terms, deploy once via BridgeKey, and wait for canonical confirmation and registration. Other accounts reuse that registered escrow. No admin key or private signing key is stored by the relay.

---

# P2P implementation review

Scope: direct real INR through the seller's UPI app, native testnet tMSTC escrow, seller confirmation, and a mutually selected arbitrator. Mainnet, ZK and Razorpay are outside this flow.

## Implemented

- A profile shortcut leads to P2P. The seller can prepare a UPI ID and QR before funding, then explicitly save them against a funded offer. Unsaved drafts stay in memory and do not survive a refresh.
- Saved payment details are encrypted on the relay, immutable per offer, and readable only by the seller and accepted buyer. They are not put into Matrix chats or public trade links. The arbitrator has no access to these payment details.
- The server authenticates BridgeKey sessions and verifies the canonical deployment and on-chain parties. Unauthorized access is rejected on the deployed relay.
- The contract fixes the buyer, seller, arbitrator, token allocation and INR amount. The arbitrator must opt in before buyer acceptance.
- The buyer reports payment; the seller can release only after that report. A disputed trade requires the named arbitrator to resolve it. Payouts go only to the fixed parties.
- Visible trades refresh every 15 seconds, with a manual refresh available. This is polling, not push notifications.

## Still required or limited

1. The shared arbitrated escrow is deployed on MST Testnet at `0xbff1ad922bb75c92652b3e6a2764a001b4351d4c`, creation transaction `0xa6bd3c5ad11a7c611a8b0228d7a036b1aae1bc89d0083fec5c1dd379a30189ca`. Creation input, runtime code, chain and canonical receipt were verified. The frontend reuses this default; ordinary users do not deploy contracts. Existing single-payment and community contracts remain separate.
2. Verify a complete three-wallet flow on the deployed chain: save private details, accept arbitration, accept offer, check buyer visibility, report payment, release, dispute, both resolution outcomes, and rejection of unrelated wallets. Local contract/privacy tests do not replace that exercise. No real INR payment has been verified by the agent.
3. The UTR field is currently local input. It is not saved to the relay, automatically delivered to the seller, authenticated, or checked for reuse. Add private trade evidence/UTR exchange and an evidence view for dispute handling before describing those as integrated.
4. QR ownership and agreement between QR content and the typed UPI ID are not validated. Check the payee shown by the UPI app; uploading an image does not prove ownership.
5. Buyer requests now persist on the relay: Market, My buy offers, and My sell trades. A request fixes token quantity and INR rate; one seller selects it, then its funded contract terms are checked before linking. Existing trades predating the board still need their original links. Unsaved UPI drafts and pending transaction recovery remain device-local. No push notifications exist. Selected requests reserve one seller and cannot currently be reassigned; a seller who abandons funding leaves that request reserved. Funded records open the live contract for current settlement status. The board requires the corresponding EC2 runtime update.
6. If the arbitrator disappears during a dispute, the contract has no replacement or timeout recovery. Funds can remain locked. Do not imply guaranteed dispute resolution.
7. The private relay is trusted with payment details and its encryption key. Back up its database and key together; this storage is not end-to-end encrypted.
8. The contract remains experimental and unaudited. Testnet tokens have no real value even when INR is real. This review does not establish readiness for a public real-money service.

## Reusable private UPI profile

Sellers can save or update their UPI ID and QR once in P2P. The authenticated wallet owns the encrypted profile; callers cannot choose another wallet to read. Future funded marketplace trades attach a fixed snapshot automatically, with pending-transaction recovery retrying the attachment if needed. Updating the profile cannot alter existing trade snapshots. Buyers receive only their accepted trade snapshot, never access to the seller profile. Deploy the corresponding relay runtime to enable profile endpoints.
