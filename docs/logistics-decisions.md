# Logistics Decisions Log — Cancellation, Reschedule, Return, Exchange, Refund

**Scope:** the cancellation / reschedule / return / exchange / refund / dining logistics, reconciling
the brand team's `App logistics.pdf` with founder decisions and our build.
**Date:** 2026-05-28
**Open items** are tracked in [`brand-team-questions.md`](./brand-team-questions.md). Broader founder
answers (API vendors, payouts, RBAC, etc.) live in the Founder Questions sheet, not here.

---

## 1. Architecture (the decision that shapes the build)

**DECIDED:** Cancellation, return, exchange, and refund all happen by **redirecting the customer into
WhatsApp/Wati** — *not* an in-app self-service flow. The flow is **CSA-driven**, and the **admin
dashboard is the system of record** (actions reflect to both admins and the merchant).

- The customer app's job is to **deep-link into Wati** with order context.
- The Wati automation tree collects intent/reason, then hands off to a CSA when needed.
- The CSA coordinates with the merchant and **actions cancel/refund/exchange on the admin dashboard**.
- Razorpay refunds are triggered **from the admin side**, not the customer app.

**Sprint impact (must revisit the June 6 plan):**
- The big **"Exchange + Return flow with in-app OrderDetail refactor"** is largely **replaced** by a small
  customer-app deep-link. The heavy work moves to: **Wati automation tree** (founder-owned config),
  **admin-dashboard tooling** (action + Razorpay refund), and the **coupon system**.
- **"Pre-pickup customer cancellation"** has no in-app cancel+refund button; it's a Wati deep-link + admin action.
- Net: **less customer-app code, more admin + Wati + coupon work.**

**OPEN:** Does **Reschedule** also route via WhatsApp, or stay an in-app slot picker? → questions doc Q23.

---

## 2. Cancellation

| Topic | Decision |
|---|---|
| Pickup cutoff | Cancel/reschedule allowed **until 30 min before slot**. |
| Dining cutoff | Cancel/reschedule allowed **until 45 min before slot.** (Supersedes the brand doc's "30 min before food prep begins," p4.) |
| Entry point | Cancel entry appears **in-app** (order card + post-payment confirmation page), but the **action routes to WhatsApp/Wati**. |
| Partial cancel | **Not supported** — whole order only. (Drop the "Partial / Full order" + item-list steps from the brand cancel script, p7.) |
| Late-cancel charge | **Zero.** Active cancellation is always a full refund, regardless of timing. |
| Pickup no-show | Auto-cancelled when the store closes → **95% refund (5% charge)**. |
| Dining no-show | **No refund** (0%) when no prior notice. (Note the intentional asymmetry vs pickup — confirm: questions doc Q2.) |
| Dining cancel options | Cancel → reason → **takeaway or refund** (convert-to-takeaway is automatic, inherits the original dining slot time). |

---

## 3. Returns / Exchange / Refund

| Topic | Decision |
|---|---|
| Perishable return window | **2 hours from pickup.** (Supersedes the brand doc's 6h.) |
| Non-perishable return window | **24 hours.** (Anchor — placement vs pickup — still **open**: questions doc Q3.) |
| Opened perishable / fresh food | "No return" per brand doc, but refund-without-return is **unresolved**: questions doc Q4–Q5. |
| Partial returns | **Allowed** (customer can return some items, unlike cancellation). |
| Return reason | **Required.** |
| Exchange scope | **Same merchant only.** |
| Refund — soft reasons | ₹50 flat fee (changed mind, don't need it, ordered wrong, expected different, found cheaper). |
| Refund — quality reasons | **No fee** (expired, damaged, poor quality, size/fit incl. electronics, wrong item delivered). |
| Refund destination | **Original payment method**, **or a coupon** (see §4). |
| Merchant refund control | **None** — merchants do not approve/process refunds. No partial refunds by merchants. |
| Merchant non-response | Brand doc: refund auto-initiated if merchant doesn't respond in **5 min** (realism **open**: questions doc Q13). |

---

## 4. Coupon / store-credit system

**DECIDED:** Build a coupon system as a refund mechanism (overrides "original payment method only").

**What it touches:** a coupon/credit-ledger table · issuance from the (admin-side) refund flow ·
redemption at checkout in the customer app · admin visibility · a funding rule.

**OPEN (all in questions doc §7):** coupon vs cash trigger (Q17), value full-vs-minus-fee (Q18),
redeemable scope (Q19), expiry (Q20), funding platform-vs-merchant (Q21), and whether this is the
**same** system as promotional coupons or a **separate** refund-credit ledger (Q22).

---

## 5. Dining no-show / late-arrival policy (from brand doc p4 — adopted)

- **Table hold:** 15 minutes beyond the scheduled time.
- **Late 20–30 min:** customer must inform in advance; table re-adjusted with minimal wait.
- **30+ min:** if food is prepared, collect as **takeaway within 2 hours** of the scheduled dine-in
  time; to still dine in, a minimal delay charge may apply during peak hours (amount/"peak hours"
  **open**: questions doc Q11).
- **Beyond 2 hours:** cancelled if no prior intimation.
- **No-show, no notice:** non-refundable.

**Approved pop-up copy** (shows after every pre-dine-in order — confirm placement, questions doc Q16):
> "Since your order is prepaid and freshly prepared, we kindly request timely arrival. If you're
> running late, please inform us through the app so we can hold your table or arrange takeaway.
> Without prior notice, no refunds will be issued for no-shows. This ensures that your food is served
> at its best and tables remain available for all guests."

---

## 6. Cross-references
- Open questions for the brand team → [`brand-team-questions.md`](./brand-team-questions.md)
- Customer-facing support tree / FAQ → [`wati-support-faq-tree.md`](./wati-support-faq-tree.md)
- Returns/exchange technical proposal → [`exchange-return-flow-proposal.md`](./exchange-return-flow-proposal.md)
