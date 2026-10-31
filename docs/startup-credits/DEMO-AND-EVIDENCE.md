# Demo and evidence checklist

The `/demo` page is a wallet-free explanation. It is not a simulated success screen or proof that a public transaction occurred. Use it to orient reviewers, then demonstrate the actual app with test coins. The following manual checks remain pending until the founder completes them.

## Two-wallet escrow recording

Use separate browser profiles/devices and wallets A (organizer) and B (contributor), both with Sepolia test ETH for gas. Never record seed phrases, passwords, recovery files or private keys. Use a small test amount and enough expiry time to avoid rushing.

1. Show `/about` and explain the customer problem and testnet-only status.
2. Open `/create?mode=link`, choose Sepolia, review the exact deposit, then let A confirm funding. Record the explorer transaction hash, contract, payment ID and shareable link.
3. Open the link as B, request a claim and explain that this signature proves wallet control, not real-world identity.
4. As A, independently verify B's full wallet address through a trusted channel. Approve the exact recipient in `/dashboard` and explain that the approval has a deadline.
5. As B, claim. Show the successful receipt and final on-chain payment state. Show that a completed payment cannot be claimed again. Save the transaction hash.
6. With a separate payment, wait for actual expiry and let A refund. Show the successful refund receipt. Do not time-travel a public network or describe a pending transaction as successful.

Optionally show a third unapproved wallet is unable to claim, without broadcasting a transaction expected to fail. A reverted contract call on an isolated test network is sufficient automated evidence of this rejection boundary.

## Community payout recording

Use `/create?mode=community` to demonstrate the target customer workflow. A new community contract deployment requires the founder to review/sign the deployment and fund the testnet gas. No community deployment is claimed in this pack.

1. Review a supported testnet and verified deployment provenance.
2. Enter two controlled eligible wallets with positive allocations; review full addresses and exact totals.
3. Fund the complete pool, share its campaign link, claim each allocation from its eligible wallet and verify the remaining amount.
4. Demonstrate one unclaimed allocation refund only after expiry, using a separate campaign if needed.

## Evidence record template

Record these in a private pilot log; publish only non-sensitive transaction identifiers and consented screenshots:

| Item | Value to record |
| --- | --- |
| Verification date | Actual date/time with timezone |
| App origin and build | Domain and `pwa-build.json` version |
| Network | Chain name and numeric ID |
| Contract | Exact address and deployment proof where required |
| Deposit / claim / refund | Full transaction hashes and successful receipts |
| User experience | Separate browser profiles/devices used; any observed errors |
| Public demo | Recording link, only after reviewed for sensitive information |

## Pilot plan — future goals

Interview 5–10 organizers about payout frequency, current coordination tools, wallet mistakes and willingness to pay. Seek 2–3 consenting pilot communities. Measure completed testnet payouts, claim completion, support requests and workflow friction. Record the sample size and dates. Do not turn interview targets into a claim of customers, revenue or adoption.

## Engineering checks

```powershell
npm run build
npm test
npm run test:messenger
npm run test:matrix
npm test --prefix vercel-site
npm ci --prefix public-site
npm run build --prefix public-site
npm test --prefix public-site
npm run validate --prefix public-site
npm run readiness:credits
```

Automated tests run on isolated networks, mocked RPCs or local storage adapters as appropriate. They are not an independent audit or a public-funded lifecycle. Record observed results in `VALIDATION.md`; do not keep old counts as if they were a new run.
