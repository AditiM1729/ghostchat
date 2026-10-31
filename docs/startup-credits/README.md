# GhostPay startup-credit application pack

Prepared October 22, 2026 for Prem Bharne. This pack prepares truthful application content; it does not represent approval, incorporation or a submitted application.

## Current position

GhostPay is a self-funded, pre-incorporation testnet MVP for community organizers paying contributors. Prem Bharne confirmed an October 2026 project start, Pune, India as his location, and plans to seek investor funding soon. No external funding, incubator affiliation, previous startup credits, paying customers or revenue are claimed. The project has an existing hosted app and a public source repository. A custom domain, business mailbox, cloud billing setup and applicant-status confirmation are still needed.

The software/application copy can be prepared now. An application is not ready to submit merely because all local builds pass.

## Start here

1. Read [domain and email options](DOMAIN-AND-EMAIL.md) and obtain one domain plus a mailbox that can both send and receive.
2. Use the founder-confirmed October 2026 project start and Pune, India. An exact day was not supplied; ask the founder only if the form requires it. This is not an incorporation date.
3. Ask each program whether your current unincorporated founder status is accepted. Do not invent a registered legal name, registration number or incorporation date. Google support is listed in its [official FAQ](https://cloud.google.com/startup/faq); AWS support is linked from its [credits page](https://aws.amazon.com/startups/credits/).
4. Create or verify the correct cloud account and its billing setup privately. Enable MFA and budget alerts before provisioning workloads.
5. Publish the new public pages on the intended website, attach the domain and verify `/about`, `/demo`, `/privacy`, `/terms` and `/contact` without signing in.
6. Complete and record the two-wallet testnet demo in [DEMO-AND-EVIDENCE.md](DEMO-AND-EVIDENCE.md).
7. Review [INFRASTRUCTURE.md](INFRASTRUCTURE.md) and save a real calculator estimate before requesting credits.
8. Review the [AWS](AWS-ACTIVATE.md) and [Google](GOOGLE-CLOUD.md) drafts and complete the missing factual fields in the application itself.

Run `npm run readiness:credits` for a local list of unfinished items. `npm run readiness:credits -- --strict` exits with a nonzero code while declared prerequisites remain incomplete. The checker uses founder-maintained declarations and does not query billing accounts or guarantee eligibility. Update `profile.json` only after an item is actually completed. Never put secrets or account identifiers in that tracked file.

## What is prepared

The pages are now published at [About](https://ghostpay-lac.vercel.app/about), [Walkthrough](https://ghostpay-lac.vercel.app/demo), [Privacy](https://ghostpay-lac.vercel.app/privacy), [Demo terms](https://ghostpay-lac.vercel.app/terms) and [Contact](https://ghostpay-lac.vercel.app/contact). See [VALIDATION.md](VALIDATION.md) for the exact production release and verification limits, and [ONE-PAGER.md](ONE-PAGER.md) for a shareable project brief.

- Public product positioning for community contributor payouts, with founder contact and clear testnet limitations.
- An interactive explanatory walkthrough that needs no wallet and creates no transactions.
- Plain-language privacy and demo-use notices describing the existing MVP; these are not legal/compliance certification.
- Pre-rendered information pages so reviewers can read the project description and contact details without waiting for wallet libraries or JavaScript.
- Separate program-specific application answers, infrastructure plans, pilot goals and domain/email setup instructions.
- CI coverage for the hosted Worker/identity service, in addition to existing contracts, server, frontend, Matrix and gateway checks.

## What must remain accurate

Present the working scope: escrow, fixed community allocations, direct testnet transfers, wallet-signed usernames and a messenger integration foundation. Disclose that live Matrix delivery, public funded lifecycles on additional networks, durable pending-transaction recovery and independent audit remain unfinished. The P2P sandbox does not verify real INR/UPI payments.

The walkthrough is educational, not evidence of a completed transaction. Test counts, source code and old deployment records cannot substitute for a recorded live browser lifecycle. Any later public verification should record its date, URL, build version and evidence.

## Program sources checked October 22, 2026

- [Google Start tier](https://cloud.google.com/startup/pre-funded): $2,000 for 12 months; working MVP, clear business model, venture-funding plans, founded within 24 months and no credits beyond the free trial.
- [Google application FAQ](https://cloud.google.com/startup/faq): matching business-domain email and an 18-character billing account ID.
- [Google Web3](https://cloud.google.com/startup/web3): Web3-specific route with Start and Scale tiers.
- [AWS credits](https://aws.amazon.com/startups/credits/): Founders starts at $1,000; selected participants may receive more, up to $5,000; Paid Tier account and startup eligibility apply.
- [AWS application guide](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/?lang=en-US): functioning company website and a domain-matching business email for the Activate profile/application.

Benefits and eligibility can change. Recheck the actual application before submission. Credits apply to eligible provider services; they do not pay blockchain gas or existing Vercel/Cloudflare bills. Costs above credits, excluded services and expired credits remain the account holder's responsibility.
