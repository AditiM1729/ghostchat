> Superseded October 29, 2026: active sign-in now uses Google Identity Services and GhostChat password-encrypted wallets. See [current integration](GOOGLE-EMBEDDED-WALLET.md). This document records the previous SARAL investigation.

# GhostChat: MST SDK, SARAL readiness and Google profiles

Updated October 28, 2026. This change is local and has not been deployed publicly.

## What works and what is blocked

Installed the official `@mstblockchain/mst-sdk` package, version 1.0.0, linked from MST's own developer documentation. The installed source was inspected: it exports Client, Provider, Signer, Constants and Errors. It supports RPC reads, randomly generated private-key wallets, signatures, transfers and deployment. It does **not** implement Google OAuth, SARAL MPC key management, embedded wallet recovery or an EIP-1193 social wallet provider.

SARAL is described on MST's official protocol page, but its authentication SDK, configuration and backend verification documentation could not be located in the official docs index, public mst-chain repositories, or npm registry search. Therefore Google wallet login is visibly disabled. There is no fake social wallet, generated backend private key, or fallback provider masquerading as SARAL. No Google account has been connected and no wallet has been provisioned through SARAL.

Sources inspected:
- https://mstblockchain.com/Protocol/
- https://docs.mstblockchain.com/llms.txt
- https://docs.mstblockchain.com/developer-docs/foundation/mst-blockchain-sdks/javascript-sdk
- https://www.npmjs.com/package/@mstblockchain/mst-sdk
- https://github.com/mst-chain
- https://raw.githubusercontent.com/ethereum-lists/chains/master/_data/chains/eip155-4646.json

## Active wallet flow

BridgeKey, injected browser wallets, Reown social wallets and the device-wallet connector are removed from active wallet configuration. Reown's two direct package dependencies were removed. Legacy device-wallet source/backup handling is retained for previously saved encrypted backups; no legacy signing UI is mounted.

`frontend/src/wallet/saral.ts` defines a **GhostChat-owned adapter interface**, not the API of an official SARAL SDK. Once MST provides its actual auth SDK, implement and register the driver in `saralDriver.ts`. It must return the authenticated user's EIP-1193 provider and a verifiable Google ID token, preserve wallet ownership across devices/logins, and support logout and MST network switching. If SARAL uses its own session JWT rather than exposing a Google ID token, implement its documented server verifier instead; never accept a frontend-asserted email or wallet as proof of identity. OAuth state, nonce, PKCE, session refresh, recovery and key export must follow the actual vendor documentation and be tested before activation. Standard provider events are wired through the connector; validate them with the actual SDK.

The connector accepts only MST Testnet (91562037, tMSTC) and MST Mainnet (4646, MSTC), verifying the provider's chain after switching. The existing chat styling and compact workspace remain intact.

## Profile registration

The standalone `/start` onboarding screen contains fields for name, mobile with country code, and a unique username after sign-in. `/` restores the original landing page, whose Continue/Ready to start buttons lead to `/start`. Chat and financial workspace links require an authenticated wallet with a completed matching profile; original deep-link query and fragment parameters are preserved through onboarding. Signup fields are no longer embedded in the chat profile popup. Registration becomes reachable after the genuine SDK login is connected. It requires profile-storage consent, server verification of Google's RS256 ID-token signature using Google's JWKS, correct client audience, issuer, expiry, subject and verified email. No Google email address or ID token is persisted.

The server issues a five-minute, one-use registration challenge bound to the Google subject, wallet, username, application origin and a digest of the submitted private details. The wallet signs that challenge. Atomic SQLite constraints prevent duplicate usernames, duplicate wallet bindings, Google-account replacement and replay. An existing Google identity cannot silently bind another wallet.

Name/mobile are encrypted with AES-256-GCM in `data/accounts.sqlite`; the directory and database sidecars are ignored by Git. Configure a stable server-only `PROFILE_ENCRYPTION_KEY` (32 cryptographically random bytes encoded as 64 hex characters) and `GOOGLE_CLIENT_ID`. The encryption key is not generated in source, sent to the browser or stored with the database. Back up key and database separately. SQLite is suitable for one local/server instance; a multi-replica hosted deployment needs a shared database with the same uniqueness constraints and protected storage.

Public `/api/profiles/name/...`, `/address/...`, `/search/...`, and `/resolve` responses contain only username, wallet and creation time. The old hardcoded hosted-directory proxy has been removed. Existing hosted usernames are **not migrated** automatically; keep payment resolution on one authoritative deployment and plan migration before publishing. Private `/api/account/me` needs a valid Google bearer token. Tokens remain in the authenticated provider session, not GhostChat localStorage.

Mobile collection is not SMS verification. `mobileVerified` remains false. The number cannot be used to recover a wallet or redirect a payment. The directory is off-chain; it is not a decentralized name registry. Google wallet login does not log into Matrix or recover encryption keys.

## Testnet and mainnet deployment

`/setup` provides a selector for both networks. Testnet uses `/api/deployment`, mainnet `/api/mainnet-deployment`. Each registry checks the RPC chain, exact compiled creation transaction, successful receipt, two confirmations, canonical block and deployed code. Records cannot silently replace another deployment. Mainnet contract deployment sends a zero payment deposit but costs real MSTC gas. It does not enable mainnet P2P, mock-token trading or mainnet payment links.

Official MST SDK checks (read-only):

```powershell
npm run compile
npm run check:mst:sdk -w contracts
npm run check:mainnet -w contracts
```

Deploy using a funded dedicated signer configured only in the deployment shell:

```powershell
npm run deploy:testnet:sdk -w contracts
npm run deploy:mainnet -w contracts
```

The mainnet command needs `MST_MAINNET_PRIVATE_KEY`; testnet uses `MST_PRIVATE_KEY`. Do not put either in a VITE_ variable, source, frontend, screenshots or chat. CLI verifies the RPC chain and estimates gas/funds before signing. It saves a pending transaction immediately, waits for two confirmations, verifies the creation and writes `deployments/mst-mainnet.json` or `mst-testnet.json`. Restart the relay to load CLI deployment records, or register the transaction in `/setup` on the matching network. A pending record deliberately prevents another blind deployment after a timeout; inspect/register that transaction before retrying.

No deployer is currently configured and no contract was deployed by this change. Live SDK read checks passed for both networks. A read-only mainnet eth_call with state override successfully executed PUSH0/MCOPY (no on-chain state changed); compilation keeps the existing Cancun escrow target and Paris native/community overrides.

## Remaining external steps

1. Obtain the real SARAL authentication SDK and documentation from MST and implement its documented driver/server verification.
2. Configure the vendor project, Google OAuth client/origins and recovery settings. No credentials have been provided.
3. Configure private profile encryption and persistent deployment storage on the hosting server.
4. Test actual Google login, wallet persistence across logout/devices, provider events, profile registration and a signed MST testnet transfer.
5. Fund a dedicated deployer, deploy the contract to mainnet and retain its verified transaction/address for hackathon submission.
6. Migrate or explicitly retire the historical public username directory before publishing; do not point this build at the old Sepolia backend.

## Validation for this change

- 26 server tests pass, covering Google JWT checks, profile privacy, duplicate claims, replay/impersonation, persistence and mainnet/testnet separation.
- 48 frontend/protocol tests pass, including missing-SARAL handling and verified network switching through a unit-test adapter.
- Frontend/server TypeScript checks and production frontend build pass. Contract compilation passes without changing Solidity source.
- Browser verification confirms existing chat styling, disabled unconfigured Google sign-in, and both deployment networks. No real Google authentication, external messages, funded transfer or deployment was performed.
