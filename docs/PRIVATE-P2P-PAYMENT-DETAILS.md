# Private UPI details for seller-confirmed trades

The seller saves a UPI ID and raster QR image once per funded offer, before buyer acceptance. The accepted buyer automatically retrieves them in the P2P interface using their existing BridgeKey login session. Before acceptance the buyer can check only whether details have been saved. Details are not added to chat messages, trade links, contract calls, public profiles or events.

The relay verifies the exact canonical MST Testnet deployment transaction, runtime contract code and current trade participants. An unassigned wallet, including the arbitrator, cannot read the details. Buyers cannot retrieve them after release or refund. Sellers can read their own records. Details already seen or saved by a buyer cannot be revoked from their device.

Storage uses AES-256-GCM with per-record nonces and trade-bound associated data. Keep `data/private-p2p.key` and `data/private-p2p.sqlite` private, persistent and backed up. The server operator can decrypt the information; this is access-controlled server storage, not end-to-end encryption. QR content and ownership are not verified against the UPI ID. Users must check the recipient displayed by their UPI app.

Deploy the regenerated Node relay and its `GhostChatArbitratedTrade.json` artifact, preserve the data directory, and deploy the updated frontend plus Vercel relay routes. Run `node scripts/build-relay.mjs` after compiling contracts. Existing seller-trade deployments using the earlier non-arbitrated bytecode cannot use these endpoints. Create a new arbitrated escrow; existing funds remain in their original contract.

The seller must save details before acceptance. The interface checks readiness; the contract itself does not depend on this private server. A buyer accepting directly outside the interface can bypass the readiness check. They should not pay until payment instructions are available and checked.

No real INR trade, remote deployment, or multi-wallet browser run is confirmed by these changes.
