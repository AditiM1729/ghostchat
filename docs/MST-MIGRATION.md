# GhostPay on MST Testnet

The active local hackathon app now targets **MST Testnet**, not Ethereum Sepolia. Updated October 24, 2026. No public MST deployment or funded transaction is claimed.

| Setting | Value |
| --- | --- |
| Network | MST Testnet |
| Chain ID | `91562037` (`0x5752035`) |
| Native test coin | `tMSTC`, 18 decimals |
| RPC | https://testnetrpc.mstblockchain.com |
| Explorer | https://testnet.mstscan.com |
| Faucet | https://faucet.mstblockchain.com |
| Local app | http://localhost:5173 |
| Wallet deployment | http://localhost:5173/setup |

Sources: [MST official website](https://www.mstblockchain.com/) and the [Ethereum chain-registry entry](https://github.com/ethereum-lists/chains/blob/master/_data/chains/eip155-91562037.json). The chain ID was independently checked against MST's own RPC. A stateless `eth_call` probe of PUSH0/MCOPY succeeded; it did not broadcast or persist a transaction.

## Run and configure

For BridgeKey connection and wallet-specific checks, see [BridgeKey on MST](BRIDGEKEY-MST.md).

```powershell
cd D:\hackathon\ghostpay-github
npm start
# Optional read-only network check:
npm run check:mst
```

The relay starts without a deployment and reports `configured: false`. This is expected. No address is guessed or copied from another network.

1. Open `/setup`, connect MetaMask or another compatible external wallet, and switch/add MST Testnet. The app's wallet configuration contains the network parameters above.
2. Get faucet **tMSTC** for the sender and recipient. Recipients need test gas to claim too.
3. Review and sign **Deploy GhostPayEscrow**. The app waits for two confirmations; the relay checks network identity, exact creation bytecode and canonical receipt before saving `deployments/mst-testnet.json`.
4. Create a payment link, request it from the second wallet, independently verify that wallet, approve and claim. Refunds remain manual after expiry.

For native v2 links or community campaigns, the composers also offer per-network wallet deployment/import with creation-provenance checks. These are separate contract types; do not import the v1 escrow address as a v2 escrow or community contract. Direct transfers need no escrow deployment.

Optional root setting: `MST_RPC_URL=https://testnetrpc.mstblockchain.com`. An old `SEPOLIA_RPC_URL` setting is ignored by the active relay. Browser v1/device-wallet RPC overrides use `VITE_MST_RPC_URL`; the old generic `VITE_RPC_URL` is intentionally ignored so a saved Sepolia setting cannot silently retarget the MST client. An RPC with the wrong chain ID is rejected by deployment/wallet preparation checks. Do not put private keys in frontend settings.

CLI deployment, if deliberately used, is `npm run deploy` on Hardhat's `mst` network. `MST_PRIVATE_KEY` belongs only in the deployer's own shell. Normal setup uses the connected wallet and needs no backend signing key.

## What changed

- MST is the default wallet/payment network. Sepolia variants are excluded from the generated selectable testnet catalog. Other supported non-Sepolia testnets remain optional.
- The local relay, setup verifier, device-wallet chain and signing restrictions, payment cards, explorer links and faucet UI use MST parameters and tMSTC labels.
- Payment entry defaults to native amounts. No MST USD price is invented or substituted from ETH, and unsupported price lookups stay disabled.
- The P2P factory/token/escrow only allow MST Testnet and isolated local chain `31337`. Its evidence is still simulated, its gpUSD token is still a worthless fixture, and no real INR/UPI verification was added. Saved P2P settings are scoped to the target chain.
- Native, community and direct references reject retired Sepolia chains and MST mainnet `4646`. Network/domain checks remain in place before signing.
- Contract tests and regression fixtures use the MST target where appropriate. Cross-chain replay and stale Sepolia provider rejection are covered.

## Historical deployments and hosting

`deployments/sepolia.json`, the historical read-only `scripts/check-sepolia.mjs`, old release notes, previous startup-credit evidence and the separate `public-site` Worker/Sites source remain historical Sepolia records. They are not loaded as an MST deployment. Existing on-chain deposits cannot be migrated by changing a config file. Keep the original deployment information if it identifies funds you still need to manage.

The existing production Vercel alias was **not redeployed** for this migration. Its hosted relay still points to the historical Sepolia service. The active MST version is the local app. Publishing it requires a deliberately configured MST relay with persistent storage and new verified contract records; uploading the frontend alone would leave it connected to the wrong backend. The username proxy currently reuses the existing chain-neutral directory endpoint; it does not authorize an MST withdrawal and its signatures do not supply deployment proof.

Do not run `sync:vercel` and publish this MST build against the old fixed Sepolia relay. Plan a separate hosting profile or a complete verified backend cutover. A persistent MST-hosted relay has not been implemented/deployed as part of this local migration.

## Verification scope

Production compilation, isolated contract lifecycles, relay tests, frontend/wallet tests and the refreshed internal P2P Slither check are recorded in the current status entry. These are not an independent audit or a public funded two-wallet check. Browser visual QA remains unverified because the saved browser permission previously blocked localhost; no alternate browser route was used.
