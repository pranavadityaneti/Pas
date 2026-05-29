# Exchange & Return Flow — Proposal for Founders

> **Date:** 2026-05-26
> **Audience:** Founders + product + engineering
> **Why this doc:** Today the customer app's "Your Orders" screen opens an `InvoiceModal` when a customer taps an order card. This proposal replaces that modal with a full **Order Detail screen** that surfaces invoice + new actions (Exchange, Return, Cancel, Reschedule). The flow chart below shows the proposed end-to-end behavior across customer app, merchant app, and admin dashboard.

---

## Current state (today)

```
Customer App                Merchant App                  Admin Dashboard
────────────────            ─────────────────             ──────────────────

Your Orders screen          (no return / exchange         (no return / exchange
  │                          functionality)                queue)
  ▼
Order card (tap)
  │
  ▼
InvoiceModal opens
  • shows invoice
  • no actions
  • close = done
```

**Problems with current state:**
- Customer has no path to request a return or exchange from inside the app.
- No way to cancel a paid order before pickup without contacting support.
- No way to reschedule a slot — must cancel + re-order.
- Modal is dead-end UX: invoice viewing only.

---

## Proposed end-to-end flow

### Visual flow chart (Mermaid — renders in GitHub, Notion, most markdown viewers)

```mermaid
flowchart TD
    Start([Customer opens 'Your Orders' screen]) --> CardTap[Customer taps an order card]
    CardTap --> OrderDetail[Order Detail Screen<br/>shows: status, items, OTP,<br/>invoice, ACTION BUTTONS]

    OrderDetail --> Decision{What can customer do?<br/>depends on order status}

    Decision -->|Order paid, not yet picked up| Cancel[Cancel Order]
    Decision -->|Order paid, not yet picked up| Reschedule[Reschedule Slot]
    Decision -->|Order completed within return window| Return[Return Items]
    Decision -->|Order completed within return window| Exchange[Exchange Items]
    Decision -->|Just viewing| View[View invoice / done]

    %% Cancel path
    Cancel --> CancelReason[Customer picks reason]
    CancelReason --> CancelConfirm[Confirm cancel]
    CancelConfirm --> CancelAPI[/POST /orders/:id/cancel/]
    CancelAPI --> RefundCheck{Was order paid?}
    RefundCheck -->|Yes| RefundAuto[Razorpay refund API<br/>idempotent on payment_id]
    RefundCheck -->|No| MerchantNotifyCancel[Notify merchant: order cancelled]
    RefundAuto --> MerchantNotifyCancel
    MerchantNotifyCancel --> CustomerNotifyCancel[Notify customer:<br/>cancelled, refund initiated]
    CustomerNotifyCancel --> EndCancel([End: order cancelled])

    %% Reschedule path
    Reschedule --> SlotPicker[Pick new slot — respects<br/>merchant's reschedule cutoff]
    SlotPicker --> RescheduleAPI[/PATCH /orders/:id/slot/]
    RescheduleAPI --> MerchantNotifyResch[Notify merchant: slot changed]
    MerchantNotifyResch --> CustomerNotifyResch[Confirm to customer]
    CustomerNotifyResch --> EndResch([End: order updated])

    %% Return path
    Return --> ReturnItems[Customer picks items to return<br/>+ reason + quantity]
    ReturnItems --> ReturnSubmit[Submit return request]
    ReturnSubmit --> ReturnAPI[/POST /returns]
    ReturnAPI --> ReturnPending[Status: RETURN_REQUESTED]
    ReturnPending --> MerchantReturnNotify[Notify merchant:<br/>'Return request from X']
    MerchantReturnNotify --> MerchantReview{Merchant reviews}
    MerchantReview -->|Approve| RefundFlow[Razorpay refund for<br/>returned items only]
    MerchantReview -->|Reject| ReturnRejected[Status: RETURN_REJECTED<br/>+ reason to customer]
    RefundFlow --> ReturnComplete[Status: RETURN_COMPLETED]
    ReturnComplete --> CustomerNotifyReturn[Notify customer:<br/>refund processed]
    ReturnRejected --> CustomerNotifyReturnRej[Notify customer<br/>+ optional appeal]
    CustomerNotifyReturn --> EndReturn([End: return complete])
    CustomerNotifyReturnRej --> EndReturnRej([End: return rejected<br/>escalate to admin])

    %% Exchange path
    Exchange --> ExchangeItems[Customer picks items to exchange<br/>+ replacement items from same merchant]
    ExchangeItems --> ExchangeSubmit[Submit exchange request]
    ExchangeSubmit --> ExchangeAPI[/POST /exchanges]
    ExchangeAPI --> ExchangePending[Status: EXCHANGE_REQUESTED]
    ExchangePending --> MerchantExchangeNotify[Notify merchant:<br/>'Exchange request from X']
    MerchantExchangeNotify --> MerchantExchangeReview{Merchant reviews}
    MerchantExchangeReview -->|Approve| ExchangeHandoff[Status: EXCHANGE_APPROVED<br/>+ new OTP for handoff]
    MerchantExchangeReview -->|Reject| ExchangeRejected[Status: EXCHANGE_REJECTED]
    ExchangeHandoff --> NewOTPNotify[Notify customer:<br/>'Exchange approved, OTP XXXX']
    NewOTPNotify --> CustomerVisitsStore[Customer visits store,<br/>exchanges items, gives OTP]
    CustomerVisitsStore --> ExchangeOTPVerify[Merchant verifies OTP]
    ExchangeOTPVerify --> ExchangeComplete[Status: EXCHANGE_COMPLETED]
    ExchangeComplete --> EndExchange([End: exchange complete])
    ExchangeRejected --> ExchangeRejNotify[Notify customer + escalation option]
    ExchangeRejNotify --> EndExchangeRej([End: exchange rejected])

    %% Admin oversight
    EndReturnRej -.->|Customer escalates via Wati| AdminQueue[(Admin Dashboard:<br/>Disputes Queue)]
    EndExchangeRej -.->|Customer escalates via Wati| AdminQueue
    AdminQueue -.-> AdminAction[Admin force-approves or<br/>contacts merchant]
```

