# Wati / WhatsApp Automation Spec — PickAtStore

**Author:** engineering · **Drafted:** 2026-06-02 · **Owner of Wati config:** Pranav / ops

This is the single source of truth for every WhatsApp message PickAtStore sends or
receives via Wati. Hand it to whoever sets up Wati / submits Meta templates and they
can work end-to-end from this doc.

## TL;DR

There are two surfaces:

- **Outbound (we send to user)** — must use a Meta-approved **template**. We submit, Meta reviews (24-48h), Wati exposes the template, our backend calls Wati's `sendTemplateMessage` API. We have **1 live today (OTP)** and **12 to add** (10 utility + 2 marketing).
- **Inbound (user starts chat)** — when the customer taps **"Chat with us on WhatsApp"** in the app, WhatsApp opens with a prefilled "Hi, I need help with my order." The first inbound message triggers a **Wati chatbot flow** built in Wati's dashboard (no Meta approval required for inbound automation — we just need a chatbot config).

## Glossary (read once, keeps the rest of the doc short)

| Term | What it means |
|---|---|
| **Template** | Pre-written WhatsApp message format approved by Meta. Required for any message we initiate. Body uses positional vars `{{1}}`, `{{2}}`, etc. |
| **Session message** | Free text WhatsApp can send during the 24-hour window after the user's last reply. We use these inside chatbot flows for follow-up Q&A. |
| **Category** | Meta classifies templates as AUTHENTICATION (OTP), UTILITY (transactional), or MARKETING (promotions). Marketing requires explicit opt-in. |
| **Chatbot** | Wati's drag-drop flow builder for handling inbound user messages. Replies, buttons, branching, agent handoff. |
| **Variable** | Placeholder in template body replaced at send time. Wati expects positional indices: `{{1}}`, `{{2}}`. Our existing `sendOtp` uses `{ name: '1', value: otp }`. |

---

# PART A — Inbound chatbot ("Chat with us on WhatsApp")

When the customer taps the Chat-with-us row in the app (added 2026-06-02 in consumer
`SupportScreen` + merchant `settings/support.tsx`), WhatsApp opens with the prefilled
message "Hi, I need help with my order." This first inbound message triggers the
chatbot. **No Meta approval needed for any of this** — it's all inside the
24-hour session window.

## Build this flow in Wati Dashboard → Chatbots → Create

### Node 1 — Trigger

- **Trigger type:** New conversation OR keyword match
- **Match condition:** `*` (catch-all — any incoming message starts the flow)

### Node 2 — Welcome message

**Send (session message):**

> Hi 👋 I'm PickAtStore's support assistant. How can I help you today?

**Reply buttons** (Wati supports up to 3 buttons per interactive message):

1. 📦 Order help
2. ↩️ Cancel / Refund
3. 🧑‍💼 Talk to a human

### Node 3 — Branch on user button choice

#### Branch A — "Order help"

**Send:** Please share your order number (it looks like `#1234`) so we can look it up.

**Wait** for user input → assign conversation to **Support queue** with tag
`order-help` and broadcast message "Customer needs help with order — order number
in last message above."

#### Branch B — "Cancel / Refund"

**Send:** I can help with:

1. Cancelling an order **before pickup**
2. Refund / issue with an order you already received

**Reply buttons:**

1. Cancel order (pre-pickup)
2. Refund for received order

**Sub-branch B1 — Cancel pre-pickup:**

> Share your order number (`#1234`). If pickup hasn't started, our team will cancel
> it within ~30 minutes and refund automatically. Refunds reflect in 5-7 business
> days.

→ Assign to Support queue, tag `cancel-request`.

**Sub-branch B2 — Refund for received order:**

> We're sorry to hear that. Briefly describe the issue (damaged, wrong item, etc.)
> and share your order number (`#1234`). Our team will review and reply within 2
> hours during business hours.

→ Assign to Support queue, tag `refund-request`.

#### Branch C — "Talk to a human"

**Send:** Connecting you to a support agent. Average wait time is **5 minutes**
during business hours (10am – 8pm IST). Outside hours, please email
support@pickatstore.io and we'll reply the next morning.

