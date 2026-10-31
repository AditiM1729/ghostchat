# BridgeKey onboarding and Matrix account provisioning

October 29, 2026. This replaces the previous Google embedded-wallet onboarding. The existing landing page, onboarding page, chat layout and payment popups are retained.

## User workflow

1. Open GhostChat and select Continue.
2. Install and unlock the official [BridgeKey extension](https://bridgekey.io/). Create or import the intended wallet inside BridgeKey, never in a GhostChat form.
3. Select Connect BridgeKey. The app selects a single named BridgeKey browser provider and requests MST Testnet.
4. Select Sign in with BridgeKey and review the login message in the extension. It includes the app origin, wallet address, random nonce and five-minute expiry. It authorizes login, not a transaction.
5. Complete name, mobile and unique public username. Approve the separate signed profile registration. Name and mobile are encrypted at rest; the phone number is not verified. Username and wallet are public.
6. The authenticated relay issues a 60-second Matrix login ticket. Synapse creates the wallet's Matrix account on its first JWT login. Its localpart is `w_` followed by the lowercase wallet address without `0x`, independent of private name, phone or editable display name.
7. Open the messenger. Reconnecting the same wallet returns to the same Matrix identity. A new device still needs Matrix encryption verification and recovery to read earlier encrypted messages.
8. Every payment approval happens in BridgeKey. P2P remains native tMSTC on MST Testnet plus Razorpay Test Mode; no real INR or mainnet P2P settlement is enabled.

## Requirements

- Official BridgeKey extension installed in a supported desktop browser, with an unlocked wallet. Verify its publisher through the official site. Its named injected provider must support browser discovery, message signing, chain switching and transaction approval. Generic or ambiguous providers fail closed. Actual extension compatibility must be checked on the user's machine; no private SDK or wallet credentials are required by this integration.
- MST Testnet chain ID `91562037`, RPC `https://testnetrpc.mstblockchain.com`, native coin tMSTC; fund gas with test coins. MST Mainnet chain ID `4646` remains separately configured for wallet/deployment use; the test trading flow cannot settle there.
- Persistent Node 24 relay, existing profile encryption key, HTTPS frontend origin and wallet sessions database. Login tokens are random, valid for one hour and stored only as SHA-256 hashes on the server. Browser login tokens are kept in memory; a page reload requires another login signature.
- Synapse with JWT support, stable server name, PostgreSQL, HTTPS and the same private `MATRIX_JWT_SECRET` as the relay. This backend is trusted to issue Matrix identities; this is not decentralized identity attestation or a ZK proof.
- Vercel `GHOSTCHAT_API_ORIGIN` pointing to the verified relay HTTPS origin. `VITE_MATRIX_HOMESERVER` is public; signing/encryption secrets must never use a `VITE_` prefix.
- Razorpay test credentials only if testing mock INR Checkout. They are unrelated to login.

## Upgrade the existing EC2 bundle

Use the existing repo and private bundle; do not regenerate homeserver configuration, delete volumes or change server_name. The installer preserves profile encryption, payment attestor, database and Synapse secrets. It adds a shared JWT key once, backs up the old homeserver configuration and disables the generated Google provider if present. Unknown authentication configurations cause an error for deliberate review.

```sh
cd /home/ubuntu/ghostchat
git pull origin main
sudo node infra/matrix/install-relay.mjs --bundle /home/ubuntu/ghostchat-matrix --app https://ghostchat-rho.vercel.app
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix config --quiet
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix up -d --wait --force-recreate ghostchat-api
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix restart synapse
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

The installer fixes the previous relative `COMPOSE_FILE` issue using absolute paths. The bundle remains private; there is no need to enter it with `cd`. It does not display secrets. If startup fails, inspect only bounded container logs; never paste private YAML or `relay.env` into chat.

Verify readiness:

```sh
curl -fsS https://ghostchat-matrix-pune.duckdns.org/api/account/config
curl -fsS https://ghostchat-matrix-pune.duckdns.org/_matrix/client/v3/login
```

Expected: `walletMode` is `bridgekey`, `profileConfigured` and `matrixConfigured` are true; Matrix login flows include `org.matrix.login.jwt`. Config flags alone do not verify a successful login. Then set the Vercel backend origin and redeploy before testing two real extension sessions.

Private backups must include `relay.env`, the relay_data volume, PostgreSQL, Synapse data and encryption recovery data. The JWT secret can mint Matrix login tickets: protect it like a server credential. Tickets are short-lived bearer credentials, not one-use Matrix proofs; only wallet login challenges are consumed once.

## Existing Google accounts and recovery

Google endpoints and the embedded-wallet connector are removed from the active application flow and gateway. Historical source, tests and encrypted backup records are retained to avoid destroying existing user recovery data. The app never automatically moves an old wallet key into BridgeKey. A profile with the same proven wallet address can be read after BridgeKey login; a different wallet cannot claim its username. Old Matrix accounts are not silently merged into the new wallet identity, and older encrypted conversations need their original encryption keys and account migration planning.

## Verification boundary

Automated checks cover signed challenge ownership, origin binding, expiry, replay rejection, hashed session persistence/logout, profile isolation, Matrix ticket subject/audience/expiry, gateway routing and idempotent secret-preserving migration. A production frontend build is separate from EC2 activation. Actual BridgeKey extension discovery, funded MST transactions, real Synapse JWT account creation and two-device encryption must be verified after deploying the migration. No claim of live real-INR trading or implemented ZK proofs is made.

Upstream references: [EIP-6963 provider discovery](https://eips.ethereum.org/EIPS/eip-6963), [Synapse JWT login](https://element-hq.github.io/synapse/latest/jwt.html).
