> Historical: active Google onboarding has been replaced by BridgeKey. See [current workflow](BRIDGEKEY-ONBOARDING.md). Existing encrypted backups are retained and are not converted into BridgeKey wallets.

# GhostChat Google sign-in and encrypted MST wallet

Updated October 29, 2026. This replaces the active SARAL placeholder; no external wallet extension or SARAL SDK is needed.

## User workflow

1. Open `/`, keep the original landing page, and choose Ready to start.
2. On `/start`, use the official Google Identity Services button. GhostChat verifies the Google ID token server-side against Google's JWKS, audience, issuer, expiry and verified email; the login nonce is issued by the server, expires in five minutes and is single-use.
3. On first use, choose and confirm a wallet password of at least 12 characters. A random EVM wallet is generated **in the browser** and encrypted with the standard V3 scrypt/AES keystore format through ethers. No private key is derived from a Google ID, email or OAuth token. The browser signs a server-issued challenge binding the encrypted backup hash, address, origin and Google identity. The backend cannot silently replace an existing wallet backup.
4. GhostChat stores that encrypted backup against the verified Google subject. The password and plaintext key are never sent to its backend. On another login/device, Google retrieves the same encrypted backup and the wallet password unlocks the same address. An incorrect password fails; Google cannot reset or recover that password.
5. Complete name, mobile and a unique username. Name is pre-filled from the server-verified Google profile. The existing wallet-signed profile registration binds the public username to this wallet. Mobile stays private and unverified; no SMS service is enabled.
6. Enter the chat workspace. Google wallet access and Matrix messaging remain separate sessions; deploying and configuring a real Matrix homeserver is still needed for live encrypted chat.

## Wallet behavior

The connector supports only MST Testnet (91562037) and MST Mainnet (4646). Every message signature, typed authorization and transaction uses an explicit in-app approval dialog. The transaction dialog displays the network, recipient or deployment, value, maximum prepared gas fee and full transaction data. Unsupported methods such as eth_sign, eth_sendRawTransaction, permission delegation and unrecognized transaction fields fail closed. Signature domains and transaction identity/network are checked before signing. Gas is estimated/prepared and the actual RPC chain is verified before a transaction review. Mainnet P2P and mainnet payment-link features remain disabled separately.

The decrypted wallet lives in browser memory, locks after ten minutes without a signing operation, and is cleared on sign-out or Google-session expiry. Reloading requires Google sign-in and wallet unlock. The wallet screen can download a password-encrypted backup file. Keep the backup and password separately; loss of the password means loss of access to this wallet's funds. Keep the server database and PROFILE_ENCRYPTION_KEY backed up as well, because the latter protects private name/mobile details.

This is a conventional browser wallet integrated with Google identity. It is **not** SARAL MPC, ERC-4337 account abstraction, a paymaster, passkey recovery or ZK privacy. The application's JavaScript can access the signing key while it is unlocked. The custom provider needs independent security review before handling valuable mainnet assets. No Google login by itself guarantees recovery, transaction privacy or sponsored gas.

## Configuration

The supplied public Web Client ID is configured locally in the ignored root `.env`. The helper generated a private profile-encryption key without printing it. No Google client secret is needed by this callback-based flow.

For another environment:

```powershell
node scripts/configure-google.mjs YOUR_PUBLIC_WEB_CLIENT_ID.apps.googleusercontent.com
npm start
```

In Google Cloud's OAuth Web client, allow the exact JavaScript origins:
- `http://localhost`
- `http://localhost:5173`
- `http://127.0.0.1:5173` if using that hostname
- Your actual HTTPS production origin when publishing

Use the Web application client type, configure GhostChat branding, and add test users if Google's project audience is restricted to testing. This JavaScript callback flow does not need a client secret or an OAuth redirect URI. The GIS script is loaded directly from Google's official URL. If CSP/COOP are set by the production host, follow Google's setup guide so the script, Google frames and popup communication are allowed. Client ID and origins must belong to the same configured Google project.

The public `/api/account/config` returns only the public client ID, readiness of private profile storage, and the wallet mode. ID tokens and decrypted keys remain in memory; service workers do not cache account APIs. The existing historical hosted release was not changed or deployed by this task. Before production, port these routes and database into a persistent deployment; do not point the new frontend at the old hosted Sepolia identity service.

## Endpoints and storage

Unauthenticated config and Google nonce/login endpoints are rate-limited. Authenticated `/api/account/wallet` returns only that Google subject's encrypted backup. `/wallet/challenge` and `/wallet/complete` check allowed origins and require the new wallet's signature. SQLite transactions and unique subject/address constraints prevent races and replacement. Backups accept only bounded V3 scrypt keystores and normalize away arbitrary extra fields. Public username lookup still omits phone, name, Google subject and encrypted backup data.

`data/accounts.sqlite` stores encrypted wallet backups, account mappings and expiring nonces; it is ignored by Git. PROFILE_ENCRYPTION_KEY encrypts name/mobile data; it does not decrypt the password-protected wallet. There is no developer backdoor, plaintext-key export API or password-reset endpoint.

## Validation and limits

- 28 server tests pass, covering Google JWT checks, nonce expiry/replay, encrypted backup ownership/restoration, bad passwords, duplicate mappings and private data separation.
- 54 frontend/provider tests pass, including explicit approvals, cancellation, lock during approval, signing identity, unsupported methods and non-MST networks. They do not broadcast transactions. Frontend/server builds pass. The user screenshot confirms the official Google button renders.
- Real Google consent, first signup, restoration on another device and an actual signed MST transaction still need user testing. No funded transaction or mainnet deployment was submitted by this work.

## Official references

- https://developers.google.com/identity/gsi/web/guides/overview
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://docs.ethers.org/v6/api/wallet/#json-wallets