→ Assign to Support queue with default tag.

### Node 4 — Fallback (free text not matching a button)

If the user types free text instead of tapping a button:

**Send (session message):**

> I didn't catch that. Tap one of the buttons above, or type one of:
> - `order` → order help
> - `cancel` → cancel / refund
> - `agent` → talk to a human

Loop back to Node 2 if no match after a single retry.

### Configuration notes for the Wati admin

- **Business hours:** 10am – 8pm IST. Set this in Wati under Settings → Business
  Hours so the "human" branch can show outside-hours messaging.
- **Support queue:** create one team called `Support` and add the
  founder + ops + any human agents. Assign all branches to this team.
- **Tags:** `order-help`, `cancel-request`, `refund-request`. Useful later for
  exporting WhatsApp tickets to admin tooling.
- **Session timeout:** if user goes silent for >24h mid-flow, Wati auto-closes the
  session. That's fine — we don't need to re-engage with templates here.

---

# PART B — Outbound templates (Meta approval required)

12 templates to submit for approval. **Already live: `otp`.** Submit the rest as a
batch — Meta usually responds in 24-48 hours per template.

## Naming convention

Use lowercase + underscores: `order_placed`, `dining_confirmed`. Wati treats the
template name as the API identifier. Our `wati.service.ts` reads each one from an
env var (e.g., `WATI_TEMPLATE_ORDER_PLACED`) so renaming in Wati doesn't break
code.

## Template categories

| Category | Use | Opt-in required? |
|---|---|---|
| AUTHENTICATION | OTP only | No |
| UTILITY | Transactional (order updates, account status, refunds) | No — assumed acceptable for users you have a business relationship with |
| MARKETING | Promotions, re-engagement, coupons | Yes — explicit opt-in needed |

---

## CUSTOMER templates (10)

### 1. `order_placed` — UTILITY · category UTILITY

Fires after Razorpay payment success.

**Body:**
```
Hi {{1}}, your order at {{2}} is confirmed. Order #{{3}}, total ₹{{4}}.

We'll notify you the moment the store accepts it. Thanks for choosing PickAtStore!
```

**Variables:**
| # | What | Example |
|---|---|---|
| 1 | Customer first name | `Pranav` |
| 2 | Store name | `Folli Banjara` |
| 3 | Order number | `1234` |
| 4 | Total (₹) | `425` |

**Buttons (optional):** `View Order` → deeplink `pas://orders/1234`

**Triggered from:** `POST /orders` success handler (after Razorpay verifies) — `apps/api/src/index.ts`

---

### 2. `order_accepted` — UTILITY

Fires when merchant taps Accept.

**Body:**
```
Great news, {{1}}! {{2}} has accepted your order #{{3}}.

Estimated ready time: {{4}}. We'll let you know when it's ready for pickup.
```

**Variables:**
| # | What | Example |
|---|---|---|
| 1 | Customer first name | `Pranav` |
| 2 | Store name | `Folli Banjara` |
| 3 | Order number | `1234` |
| 4 | Ready time | `4:30 PM` |

**Buttons:** `View Order`

**Triggered from:** `POST /orders/:id/accept` (merchant accept endpoint)

---

### 3. `order_ready` — UTILITY ⭐ critical

Fires when merchant taps Mark Ready.

**Body:**
```
Your order #{{1}} from {{2}} is ready! 🎉

Show this pickup OTP at the counter:

*{{3}}*

Pickup before {{4}}.
```

**Variables:**
| # | What | Example |
|---|---|---|
| 1 | Order number | `1234` |
| 2 | Store name | `Folli Banjara` |
| 3 | 4-digit pickup OTP | `7392` |
| 4 | Latest pickup time | `7:00 PM` |

**Buttons:** *None* — the OTP is the whole point, don't dilute it.

**Triggered from:** `POST /orders/:id/mark-ready`

---

### 4. `order_completed` — UTILITY

Fires when merchant verifies pickup OTP.

**Body:**
```
Order #{{1}} from {{2}} complete. Total ₹{{3}}. Thanks for shopping with PickAtStore — see you next time!
```

**Variables:** order_number, store_name, total

**Buttons:** `View Invoice`, `Rate experience`

