# Razorpay mock INR and native tMSTC demo

Implemented October 29, 2026. This path uses **Razorpay Test Mode and native faucet tMSTC on MST Testnet (91562037)**. It cannot deploy its escrow on MST Mainnet. No real INR is collected or credited to a seller. The mock INR amount is a demonstration amount, not an exchange-rate quote. The entire deposited tMSTC goes to the named buyer, with no protocol fee.

## Local activation

1. In Razorpay's Dashboard select Test Mode and obtain test API credentials. Use only the `rzp_test_…` Key ID. Follow [Razorpay's integration instructions](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and enable automatic capture for this demonstration.
2. Add the following to the ignored project-root `.env`. These are server settings; never use `VITE_` for secrets:

   ```dotenv
   RAZORPAY_TEST_KEY_ID=rzp_test_your_key_id
   RAZORPAY_TEST_KEY_SECRET=your_test_key_secret
   ```

3. Run `node scripts/configure-test-payments.mjs` once to create a separate random `TEST_PAYMENT_ATTESTOR_KEY` locally. This was run during implementation. Do not fund its address, use a wallet's funded private key, or change it while its escrows are in use. Back it up privately if existing demos must remain usable.
4. Compile and generate artifacts with `npm run compile` and `npm run build:services`. Restart the relay (`npm run dev -w server` from the project root) and run the frontend. `GET /api/p2p/test-payments/config` reports configuration status and the public attestor address, never a secret.
5. Open the existing P2P popup at `/trade`. Both seller and buyer need different wallets and faucet tMSTC for gas. Seller needs enough for the deposit too. [MST faucet](https://faucet.mstblockchain.com/).

Test Checkout requires a real Razorpay test account and allowed origins/account settings. Use currently supported Test Mode payment methods from its Dashboard/docs. If UPI simulation is unavailable for the account, another supported simulated Checkout method exercises the same payment-to-token-release flow; do not claim that a real UPI transfer occurred.

## Demonstration flow

1. Seller acknowledges test-only use, unlocks their wallet and deploys `GhostChatTestTrade` with the relay's public test attestor address.
2. Seller enters a different buyer wallet, native tMSTC amount and mock INR amount, then funds the offer. Limits: greater than zero and at most 10 tMSTC; mock INR ₹1–₹100,000. Offer expires after one hour in the UI.
3. Copy the complete trade link and open it as the buyer. The app checks the exact creation transaction/initcode including the attestor, runtime code, chain and two confirmations.
4. Buyer accepts the immutable on-chain terms. This starts a 30-minute payment window.
5. Buyer selects **Pay mock INR**, authorizes a signed payment request and completes Razorpay Test Checkout. No genuine bank transfer should be made.
6. The server validates the callback signature and independently fetches payment and order status. Only an exact, fully captured, unrefunded test payment bound to that stored order qualifies. Its payment creation time must fall inside the accepted trade window. Capture time is not inferred to be bank settlement time.
7. A dedicated server key signs a test-only EIP-712 payment attestation. Buyer approves the testnet settlement transaction; the contract pays the fixed buyer and records release. This is an explicit wallet approval, not a gas-sponsored automatic relayer.
8. On-screen status and explorer link report the confirmed release. **Check payment & release** recovers a completed test payment if Checkout was closed or its callback was lost. It also works without public webhook delivery. The wallet may request another short-lived authorization signature.

The native popup temporarily closes while Razorpay's body-level Checkout overlay is open and reopens afterward; the messenger layout remains the same.

## Notifications

The popup reports payment verification and confirmed token release. It does not implement SMS, email delivery or OS push notifications.

Optionally configure a public HTTPS **Test Mode** webhook:

```text
POST https://YOUR_RELAY_HOST/api/p2p/test-payments/webhook
Events: payment.captured, order.paid
```

Save that endpoint's separate signing secret as `RAZORPAY_TEST_WEBHOOK_SECRET` in `.env`, then restart. The relay verifies the raw-body HMAC and fetches the payment again. Duplicate notifications are harmless. Webhooks record payment verification; they do not spend from the server wallet. The buyer still submits settlement. Localhost cannot directly receive Razorpay webhooks; see [its current testing restrictions](https://razorpay.com/docs/webhooks/validate-test/).

## Boundaries and recovery

- SQLite in `data/test-payments.sqlite` durably binds one order per escrow/trade and one payment per order allocation. The server verifies the exact canonical creation transaction, deployed code and configured attestor before issuing orders or attestations.
- A creation request is reserved before calling Razorpay. If its result is uncertain, the app refuses to recreate it. Inspect the receipt/order in the Test Dashboard; there is no automatic unsafe duplicate-order recovery endpoint. Cancel/return the test allocation and use a fresh offer if necessary.
- The browser retains only public escrow/transaction references for recovery, not full financial receipts or payment signatures. A submitted transaction must be checked before another write. Keep the original trade link. If a transaction is indefinitely pending, resolve its nonce/replacement in the wallet before clearing any recovery entry.
- Seller can cancel an unaccepted offer. After acceptance only the buyer can intentionally return the allocation. No timeout sweep is provided. If the buyer disappears or the attestor key is lost, accepted test funds may remain locked; use faucet tokens only.
- Attestations expire seven days after the payment window. Payment replay is prevented on-chain per escrow and across this relay's allocations by a unique payment record. This is not a global multi-provider or cross-chain payment registry. Keep one authoritative database and do not reset it under an existing signer.
- This is trusted server verification, **not a ZK proof**, seller bank credit confirmation, an independent security audit or live trading approval. Razorpay's [current terms](https://razorpay.com/terms/) prohibit cryptocurrency activity; Test Mode implementation does not authorize a live launch.
- The server accepts only test Key IDs. Live keys and mainnet escrow deployment are rejected. No funded public escrow or actual Razorpay payment was created during implementation without the owner's credentials and wallet approvals.
- Legacy gpUSD sandbox links still work; `/trade?mode=legacy` opens that separate older demonstration.

## Validation

Contract tests exercise exact native payout, forged/mutated evidence, duplicate and cross-escrow settlement, mainnet rejection, timing and refund permissions. Server tests use a simulated Razorpay HTTP service to exercise authentication, signature checks, independent capture/order validation, tampered callbacks, raw webhook integrity, idempotency and SQLite restart recovery. Passing these tests does not establish live Razorpay account access or a funded MST Testnet end-to-end run.

An integrated test also runs the server verification service against a simulated Razorpay response and an actual local EVM configured with MST Testnet's chain ID: pending payment retains escrow, captured payment generates settlement permission, and submitting it transfers the exact native balance to the buyer. No public network transaction or real Razorpay account is used by that test.