---

## Order status state machine — proposed additions

Today's order statuses (existing):
```
PENDING → CONFIRMED → PREPARING → READY → COMPLETED
                                            ↓
                                       CANCELLED / REJECTED / EXPIRED
```

Proposed new states:
```
After COMPLETED:
  COMPLETED ──── return window (e.g., 24h) ───┬─→ RETURN_REQUESTED
                                              │   → RETURN_APPROVED → RETURN_COMPLETED
                                              │   → RETURN_REJECTED
                                              │
                                              └─→ EXCHANGE_REQUESTED
                                                  → EXCHANGE_APPROVED → EXCHANGE_COMPLETED
                                                  → EXCHANGE_REJECTED

Pre-pickup customer cancel:
  CONFIRMED / PREPARING / READY → CANCELLED_BY_CUSTOMER → (refund if paid)
```

---

## Order Detail screen — what's visible per state

| Order status | Visible actions |
|---|---|
| PENDING | (Customer is waiting for merchant to accept — usually no action) |
| CONFIRMED (paid, not picked up) | **Cancel order**, **Reschedule slot** |
| PREPARING | **Cancel order** (with warning), **Reschedule slot** |
| READY (awaiting pickup) | **Reschedule slot** (if not at store yet), show OTP prominently |
| COMPLETED (within return window) | **Return items**, **Exchange items**, view invoice |
| COMPLETED (after return window) | View invoice only |
| RETURN_REQUESTED / EXCHANGE_REQUESTED | Show request status + "Cancel request" option |
| RETURN_APPROVED / EXCHANGE_APPROVED | Show OTP + instructions to visit store |
| RETURN_COMPLETED / EXCHANGE_COMPLETED | View invoice + return/exchange record |
| RETURN_REJECTED / EXCHANGE_REJECTED | Show reason + "Escalate" button → opens Wati chat |
| CANCELLED / CANCELLED_BY_CUSTOMER | Show refund status (if paid) |

---

## Notifications wired into this flow

Each state transition fires a notification to the affected party. Aligned with `forlater.md` item #22's notification plan.

| Event | Recipient | Channel(s) |
|---|---|---|
| Customer cancels pre-pickup | Merchant | Push + in-app |
| Customer reschedules | Merchant | Push + in-app |
| Customer requests return | Merchant | Push + in-app |
| Customer requests exchange | Merchant | Push + in-app |
| Merchant approves return | Customer | Push + in-app |
| Merchant rejects return | Customer | Push + in-app + Wati message (with escalate option) |
| Merchant approves exchange | Customer | Push + in-app + OTP delivery |
| Merchant rejects exchange | Customer | Push + in-app + Wati message |
| Refund initiated (auto on approve) | Customer | Push + in-app + WhatsApp via Wati |
| Refund completed | Customer | Push + in-app + WhatsApp via Wati |

---

## Admin Dashboard — Disputes Queue

