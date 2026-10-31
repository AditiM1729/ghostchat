# AWS Activate Founders — application draft

Status: prepared draft; not submitted. Apply through the [official credits page](https://aws.amazon.com/startups/credits/). Target Founders, initially $1,000, rather than a provider-backed package. The current [AWS application guide](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/?lang=en-US) describes self-funded eligibility, a functioning company website and matching business email. The credits page requires an AWS Paid Tier Plan. An Org ID is for a genuine Activate Provider affiliation; GhostPay has none.

## Factual fields

| Field | Current truthful answer |
| --- | --- |
| Product/trading name | GhostPay |
| Founder | Prem Bharne |
| Legal company name / registration | Not incorporated; confirm accepted applicant status with AWS |
| Project founded | October 2026, founder-confirmed; exact day not supplied; not an incorporation date |
| Location | Pune, India |
| Stage | Self-funded, pre-revenue testnet MVP; no revenue claimed |
| Funding | No external funding reported |
| Provider affiliation | None |
| Previous AWS startup credits | None reported by founder |
| Public contact | prembhrane455@gmail.com; replace application contact with verified business-domain email |
| Website | Existing app: https://ghostpay-lac.vercel.app; use the verified custom domain after setup |
| Source | https://github.com/prembharne/GHostPay |
| AWS account | Owner must create/confirm and link privately; do not put IDs in the repository |

## Product description

GhostPay is an early testnet MVP helping community organizers coordinate contributor payouts. Organizers can fund fixed wallet allocations, make direct native-coin transfers, or fund a payment link and later authorize the independently verified recipient wallet. Solidity contracts enforce claim eligibility, prevent repeated claims and support recovery of unclaimed allocations after expiry. Wallet-signed usernames connect a directory name to a wallet. Messaging integration and organizer reporting are being developed around this payment workflow.

## Customer problem and differentiation

Community organizers often coordinate contributor names, wallet addresses, payment approvals and payout follow-up across separate tools. GhostPay combines a recipient directory with funded allocations and explicit claim rules. A shared escrow link identifies a payment but does not authorize its withdrawal. The sender's approval is bound to the exact wallet, payment, network, contract and deadline. We are validating whether this workflow reduces coordination mistakes for small contributor communities. We do not claim a patented or unique escrow primitive.

## Stage and traction

We have implemented a React/TypeScript web app, Solidity payment contracts, a wallet-signed identity/claim relay and automated verification. The current product uses testnet coins. The founder has not reported paying customers, revenue, external funding or a live community pilot. The messaging UI has a local preview; production Matrix delivery still requires hosting and two-device verification. The P2P module uses mock tokens and simulated evidence, not real fiat payments.

## Business model

We plan to validate subscriptions for organizer workflow, payout coordination and reporting tools. No subscription or price has launched, and willingness to pay is unvalidated. The existing core escrow has no protocol fee; users pay network gas. Initial customer discovery will focus on community organizers and contributor teams.

## Why AWS / intended use of credits

We plan to use AWS to host the messaging infrastructure needed to turn the current local preview into a verified pilot: a small EC2 host running the prepared Synapse/PostgreSQL/Caddy configuration, persistent EBS storage, backup objects in S3 and capped CloudWatch logging/alarms. The existing frontend and Cloudflare claim/identity relay will initially remain in place. Moving the local Express relay to a cloud host requires a durable store and explicit migration plan; it is not currently a production-ready AWS backend.

Credits would support deployment, encrypted cross-device messaging verification, backup/restore exercises and a small organizer pilot. We will begin with a single-region, limited-capacity environment and review actual usage weekly. A provider calculator estimate and budget alerts will be set before resources are launched. See [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## Next 90 days — goals, not achieved milestones

- First 30 days: domain/mail setup, testnet browser lifecycle recording, transaction-recovery work, messaging host and access controls.
- Days 31–60: encrypted two-device verification, backup restore, monitoring and interviews with 5–10 prospective organizers.
- Days 61–90: seek 2–3 willing pilot communities, evaluate successful payout/claim flows and test willingness to pay for organizer tools. Pilot numbers are targets, not existing customers.

## Before submitting

- Confirm legal/applicant status; use the confirmed October 2026 project start and Pune, India. Supply an exact day only if requested and known.
- Set up the Paid Tier account, MFA, billing contact and usage budgets privately.
- Replace the Gmail application address with a working business-domain mailbox.
- Verify the website and walkthrough are published and accessible.
- Attach only real evidence; do not describe the local walkthrough as a completed public financial lifecycle.
- Keep the funding, customer and business-model answers consistent across website, application and profile.
