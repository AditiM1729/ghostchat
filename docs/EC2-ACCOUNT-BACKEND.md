# Account backend on the existing Matrix host

The installer adds the current GhostChat relay to the existing `ghostpay-matrix` Compose project. Synapse, its PostgreSQL database, server_name, signing keys and media volumes are retained. No account is manually created by this installer. Google identity linking to Matrix remains separate development work.

## Deployment

Pull the repository on EC2, then run `sudo node infra/matrix/install-relay.mjs --bundle /home/ubuntu/ghostchat-matrix --app https://ghostchat-rho.vercel.app --google-client-id YOUR_PUBLIC_WEB_CLIENT_ID`. The public Client ID is not a secret. The installer requires the existing private Matrix configuration and checks that it is operating on the expected Compose project.

The installer creates private `relay.env` containing the public client ID and frontend origin plus newly generated profile-encryption and test-attestor keys. Existing relay secrets are retained on repeat runs; inconsistent settings fail closed. Never publish that file or use a funded wallet key as the test attestor. Existing local development account data is not copied to EC2. This is a new hosted directory, so local usernames and backups are not automatically migrated.

Run the following as separate commands:

```sh
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix config --quiet
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix up -d --wait ghostchat-api
sudo docker compose --project-directory /home/ubuntu/ghostchat-matrix exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

The backend uses the Node 24 official image, a non-root UID, read-only repository mount and filesystem, dropped capabilities, and a separate persistent `relay_data` volume. A network-isolated setup container sets volume ownership. There is no published host port 3001. Caddy forwards `/api/*` to the private service and continues serving existing Matrix paths. A backup of the original Caddyfile is retained before changing it. If startup fails, inspect only the service logs, not private env files or expanded Compose configuration.

Confirm `https://ghostchat-matrix-pune.duckdns.org/api/account/config` responds with the intended public Client ID and `profileConfigured: true`. Then set Vercel production `GHOSTCHAT_API_ORIGIN=https://ghostchat-matrix-pune.duckdns.org` and redeploy. Google wallet login can then be tested with the authorized Vercel origin. The gateway preserves that origin for backend challenge validation.

## Runtime and maintenance

The bundled runtime in `server/runtime` is built with `node scripts/build-relay.mjs` after contract compilation, and includes public contract artifacts. This avoids building the entire frontend and contract toolchain on a small EC2 instance. It contains dependencies and third-party notices but no build-time environment files. Regenerate it whenever backend or shared code changes. Local server source execution prefers those prepared artifacts when available.

Back up the relay database volume together with the matching encryption key and attestor key. Do not reset the payment database while retaining an active attestor and escrows. Razorpay remains disabled until Test Mode credentials are added privately on EC2. No real INR or mainnet P2P is enabled. The relay rate limits currently apply to proxy egress collectively; review gateway-aware per-user quotas before a larger rollout.

This deploy does not enable Synapse OIDC, create a shared auth session or prove that two devices can exchange encrypted messages. Configure OIDC and implement verified same-identity session linking next. The application must not silently associate unrelated Google and Matrix accounts.
