# Preparation and release verification — October 22, 2026

## Public release

- Existing production alias: https://ghostpay-lac.vercel.app
- Vercel deployment: `dpl_AiC496zzYxaifqceCmS1kJcBiCTF`, returned `READY` for production.
- PWA build: `b9f0a9a67f9bf14d`.
- `/about`, `/demo`, `/privacy`, `/terms` and `/contact` each returned unauthenticated HTTP 200. Each complete HTML response matched the packaged local file exactly, including pre-rendered content.
- All 21 PWA precache files matched production bytes; service-worker/manifest cache and scope headers passed the existing release checker.
- Public `/api/health` and `/api/deployment` returned HTTP 200 with Ethereum Sepolia chain ID `11155111` and the existing escrow `0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4`.
- A read-only Sepolia check found on-chain code at the configured address. No wallet signature, deployment transaction, funding, claim or refund was submitted.

## Build and automated checks for this change

| Check | Observed result |
| --- | --- |
| Root production build (contracts/services/server/frontend) | Passed |
| Final frontend TypeScript and production build | Passed |
| Pre-rendered public information pages | 5 pages generated; packaged HTML and referenced assets verified |
| Frontend/messenger/wallet/PWA | 36 passing reports |
| Matrix configuration/readiness | 6 passing tests |
| Vercel gateway/quote service | 6 passing tests |
| Hosted Worker/identity service | 11 passing tests |
| Hosted Worker build and artifact validation | Passed |
| Repository diff whitespace check | Passed |
| Credit-readiness strict mode | Correctly remains incomplete for outstanding founder/account items |

The relevant automated suites above report 59 passing tests/reports. They include isolated fixtures and mock providers and do not establish a public-funded lifecycle. Contract and local server suites were also verified earlier in this chat before these presentation/release changes; their sources were not changed here. No new independent security audit or dependency audit is claimed.

## Verification limits

Browser visual and interactive QA was attempted twice against `http://127.0.0.1:5173`. The browser tool first reported declined access, then a saved permission/managed-policy denial after the founder stated access was allowed. No alternate browser or screenshot mechanism was used to bypass that setting. Public-page content was checked with React server rendering, packaged-file assertions and public HTTP responses; responsive visual layout, client-side step interactions and browser console state remain unverified.

A real two-wallet browser demonstration, community deployment/funding, physical-device PWA installation and live Matrix delivery remain pending. The walkthrough explains those flows; it does not fabricate successful transactions.

## Outstanding founder tasks

1. Obtain an owned domain and working business-domain mailbox.
2. Create/confirm eligible AWS and Google Cloud billing accounts privately.
3. Confirm each program accepts the current unincorporated applicant status.
4. Review an actual cloud calculator budget and usage alerts.
5. Record the public two-wallet testnet lifecycle and obtain genuine pilot feedback.
6. Resolve the saved browser permission and complete desktop/mobile visual QA.

No application was submitted, business account opened, company registered or domain/mailbox purchased. Public notices describe the MVP and do not establish legal or regulatory compliance.