A new admin view shows:
- All RETURN_REJECTED, EXCHANGE_REJECTED orders where customer has escalated
- All stranded payments (where Razorpay paid but no order created — see forlater #18)
- All open Wati support chats marked as escalation-needed by the automation flow
- Per-merchant return/exchange rate (to identify merchants with too many disputes)

Admin can:
- Force-approve a rejected return (overrides merchant decision)
- Issue a manual refund via Razorpay (if merchant is unresponsive)
- Contact customer via Wati / phone
- Note actions in the audit log

---

## Backend schema additions (proposed)

### New tables
```sql
-- Return requests
CREATE TABLE return_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id),
    customer_user_id uuid REFERENCES auth.users(id),
    status text CHECK (status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED','CANCELLED')),
    reason text,
    rejection_reason text,
    items jsonb,  -- which items + quantities
    refund_amount numeric,
    razorpay_refund_id text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Exchange requests (similar structure)
CREATE TABLE exchange_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id),
    customer_user_id uuid REFERENCES auth.users(id),
    status text CHECK (status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED','CANCELLED')),
    reason text,
    rejection_reason text,
    returned_items jsonb,
    replacement_items jsonb,
    exchange_otp text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
```

### Existing tables — additions
- `orders.status` enum needs to expand: add `RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_COMPLETED`, `RETURN_REJECTED`, `EXCHANGE_REQUESTED`, `EXCHANGE_APPROVED`, `EXCHANGE_COMPLETED`, `EXCHANGE_REJECTED`, `CANCELLED_BY_CUSTOMER`.
- `orders` add a column: `return_window_expires_at timestamp` (computed at order completion based on merchant's return policy).

---

## Razorpay refund integration

Refunds happen automatically on:
1. Customer cancels paid order pre-pickup → full refund
2. Merchant approves return → partial refund (returned items + tax pro-rata)
3. Admin force-approves rejected return → manual refund through admin UI

API integration:
- Razorpay `POST /payments/:id/refund` with idempotency key = `return_request.id` or `cancellation_id`
- Razorpay sends webhook on refund success → updates our DB
- Customer notified at both: refund initiated AND refund completed (typically 5-7 business days for UPI)

---

## Wati integration touchpoints

| Event | Wati action |
|---|---|
| Customer escalates rejected return/exchange | Customer is redirected to WhatsApp; Wati's automation greets, captures issue, routes to support agent |
| Refund initiated | Wati template message sent to customer with refund amount + expected timeline |
| Refund completed | Wati template message confirms refund hit customer's account |
| Order picked up | Wati template message ("Thanks for your order, please rate your experience") |
| Pre-pickup reminder (30 min before slot) | Wati template message — backup channel to push notification |

Each of the above requires a separate Wati template approved by Meta. Wati admin task; not engineering.

---

## Critical open questions (need founder input — see separate questions doc)

1. **Return window duration** — how many hours after `COMPLETED` can a customer request return/exchange?
2. **Pre-pickup cancellation cutoff** — can customer cancel an order that's `PREPARING`? `READY`?
3. **Reschedule cutoff** — how many minutes before slot can customer reschedule?
4. **Restocking fee** — does merchant deduct a fee from return refunds?
5. **Partial returns** — can customer return *some* items from an order, not all?
6. **Same-day return vs next-day** — different rules for fresh/perishable items vs durable goods?
7. **Exchange-only stores vs return-only** — should merchants be able to disable return AND/OR exchange?
8. **Multi-step Wati escalation** — what's the escalation tree in Wati's automation flow?
9. **Merchant SLA on return/exchange decisions** — how long can a merchant sit on a request before admin auto-approves?
10. **Refund destination** — same payment method always, or store credit option?

---

## Sequencing recommendation for June 6 build

If everything below must ship June 6, suggested order:

**Week 1 (May 27–Jun 2):**
- Backend: Razorpay webhooks, refund integration, return/exchange tables, new order statuses
- Backend: Admin disputes queue API
- Customer app: replace `InvoiceModal` with `OrderDetailScreen` (UX refactor)
- Merchant app: refund management UI scaffolding

**Week 2 (Jun 3–Jun 5):**
- Customer app: Cancel, Reschedule, Return, Exchange flows
- Merchant app: review + approve/reject return/exchange
- Admin: Disputes queue UI
- Notifications wired into all state transitions
- Wati templates created and tested

**June 6:**
- Native build for both apps
- API deploy
- TestFlight + Play Console submission
- Internal smoke test before production rollout

**This is aggressive.** If any single piece slips, scope must trim. The most-likely-to-defer items: admin disputes queue (can be Phase 2), exchange flow (returns alone covers 80% of value), multi-channel notifications (push alone is fine; Wati messages can land later).
