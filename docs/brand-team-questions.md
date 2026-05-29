# Questions for the Brand Team — App Logistics doc

**Source reviewed:** `App logistics.pdf` (Logic & flow, Auto responses) shared by the brand team.
**Cross-checked against:** founder answers + our finalized cancellation/reschedule flow + engineering build needs.
**Date:** 2026-05-28

> Page references (pX) point to the brand team's `App logistics.pdf`.
> Items already settled are listed in [§0](#0-already-settled-context) so we don't re-ask them.
> Everything in §1–§8 still needs the brand team's answer.

---

## 0. Already settled (context — no answer needed)

- **Cancel/return/exchange/refund happen via WhatsApp/Wati**, CSA-driven, with the **admin dashboard as the system of record** (reflecting to both admins and the merchant).
- **No partial-order cancellation** — whole order only. (Partial **returns** are allowed.)
- **Late-cancellation charge (within 30 min of pickup): zero** — active cancellation is always free.
- **Pickup cancel/reschedule cutoff: 30 min before slot. Dining: 45 min before slot.**
- **Perishable return window: 2 hours from pickup.** Non-perishable: 24 hours (anchor still open — see Q2).
- **Refund destination: original payment method**, plus a **coupon/store-credit** option (system to be built — see §7).
- **Fee model (returns/refunds):** ₹50 flat for "soft" reasons (changed mind, etc.); no fee for quality/defect/wrong-item/size/expired.

---

## 1. Fees — confirm the model

**Q1.** We now read **three separate fee situations** — please confirm this is right and that they **don't stack**:
- Pickup **no-show** → 95% refund (5% charge).
- **Active cancellation** (any time before pickup, incl. within 30 min) → full refund, no charge.
- Post-pickup **refund for a "soft" reason** (changed mind, etc.) → ₹50 flat fee.

**Q2 (asymmetry check).** Pickup no-show = **95% refund** (5% charge), but Dining no-show = **0% refund** (p4). Confirm this difference is intentional (dining holds a table + freshly-prepared food).

---

## 2. Return / refund / exchange windows (internal contradictions, p2–3)

**Q3.** Non-perishable window is "within 24 hours **after placing order**" — from **order placement** or from **pickup/completion**? (Big difference if someone picks up on day 2.)

**Q4.** **Opened perishable** and **fresh food** are listed as "**no return**" (p3) but *also* appear with **refund windows** (6h / 2h). Can these be refunded **without a physical return**? On what basis?

**Q5.** **Fresh food** = "2 hours after picking up order" for refund (p3) — confirm this is a **refund-without-return**, and what makes a customer eligible (quality issue only?).

**Q6.** Since perishable is now **2h from pickup** for returns, do the **perishable refund and exchange windows** also become 2h-from-pickup, or stay at the doc's 6h?

**Q7.** Exchange windows say "within X hours **after return**" (p3), but the chatbot says "visit store **within 24 hours** to return and replace" (p9). Is exchange **one step** (return + replace in one visit) or **two steps** (return, then a separate exchange window)? Please reconcile the timings.

---

## 3. Eligibility (the brand doc's own open questions, p5)

**Q8.** "**What makes a customer eligible for a refund?**" — we need the definitive rules, plus the explicit list of cases where a refund is given **without** a return.

**Q9.** "**What makes a customer eligible for an exchange?**" — define the criteria.

**Q10.** Do the **₹50 fee / no-fee** rules (p4) apply to **exchanges** too, or only refunds? And do "**changed my mind / ordered by mistake**" qualify for an **exchange** at all (they're listed on p8, but they're the ₹50-fee refund reasons)?

---

## 4. Dining (p4)

**Q11.** The "**minimal delay charge … during peak hours**" — what's the **amount**, and how are "**peak hours**" defined (per store? fixed window?)?

**Q12.** Late-arrival → takeaway conversion: **who** decides the food is "already prepared," and **how** does that reach the customer (in-app, call, WhatsApp)?

---

## 5. Flow / operational (p3)

**Q13.** "If merchant doesn't respond **within 5 minutes** → initiate refund." Confirm 5 minutes is the real SLA — it's very short for a merchant mid-service. If so, what happens if the merchant responds *after* the auto-refund fired?

---

## 6. Chatbot scripts (p6–9)

**Q14.** The top-level support menu shows "**List of instances ------------- ?**" (p7) — what are the menu options the bot should present first?

**Q15.** Agent intro uses a placeholder "**this is xyz from PickAtStore**" (p8) — real agent names, or a generic "PickAt agent"?

**Q16.** The dining **pop-up message** (p4) — confirm it shows **after every pre-dine-in order is placed** (not at checkout, not on app open).

---

## 7. Coupon / store-credit system (new — we've decided to build it)

Building a coupon system was confirmed; these define how it behaves:

**Q17.** When is a **coupon** issued vs a **cash refund** to the original method? Always the customer's choice, or **mandatory** in specific cases (non-returnable fresh food; replacement unavailable)?

**Q18.** **Coupon value** — full order amount, or amount **minus the ₹50 fee** where that fee applies?

**Q19.** **Redeemable where** — same merchant only, or **any store** on the platform?

**Q20.** **Expiry** period for a coupon?

**Q21.** **Funding** — does a refund-coupon's cost sit with the **platform** or the **merchant**?

**Q22 (design fork).** Is this the **same** coupon system as the planned **promotional/discount** coupons (merchant promos + admin coupons), or a **separate** "store-credit / refund-credit" ledger? (Decides one build vs two.)

---

## 8. Architecture clarification still needed

**Q23.** Cancel/return/exchange/refund route to WhatsApp (confirmed). Does **Reschedule** *also* route to WhatsApp (the brand doc bundles it into the cancel chat, p7), or should it stay an **in-app slot picker**? This materially changes the customer-app build.