**Triggered from:** `POST /orders/:id/verify-otp` success branch

---

### 5. `order_cancelled_by_merchant` — UTILITY

Fires when merchant rejects an accepted order (e.g., out of stock).

**Body:**
```
Hi {{1}}, we're sorry — {{2}} couldn't fulfil your order #{{3}}.

Reason: {{4}}.

Refund of ₹{{5}} has been initiated and will reflect in 5-7 business days. Reply HELP if you need support.
```

**Variables:** name, store, order#, reason, amount

**Buttons:** `Chat with us`

**Triggered from:** `POST /orders/:id/cancel` when invoked by merchant

---

### 6. `order_cancelled_by_customer` — UTILITY

Fires when customer cancels pre-pickup (WS2).

**Body:**
```
Your cancellation for order #{{1}} from {{2}} is confirmed.

Refund of ₹{{3}} will reflect in 5-7 business days.
```

**Variables:** order#, store, amount

**Triggered from:** WS2 cancel endpoint (not yet built)

---

### 7. `refund_initiated` — UTILITY

Fires for return/exchange refunds (WS2). Distinct from cancellation refunds because the
trigger is later.

**Body:**
```
Refund of ₹{{1}} for order #{{2}} has been initiated.

Expected in your account within 5-7 business days. Reply if you have questions.
```

**Variables:** amount, order#

**Triggered from:** WS2 refund endpoint

---

### 8. `dining_booking_confirmed` — UTILITY

Fires after successful dining booking + payment.

**Body:**
```
Your table is booked at {{1}}! 🍽️

Date & time: {{2}}
Guests: {{3}}

Show your name at the entrance — see you soon!
```

**Variables:** restaurant_name, date_time, guest_count

**Buttons:** `View booking`, `Get directions`

**Triggered from:** `POST /orders` success branch for `orderType: 'dining'`

---

### 9. `dining_slot_reminder` — UTILITY (Phase 2)

Sends 1 hour before slot. Requires a scheduled job. Stub only for now.

**Body:**
```
Reminder: your table at {{1}} is in 1 hour. {{2}} guests at {{3}}.

See you soon!
```

**Variables:** restaurant_name, guest_count, slot_time

**Triggered from:** cron job (`scheduled-jobs.ts`) — not yet wired.

---

### 10. `coupon_applied_confirmation` — UTILITY

Optional. Confirms in WhatsApp that a coupon was applied (some customers
appreciate the receipt).

**Body:**
```
Coupon *{{1}}* applied to order #{{2}}. You saved ₹{{3}}!
```

**Variables:** code, order#, savings

**Triggered from:** `POST /coupons/redeem` success — can be wired immediately after Meta approval. Strongly consider skipping for V1 — adds noise.

---

## MERCHANT templates (2)

### 11. `merchant_new_order` — UTILITY

Fires when a customer places an order at this merchant. **Critical** because
merchants are often not in the app.

**Body:**
```
🛎️ New order #{{1}}!

Customer: {{2}}
Items: {{3}}
Total: ₹{{4}}

Tap to accept within 10 minutes.
```

**Variables:** order#, customer_name, item_summary, total

**Buttons:** `Open in app` → deeplink to merchant app

**Triggered from:** `POST /orders` after order is created, sent to merchant's
registered WhatsApp number.

---

### 12. `merchant_kyc_status` — UTILITY (3 variants in one template)

Single template, body adapts via variable. Fires on KYC decision (mirrors the
Resend email pipeline).

**Body:**
```
Hi {{1}}, update on your PickAtStore application:

*{{2}}*

{{3}}
```

**Variables:**
| # | What | Example |
|---|---|---|
| 1 | Owner / partner name | `Ramesh` |
| 2 | Status headline | `Approved 🎉` / `Action required` / `Application declined` |
| 3 | Detail / next step | `Your store Folli Banjara is now live.` / `Please re-upload PAN.` / `Reason: ...` |

**Buttons:** `Chat with us` (for needs_info + rejected paths)

**Triggered from:** `POST /merchants/:id/kyc-decision` — fires *alongside* the
Resend email. Two channels, same content. Higher delivery confidence.

