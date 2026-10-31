# Low-cost domain and business email setup

Prices and plan descriptions checked against official sources on October 22, 2026. USD prices are indicative standard, non-premium domain prices; confirm availability, renewal, taxes and checkout currency before paying. Suggested names below have not been checked or reserved.

## Recommended route

Buy one low-renewal `.in` or `.com` domain and use Zoho Mail's free custom-domain plan if it is available for your signup region/data center. If the free plan is unavailable, compare its Mail Lite checkout price before committing. A mailbox must be able to receive the application verification and send a reply from the same domain.

| Option | Published registration / renewal | Assessment |
| --- | --- | --- |
| Porkbun `.in` | $7.83 / $7.83 per year | Low-cost option for an India-focused project |
| Cloudflare Registrar `.com` | $10.46 / $10.46 per year | Simple low-renewal option for a broader audience |
| Porkbun `.com` | $11.08 / $11.08 per year | Another straightforward choice |
| Existing `ghostpay-lac.vercel.app` | Existing hosted subdomain; no domain registration purchase | Keep for development/demo while obtaining an owned domain; it does not give you a matching business mailbox |

Sources: [Porkbun prices](https://porkbun.com/products/domains), [Cloudflare Registrar prices](https://pricing.registrar.cloudflare.com/). Registry prices may change, including renewal rates. A very low first-year offer may have a much larger renewal bill.

Possible names to search: `getghostpay.in`, `tryghostpay.in`, `ghostpayhq.com`, `getghostpayapp.com`. These are ideas, not availability or trademark-clearance claims. Use a registrar search yourself before choosing; do not buy a premium-priced exact name just for a credit application.

## Free options and their limits

The existing Vercel subdomain already provides a public demo URL without buying a domain. It is a hosted subdomain, not an independently owned root domain, and does not provide custom-domain mail. No universally available, permanent free `.com` or `.in` offer has been verified here. Student or temporary offers have their own eligibility and renewal conditions; do not build the application around an unverified free-domain promise.

[Zoho Mail Free](https://www.zoho.com/mail/zohomail-pricing.html) lists one custom domain, up to five users and 5 GB per user. IMAP/POP/ActiveSync are excluded. Its [subscription documentation](https://www.zoho.com/mail/help/adminconsole/subscription.html) says the free plan is available only in selected data centers/regions. Confirm the free plan actually appears for your account before selecting a paid trial or purchasing bundled services.

[Cloudflare Email Routing](https://developers.cloudflare.com/email-service/) can forward incoming business-address mail to Gmail on its free plan. Routing alone is not a full mailbox for ordinary two-way correspondence. Its newer outbound transactional email service is separate and arbitrary-recipient sending requires Workers Paid. For program replies, a proper Zoho or other authenticated custom-domain mailbox is the simpler choice. Do not assume forwarding automatically lets Gmail send authenticated mail from your domain.

## Exact setup order

1. Register one available domain in your own account; enable MFA and check renewal settings.
2. Attach it to the existing Vercel project using the exact DNS records displayed in that project's dashboard. Keep the current app alias while verifying the new domain. Do not guess an IP address from a generic guide.
3. Sign up for a custom-domain mailbox, verify domain ownership and create `prem@YOUR-DOMAIN` or `hello@YOUR-DOMAIN`.
4. Add the mail provider's exact MX and SPF/DKIM records. Use one coherent SPF record and set up DMARC according to the mail provider's guidance. Do not add competing MX configurations for both forwarding and the mailbox.
5. From an unrelated account, send to the new mailbox, then reply and verify the displayed From address and delivery.
6. Replace `project.email` in `frontend/src/company/content.ts`, update the startup profile/application contact and rebuild the app. Retain the Gmail address as a private recovery contact if desired.
7. Allow the new origin in Reown's dashboard, update relevant gateway origins/configuration and verify wallet connections. Matrix Google OIDC, if enabled later, has separate redirect/origin settings.
8. Use the same public domain and matching business email consistently in both applications. Google additionally needs its billing account ID privately; AWS needs the linked eligible account.

## Not included

No domain or mailbox has been purchased, registered, connected or verified by this code change. A domain does not create a registered company or establish program eligibility. Incorporation and cloud account acceptance remain separate factual questions.
