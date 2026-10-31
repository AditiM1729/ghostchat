> Historical setup: the active app now uses the SARAL integration boundary. See [current status](MST-SARAL-INTEGRATION.md). BridgeKey/Reown login has been removed from the active UI.

# GhostChat with BridgeKey on MST Testnet

Updated October 28, 2026. This configures the local app; it does not publish a release or deploy/fund contracts.

## Connection setup

1. Obtain BridgeKey through its [official website](https://bridgekey.io/), which links to its [Chrome extension](https://chromewebstore.google.com/detail/bridgekey/bfjojdcfenehemjgjlepdjomkpginlkg). Unlock the wallet and allow it on the app's origin, then reload the app.
2. Run `npm start` in the repository and open `http://localhost:5173`. Open **Your wallet** or **My wallet**, then **Connect BridgeKey**.
3. The app selects the uniquely named BridgeKey connector discovered by the browser, even when another wallet is installed. It requests MST Testnet, chain ID `91562037`. Discovery metadata is self-reported and does not authenticate the extension's publisher; verify installation and the actual wallet prompt yourself.
4. If BridgeKey does not advertise a named connection, use **Choose browser wallet, Google or WalletConnect** and select the intended browser-wallet entry. Confirm that BridgeKey opens. The dedicated button fails with instructions instead of silently choosing MetaMask or another wallet. A generic injected connection cannot reliably identify the wallet when multiple legacy extensions compete; disable conflicting injection for this site if necessary.
5. Approve connection in BridgeKey. Add/switch to MST Testnet if requested. If the wallet cannot add/switch automatically, configure the network manually with the settings below, then reconnect. MST mainnet is not an allowed payment target.
6. Obtain faucet coins for deployment, funding and claims. Both participants need gas. Follow `/setup` to deploy/verify the required contract, then run a two-wallet testnet lifecycle.

| Setting | Value |
| --- | --- |
| Network | MST Testnet |
| Chain ID | `91562037` / `0x5752035` |
| Native test coin | `tMSTC`, 18 decimals |
| RPC | `https://testnetrpc.mstblockchain.com` |
| Explorer | `https://testnet.mstscan.com` |
| Faucet | `https://faucet.mstblockchain.com` |

## Implementation and limits

- Wagmi/Reown uses standard EIP-6963 multi-wallet discovery with a generic EIP-1193 fallback, rather than a MetaMask-only target. See [Wagmi injected connector documentation](https://wagmi.sh/react/api/connectors/injected) and [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963).
- The direct BridgeKey action requires exactly one matching named connector and requests MST Testnet. No provider-specific global, proprietary SDK, WalletConnect wallet ID or mobile deep link is guessed.
- Existing downstream chain/account/deployment checks still gate payment signatures and transactions. A connection itself never funds a contract or authorizes a payout.
- Google login connects a separate Reown-managed wallet. It does not reconnect BridgeKey or authenticate Matrix chat. Internal GhostPay contract names/signing domains remain unchanged; display branding does not rewrite cryptographic domains.
- BridgeKey's official public pages confirm extension/dApp connectivity but do not establish its exact EIP-6963 advertisement or this app's live MST signing compatibility. A mobile WalletConnect path is available only if the installed wallet supports it; no mobile pairing is claimed as tested.
- Automated tests cover exact requested-wallet selection, ambiguity/missing-wallet rejection, cancellation and existing MST restrictions. Verify real BridgeKey connection, network switch, personal signing, typed-data signing, transaction submission and reconnect on the installed wallet before calling the integration end-to-end verified.
- The historical hosted release still needs the matching MST backend cutover described in [MST migration](MST-MIGRATION.md). Do not publish the frontend against its old Sepolia relay.

No seed phrase, imported wallet key or backend signing secret is required for this connection path.