---

## MARKETING templates (2)

Submit later, after Meta is comfortable with our utility template volume. Require
explicit opt-in (e.g., a "Subscribe to PickAtStore offers" toggle in profile).

### 13. `marketing_coupon_launch` — MARKETING

**Body:**
```
🎟️ Save up to ₹{{1}} on your next PickAtStore order!

Use code *{{2}}* at checkout.

Valid until {{3}}.
```

**Variables:** max_savings, code, expiry_date

**Triggered from:** ops broadcast tool (manual fire, batched).

---

### 14. `marketing_cart_abandonment` — MARKETING

**Body:**
```
Hi {{1}}, your cart at {{2}} is waiting for you.

Complete your order in the next 24 hours and we'll throw in free pickup priority.
```

**Variables:** customer_name, store_name

**Triggered from:** scheduled job — runs every 4h, finds carts >24h old with no
checkout, sends to customer (only if marketing opt-in).

---

# PART C — API integration (matching template names to code)

## Env-var contract

Each template's name lives in an env var, read by `wati.service.ts`. This means
renaming a template in Wati requires changing **one** env var, not redeploying
code.

Add these to EB (or a `.env` for local) once Meta approves them:

```
WATI_API_ENDPOINT=https://live-mt-server.wati.io/<your-tenant-id>
WATI_API_TOKEN=<existing>
WATI_AUTH_TEMPLATE_NAME=otp                          # ← already live

WATI_TEMPLATE_ORDER_PLACED=order_placed
WATI_TEMPLATE_ORDER_ACCEPTED=order_accepted
WATI_TEMPLATE_ORDER_READY=order_ready
WATI_TEMPLATE_ORDER_COMPLETED=order_completed
WATI_TEMPLATE_ORDER_CANCELLED_MERCHANT=order_cancelled_by_merchant
WATI_TEMPLATE_ORDER_CANCELLED_CUSTOMER=order_cancelled_by_customer
WATI_TEMPLATE_REFUND_INITIATED=refund_initiated
WATI_TEMPLATE_DINING_BOOKING_CONFIRMED=dining_booking_confirmed
WATI_TEMPLATE_DINING_SLOT_REMINDER=dining_slot_reminder
WATI_TEMPLATE_MERCHANT_NEW_ORDER=merchant_new_order
WATI_TEMPLATE_MERCHANT_KYC_STATUS=merchant_kyc_status
```

If any env var is missing, the matching service method **no-ops gracefully** (logs
a warning, returns `false`, does NOT throw). This means you can submit templates
to Meta and roll them out one at a time as approvals come in — no big-bang.

## Service method signatures (extended in `apps/api/src/services/wati.service.ts`)

| Method | Signature | When to call |
|---|---|---|
| `sendOrderPlaced` | `(phone, name, store, orderNumber, total)` | after Razorpay verify |
| `sendOrderAccepted` | `(phone, name, store, orderNumber, eta)` | merchant accept |
| `sendOrderReady` | `(phone, orderNumber, store, pickupOtp, latestPickupTime)` | merchant mark-ready |
| `sendOrderCompleted` | `(phone, orderNumber, store, total)` | merchant verify-otp success |
| `sendOrderCancelledByMerchant` | `(phone, name, store, orderNumber, reason, amount)` | merchant cancel |
| `sendOrderCancelledByCustomer` | `(phone, orderNumber, store, amount)` | customer cancel (WS2) |
| `sendRefundInitiated` | `(phone, amount, orderNumber)` | refund endpoints |
| `sendDiningBookingConfirmed` | `(phone, restaurant, dateTime, guests)` | dining order success |
| `sendDiningSlotReminder` | `(phone, restaurant, guests, slot)` | scheduled job |
| `sendMerchantNewOrder` | `(phone, orderNumber, customer, items, total)` | order placement |
| `sendMerchantKycStatus` | `(phone, name, headline, detail)` | kyc-decision |

Stubs ship in tonight's `wati.service.ts` patch — they're safe to import + call
even before Meta approves. They'll all silently no-op until you set the env var.

## Trigger map — which endpoint sends what

