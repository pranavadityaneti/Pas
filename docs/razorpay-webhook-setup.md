# Razorpay webhook — setup runbook

**Endpoint:** `POST https://api.pickatstore.io/webhooks/razorpay`
**Phase:** 2.E3 (committed 2026-06-04)

## What the webhook does

Catches the "merchant paid but signup didn't finalize" edge case. When the
merchant-app calls `Razorpay.open()` and the user pays successfully, Razorpay
captures the money. The app then needs to call `/payments/verify` and PATCH
`/auth/merchant/draft` to record the subscription. If the app crashes,
loses network, or is force-quit between the Razorpay success callback and
those API calls, the merchant is charged but our DB has no `subscriptions`
row.

The webhook is Razorpay's server-to-server safety net. Razorpay fires
`payment.captured` after the money settles; our handler checks if a matching
Subscription exists and creates the missing row if not.

## One-time setup (do this before launch)

### 1. Generate a webhook secret

Razorpay Dashboard → **Settings** → **Webhooks** → **Create new webhook**

- **Webhook URL:** `https://api.pickatstore.io/webhooks/razorpay`
- **Secret:** Click "Generate" or paste your own strong secret (32+ random bytes)
- **Active events** — tick at minimum:
  - `payment.captured`
  - `payment.failed`
- **Alert email:** your ops email so you're notified if deliveries start failing

Copy the secret somewhere safe — Razorpay shows it once.

### 2. Set RAZORPAY_WEBHOOK_SECRET on EB

```bash
cd apps/api
eb setenv RAZORPAY_WEBHOOK_SECRET=<the secret>
```

⚠ Per `ERRORS.md` "EB env-var changes break the app on Node 24 / AL2023" —
`eb setenv` alone DOES NOT re-install node_modules and crashes the app.
Pair it with a deploy:

```bash
eb setenv RAZORPAY_WEBHOOK_SECRET=<secret>
npm run build     # already done if this commit is fresh
eb deploy
```

Verify after deploy:

```bash
curl -s https://api.pickatstore.io/health
# expect 200
```

### 3. Verify webhook is reachable

In Razorpay Dashboard → Webhooks → click your webhook → **"Send test event"**.
The dashboard shows the response from our server. Expected: HTTP 200 with
body `{"received":true}`.

If you see 401: the secret you pasted in Razorpay's dashboard doesn't match
the `RAZORPAY_WEBHOOK_SECRET` in EB env vars.

If you see 503: env var isn't set.

If you see 500: handler crashed — check `eb logs` for stack trace.

## What gets logged

Every webhook prints a structured log line:

```
[razorpay-webhook] event= payment.captured eventId= evt_xxx paymentId= pay_xxx
[razorpay-webhook] Subscription already exists for paymentId= pay_xxx — idempotent no-op
[razorpay-webhook] Reconciled missing Subscription for merchant= 7c575305... paymentId= pay_xxx amount= 999
```

You can tail these via `eb logs` to confirm deliveries.

## What it WON'T do

- **Coupon redemptions are NOT auto-reconciled.** If the merchant applied
  a coupon and the finalize step never ran, the `merchant_signup_coupon_redemptions`
  row will be missing AND `used_count` won't be incremented. Too risky to
  auto-redeem from a webhook (the merchant didn't actually complete the
  flow inside the app). Surface these cases manually:

  ```sql
  -- Subscriptions reconciled via webhook (heuristic: created within 24h of payment)
  -- where the merchant has no coupon redemption record
  SELECT s.merchant_id, s.amount, s.transaction_id, s.created_at
  FROM subscriptions s
  LEFT JOIN merchant_signup_coupon_redemptions r ON r.merchant_id = s.merchant_id
  WHERE s.provider = 'razorpay'
    AND s.status = 'success'
    AND r.id IS NULL
    AND s.created_at > now() - interval '7 days';
  ```

- **Refunds.** No `refund.processed` handler yet. Manual refunds via the
  Razorpay dashboard work — but the `subscriptions.status` field won't
  auto-flip. Phase 2.E4 if needed.

- **Subscription renewal.** Lifetime plan, no recurring billing.

## Companion change in this commit

`POST /payments/create-order` now requires auth (Supabase token) when
`type === 'merchant'` and stuffs `notes.merchantId` + `notes.paymentType =
'merchant_signup'` into the Razorpay order. The webhook handler uses these
notes to map `payment.captured` events back to a specific merchant.

Consumer flows (`type !== 'merchant'`) are unchanged — no auth, no extra
notes.
