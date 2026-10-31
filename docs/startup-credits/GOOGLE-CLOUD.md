# Google for Startups Cloud — Start tier application draft

Status: prepared draft; not submitted. Start with the [pre-funded Start tier](https://cloud.google.com/startup/pre-funded) and consider the [Web3 route](https://cloud.google.com/startup/web3). This is not an AI-first product claim or a Scale-tier application. The current offer is $2,000, valid for 12 months.

The Start criteria include a working MVP, a clear business model, plans to seek venture funding soon, founding within the last 24 months and no Google Cloud credits beyond the free trial. The founder confirmed fundraising intent, no previous startup credits and an October 2026 project start. Exact founding day and accepted applicant legal status remain unconfirmed. A proposed but unvalidated business model may need further customer evidence; acceptance is discretionary.

## Factual fields

| Field | Current truthful answer |
| --- | --- |
| Project | GhostPay |
| Founder | Prem Bharne |
| Customer | Community organizers paying contributors |
| Legal status | Pre-incorporation; confirm whether accepted before submission |
| Project founded | October 2026, founder-confirmed; exact day not supplied; not an incorporation date |
| Founder/project location | Pune, India; no registered company office is claimed |
| Funding raised | No external funding reported |
| Fundraising plans | Founder intends to seek venture funding soon; timing/amount not yet specified |
| Business model | Proposed organizer-tool subscription; unvalidated and not launched |
| Previous Google startup credits | None reported; clarify any credits beyond the standard free trial |
| Website | https://ghostpay-lac.vercel.app; use the verified custom domain after setup |
| Contact | Current public contact prembhrane455@gmail.com; a matching business-domain application email is still needed |
| Billing ID | Enter the 18-character ID only in Google's official application; never commit it |

## Short product description

GhostPay helps community organizers coordinate contributor payouts through wallet-linked usernames, fully funded community allocations and sender-approved payment links. It is an early testnet web application: contracts enforce the intended wallet's claim rights and expiry/refund rules, while the app provides recipient review, claim coordination and local payment history. We are validating the organizer workflow before a production launch.

## Problem and customer

Contributor communities often rely on chat, spreadsheets and wallet transfers to track who is eligible for a payout and whether it was received. GhostPay aims to give organizers one workflow for reviewing destinations, funding allocations, sharing claim links and following completion. Our initial audience is small community organizers managing contributor payments. Customer interviews and pilots are planned; adoption is not yet claimed.

## Technology and current MVP

The application uses React, TypeScript and Solidity. An existing Cloudflare Worker/D1 service persists wallet-signed directory registrations and escrow claim requests; a Vercel frontend/gateway serves the public app. A Matrix SDK adapter and Synapse/PostgreSQL/Caddy configuration are prepared for encrypted community messaging. The current unconfigured messenger is a local preview, and cross-device delivery remains unverified. P2P settlement is a mock-token sandbox without real INR/UPI verification. The system is experimental, testnet-only and unaudited.

## Proposed business model

We intend to validate subscriptions for organizer coordination, payout workflow and reporting tools. No pricing has launched. The core escrow currently has no protocol fee. We will use customer discovery and pilots to test willingness to pay, define a narrow paid workflow and inform our fundraising plan. The current business-model hypothesis is not evidence of revenue or product-market fit.

## Why Google Cloud / credit use

We propose using Compute Engine with persistent disk to bring up the existing Synapse/PostgreSQL/Caddy messaging bundle, Cloud Storage for encrypted backup objects and controlled Cloud Logging/Monitoring. This would let us test two-device encrypted delivery, restore procedures and pilot availability. We would keep the existing Vercel frontend and Cloudflare relay initially, rather than claim that those services have already migrated to Google Cloud.

After pilot validation, a durable HTTP backend on Cloud Run with a managed database is an option requiring implementation, migration and cost review. The current Express relay is memory-only and does not become durable by being deployed to Cloud Run. Credits would fund eligible Google infrastructure, not blockchain gas, token purchases or third-party hosting bills. See [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## Roadmap and funding intent

The founder plans to seek venture funding. Immediate milestones are a verified testnet browser demo, reliable transaction recovery, live encrypted messaging and backup/restore verification. Next, we plan to interview 5–10 prospective organizers and seek 2–3 pilot communities. These are goals, not existing traction. We will develop a funding timeline and pitch from the pilot findings rather than invent a committed round or investor interest.

## Before submitting

- Use the confirmed October 2026 project start, which fits the current 24-month screening limit. Supply an exact day only if the form requests one and it is known.
- Confirm Google's treatment of the current unincorporated founder status; the [program agreement](https://cloud.google.com/terms/startup-program-tos) is framed as a company agreement.
- Set up an active billing account privately and a business email matching the public website domain, as requested in the [official FAQ](https://cloud.google.com/startup/faq).
- Publish the prepared public information and replace the Gmail application address with the verified business address.
- Record a testnet browser lifecycle and prepare a real infrastructure cost estimate.
- Review whether the business model and genuine near-term funding plan are sufficiently defined. Do not claim funding has been raised.