| App event → API handler | Customer template | Merchant template |
|---|---|---|
| Order placed (Razorpay verified) | `sendOrderPlaced` | `sendMerchantNewOrder` |
| Merchant accepts order | `sendOrderAccepted` | — |
| Merchant marks order ready | `sendOrderReady` ⭐ | — |
| Merchant verifies pickup OTP | `sendOrderCompleted` | — |
| Merchant cancels accepted order | `sendOrderCancelledByMerchant` | — |
| Customer cancels pre-pickup (WS2) | `sendOrderCancelledByCustomer` | (also notify merchant via push or in-app) |
| Refund processed (WS2) | `sendRefundInitiated` | — |
| Dining booking placed | `sendDiningBookingConfirmed` | `sendMerchantNewOrder` |
| Dining slot reminder (cron) | `sendDiningSlotReminder` | — |
| `POST /merchants/:id/kyc-decision` | — | `sendMerchantKycStatus` |

---

# PART D — Submission playbook (for the Wati admin)

## Step 1 — Submit templates to Meta

In Wati dashboard → **Templates** → **Create New Template**:

For each template above:
1. Paste **template name** exactly (`order_placed`, etc.).
2. Pick **category** (UTILITY for most; MARKETING for the last two).
3. Language: **English**.
4. Paste the **Body** with `{{1}}`, `{{2}}` etc.
5. Add **Buttons** where listed (URL buttons need a real deep-link URL — for now
   use `https://pickatstore.io/orders/{{N}}` so the URL is fixed; the deep-link
   handler is a separate piece of work).
6. Submit.

Approval times in our experience:
- AUTHENTICATION: same day
- UTILITY: 24-48 hours, usually approved
- MARKETING: 2-5 business days, can be rejected for promo language. Keep it factual.

## Step 2 — Set env vars on EB as templates get approved

For each approved template, add the env var (e.g.,
`WATI_TEMPLATE_ORDER_PLACED=order_placed`) via **AWS Console → EB →
Configuration → Software → Environment properties** (NOT `eb setenv` from CLI —
see `ERRORS.md`). After saving in console, run `eb deploy` to restore node_modules
+ activate.

You can do this **one template at a time** as approvals trickle in. The service
gracefully handles partial rollouts.

## Step 3 — Build the inbound chatbot

Once Wati is configured (or before — independent of template approval), build the
chatbot per **Part A**. No code changes required for this — it's entirely Wati
dashboard config.

## Step 4 — Marketing opt-in (when we get to it)

Marketing templates require explicit opt-in. Add a toggle in the consumer
**Profile** screen: "Receive offers on WhatsApp". On toggle, write to
`profiles.whatsapp_marketing_opt_in` (new column — needs migration). Only
fire `marketing_*` templates for users with this flag set.

---

# PART E — Approval-timeline tracker

| Template | Submitted | Approved | Env var set | Wired in code |
|---|---|---|---|---|
| `otp` (existing) | ✅ | ✅ | ✅ | ✅ |
| `order_placed` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `order_accepted` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `order_ready` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `order_completed` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `order_cancelled_by_merchant` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `order_cancelled_by_customer` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `refund_initiated` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `dining_booking_confirmed` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `dining_slot_reminder` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `merchant_new_order` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `merchant_kyc_status` | ⬜ | ⬜ | ⬜ | ✅ (stub) |
| `marketing_coupon_launch` | ⬜ | ⬜ | ⬜ | ⬜ (Phase 2) |
| `marketing_cart_abandonment` | ⬜ | ⬜ | ⬜ | ⬜ (Phase 2) |

Inbound chatbot: ⬜ Not yet built in Wati dashboard.

---

# PART F — Out of scope for V1

- **Two-way conversations beyond Wati chatbot tree** — agent-initiated replies
  are fine in the 24h session window; outside that, an agent has to send a
  pre-approved template, which we don't have.
- **Multi-language** — English only for V1. Hindi / Telugu later (Wati supports
  per-template language; each is its own submission).
- **Rich media** (images of coupon tickets, product photos) — possible but each
  variant counts as a separate template approval. Skip for V1.
- **WhatsApp Pay integration** — separate Meta capability; not on this sprint.
