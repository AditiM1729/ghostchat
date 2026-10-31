# GhostChat on Vercel

This directory deploys a prebuilt GhostChat frontend and a restricted API gateway. It does not host Synapse or the persistent account and payment database.

Build from the repository root with the public Matrix setting, then sync:

```powershell
$env:VITE_MATRIX_HOMESERVER='https://ghostchat-matrix-pune.duckdns.org'
npm run build -w frontend
npm run sync:vercel
cd vercel-site
npm test
vercel deploy --prod --yes
```

The directory is now linked locally to the `ghostchat` Vercel project. The former `ghostpay` project remains separate. Neither local project metadata nor credentials belong in Git or the deployment bundle.

## Persistent backend

Deploy the current Node relay with durable SQLite storage separately, for example on EC2. Expose it through HTTPS and set `GHOSTCHAT_API_ORIGIN` to its HTTPS origin in Vercel production configuration. The gateway forwards only permitted `/api` routes, preserves bearer authorization and the frontend origin, and rejects cross-origin writes. Configure the relay's `FRONTEND_ORIGIN` with the exact deployed frontend origin.

Until that backend is configured, account and payment routes return a clear 503 setup message. They never fall back to the retired Sepolia relay. Pricing and read-only quote functions remain independent. Razorpay raw-body webhooks should target the persistent backend directly, not the JSON-normalizing gateway.

Google Cloud must allow the exact frontend origin. Matrix OIDC must use its existing HTTPS callback and allow the frontend redirect. Do not claim unified signup until the account backend, Synapse SSO and identity linking are connected and tested.

Private keys, OAuth secrets, wallet backups and local databases are excluded. Only public Matrix hostname configuration is embedded in browser assets.
