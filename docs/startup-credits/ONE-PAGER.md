# GhostPay

**Contributor payouts for community organizers.**

Founder: Prem Bharne · Pune, India · Project started October 2026

Public contact: prembhrane455@gmail.com · [Product overview](https://ghostpay-lac.vercel.app/about) · [Walkthrough](https://ghostpay-lac.vercel.app/demo) · [Source](https://github.com/prembharne/GHostPay)

## Customer and problem

Community organizers need to connect contributors to the correct wallets, communicate payout eligibility and follow up on claims. Those steps are often spread across messaging, spreadsheets and wallet transfers. GhostPay is being developed to bring recipient review, funding and claim coordination into one workflow.

## Product

- **Community funds:** fully fund immutable allocations for up to 100 unique wallets. Each eligible contributor claims a share; the organizer can refund unclaimed allocations after expiry.
- **Approved payment links:** fund before knowing the recipient address, share a link, independently verify the requesting wallet and sign an approval for that exact recipient. A copied link alone cannot withdraw funds.
- **Direct transfers:** resolve a wallet-linked username or review a full address, then send directly on a supported testnet.

## Current stage

Self-funded, pre-incorporation testnet MVP with a public web app, Solidity contracts, wallet-signed username/claim coordination and automated tests. There is no independent audit. External funding, paying customers and revenue are not claimed. The founder intends to seek venture funding.

Matrix messaging integration and hosting configuration are prepared, but live cross-device encrypted delivery still needs deployment and verification. The current messenger preview is local. The P2P module uses mock tokens and simulated evidence; real INR/UPI payment verification is not implemented.

## Business model hypothesis

Validate subscriptions for organizer payout workflow, coordination and reporting tools. Pricing is not launched. The core escrow currently has no protocol fee; network gas applies. Customer interviews and pilots will determine whether the proposed service addresses a paid need.

## Infrastructure request

Entry-level startup cloud credits would support a small messaging host, persistent data, encrypted backups, capped logs and monitoring for an invitation-only pilot. The existing Vercel frontend and Cloudflare claim/identity service would initially stay in place. AWS EC2/EBS/S3/CloudWatch and Google Compute Engine/Persistent Disk/Cloud Storage/Monitoring are alternative plans, not already deployed workloads.

## Next milestones

Record the real two-wallet testnet payment lifecycle, improve transaction recovery, verify encrypted messaging on two devices, exercise backups and interview 5–10 prospective organizers. Seek 2–3 pilot communities and validate willingness to pay. These numbers are future goals, not current traction.
