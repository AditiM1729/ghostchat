# Mainnet batch deployment

Run `npm run deploy:mainnet:wallet` from the repository root and open http://127.0.0.1:5180 in the browser with BridgeKey.

1. Connect BridgeKey. Review MST Mainnet (chain 4646), the account, gas estimate and balance.
2. Review `GhostChatMainnetSuite.sol` and `GhostChatMainnetTrade.sol`. Tick the real-gas acknowledgement.
3. Choose **Deploy all three contracts**. Approve one zero-value transaction in BridgeKey. Real MSTC pays gas.
4. Keep the server running. After two confirmations, exact creation input and the suite/child runtime bytecodes are verified. The tool writes `deployments/mst-mainnet.json` and the README address table.
5. Download the receipt. Preserve the suite's compiled build-info alongside the deployment record.

The single transaction creates the registry plus native payment-link escrow, community fund and mutual-confirmation P2P escrow atomically. No payment deposits are made. Direct transfers need no contract. The registry has no owner or control over its children.

After a page/network error, recover the existing transaction hash instead of redeploying. A saved pending hash blocks a second deployment. A different recorded deployment cannot be silently overwritten. If a transaction reverts, review it before replacing it; a slow receipt does not imply failure.

Only verified Mainnet addresses appear in the README. No Git operation occurs. The public Vercel app remains unchanged. Mainnet activation needs separate chain-aware frontend integration, exact suite-artifact registration, backend validation and signatures, isolated storage/deployment records and end-to-end checks. Do not fund an unused P2P module before its services are configured.

Matching references are participant agreement, not bank evidence. Non-cooperation can lock funds indefinitely. The server signer must issue reference commitments consistently. The Mainnet variant retains the mutual-confirmation settlement/cancellation logic and amount bounds; only its contract name and allowed deployment chain differ.

Network: chain 4646, native coin MSTC, RPC https://mariorpc.mstblockchain.com, explorer https://mstscan.com. The tool independently checks the RPC chain ID before recording a deployment.
