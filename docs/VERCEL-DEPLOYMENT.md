# GhostChat frontend deployment

Updated October 29, 2026: the EC2 relay is healthy and Synapse advertises `org.matrix.login.jwt`. A wallet-linked Matrix login and identity check succeeded, and the temporary verification device was logged out. Production GHOSTCHAT_API_ORIGIN is now set to the EC2 relay, and the latest prepared frontend was deployed through the Vercel CLI (deployment dpl_H228BUdwHseicUBesXLdG1WoqXd3). The public account configuration and /start return HTTP 200. The white, neon turquoise and electric chartreuse messenger, including the resizable Chats list, is published. Two independent users have not yet verified message delivery. The production payment deployment endpoint still reports configured:false; the local MST deployment record is separate from EC2 registration.

Deployed October 29, 2026 to https://ghostchat-rho.vercel.app using the separate `ghostchat` project in the currently authenticated Vercel account. The older `ghostpay` project was not overwritten.

The production frontend build contains the public homeserver setting `https://ghostchat-matrix-pune.duckdns.org`. Landing and onboarding routes were checked in a browser. The gateway's eight tests passed and the frontend build passed.

## Current operational boundary

The frontend and API gateway run on Vercel; the persistent account relay, Synapse and PostgreSQL run on EC2. Keep SQLite and Matrix data on EC2 volumes, not Vercel's ephemeral filesystem. Vercel's production `GHOSTCHAT_API_ORIGIN` is configured and its account gateway has been checked successfully. Never put Matrix signing secrets or profile encryption keys in browser-visible `VITE_` settings.

## Deployment and remaining verification

1. Completed for this release. For future releases, build the current frontend with `npm run build -w frontend`, then run `node scripts/sync-vercel.mjs`. The `vercel-site` deployment serves these prepared files; changing a Vercel variable does not rebuild an old static bundle automatically. Commit/push the latest source and prepared files if deploying through GitHub.
2. Completed through the CLI. In the existing Vercel project, production `GHOSTCHAT_API_ORIGIN` is `https://ghostchat-matrix-pune.duckdns.org`, without paths or credentials. The latest prepared `vercel-site` project was deployed.
3. If using a different public frontend hostname, add that exact HTTPS origin to the EC2 relay's private `FRONTEND_ORIGIN` allowlist and recreate the relay container. Preserve existing database, encryption and JWT keys.
4. Open the public app in two independent browsers with two BridgeKey wallets. Complete each profile and confirm real Matrix sessions. Create an encrypted conversation using the other person's Matrix ID, accept the invitation, and verify delivered messages in both directions. New-conversation input now accepts registered GhostChat usernames as well as complete Matrix IDs. Usernames resolve through the public profile directory to the same wallet-derived Matrix ID used by login; recipients must have opened chat once to create their Matrix account.
5. Separately test testnet payments if needed. Messaging does not require deploying a payment escrow. P2P still uses faucet tMSTC and mock INR; it is separate from real message delivery.

No private local environment file, signing key or SQLite database was intentionally uploaded. Vercel project linkage and CLI authentication data remain ignored. Raw Razorpay webhook verification must run on the persistent backend directly rather than this gateway's normalized JSON path.
