# Wati Customer Support — FAQ, Escalation & Human-Handoff Tree

**Status:** DRAFT v0.1 — Proposal
**App:** Pick At Store (customer)
**Channel:** WhatsApp via Wati (already integrated for OTPs; this extends it to support)
**Prepared by:** Engineering (proposal) · **Owned by:** Founders (final support logic + policy)
**Date:** 2026-05-28
NOTE: Mandatory > For more information, please read (App Logistics's document)

> **How to read this doc.** Engineering proposes the structure, copy, and routing below. The
> founders own every **policy** call and the final **wording**. Anything still undecided is marked
> with a **⚠️ FOUNDER** note inline and collected in [§10 Open decisions](#10-open-decisions-blocking-go-live).
> All customer-facing copy is written paste-ready for Wati's flow builder; placeholders are in
> `[square brackets]`.

---

## 1. Wati messaging mechanics — what needs Meta template approval (read first)

This determines what we can ship immediately vs what waits on Meta.

| Message kind | Example | Template approval? |
|---|---|---|
| **Session message** — sent while the customer is in an active chat (they messaged us in the last 24h) | The whole bot menu + every auto-reply + the FAQ answers in this doc | **No.** Free-form. Ships immediately. |
| **Business-initiated / >24h** — we message a customer who hasn't written in 24h | "We've resolved your refund", proactive order updates over WhatsApp | **Yes.** Pre-approved Meta template required (24–72h lead time). |

**Implication:** the **entire reactive support tree below can go live without waiting on Meta**, because
the customer always starts the conversation. Template approval (founder Q12, the 24–72h critical-path
item) is only needed for the few **proactive follow-ups** flagged `[TEMPLATE]` in this doc, and for any
future plan to mirror order-status notifications over WhatsApp.

---

## 2. Entry points

A support conversation starts when:

1. The customer messages the support WhatsApp number directly, **or**
2. The customer taps **"Need help?"** in the app → opens WhatsApp pre-filled with a context line
   (e.g. `Help with order #12345`) so the bot can pre-route.

**⚠️ FOUNDER (Q10):** which WhatsApp number do customers see — the founder's phone, or a dedicated
business number? This gets hard-coded into the app and the Wati config.

---

## 3. Main menu (Level 1)

Triggered by any first message, by "hi"/"menu", or after a context-less open.

> **Bot:**
> Hi 👋 Welcome to Pick At Store support. What do you need help with?
>
> Reply with a number:
> 1️⃣ Track my order
> 2️⃣ Cancel / Reschedule
> 3️⃣ Refund status
> 4️⃣ Return / Exchange
> 5️⃣ I paid but my order didn't go through
> 6️⃣ Store / pickup info
> 7️⃣ Talk to a human

*(Implement as a Wati interactive list so taps map to branches; the numbered text is the fallback.)*

---

## 4. Branches (Level 2) — FAQ + auto-reply + escalation

Each branch: **Bot reply** (paste-ready) → optional follow-up → **escalation** (with a tag for triage).

### 1️⃣ Track my order
> **Bot:**
> You can see live status anytime in the app → **Your Orders**.
> The stages are: **Accepted → Preparing → Ready → Picked up**.
> Is your order stuck or showing the wrong status?
> • Reply **YES** if something looks wrong
> • Reply **MENU** if that's sorted 🙌

- **YES →** escalate → human · tag `order-status` (pass the order # if we have it).

### 2️⃣ Cancel / Reschedule
> **Bot:**
> You can cancel or reschedule yourself in the app → **Your Orders** → tap the order:
> • **Pickup:** up to **30 minutes** before your slot
> • **Dining:** up to **45 minutes** before your slot
> After that the window closes and the store has started preparing. If you still want to cancel, please speak to our support agent. 
> Reply **CLOSED** if your window has already passed and you still need help.

- **CLOSED →** escalate → human · tag `late-cancel`.
- **⚠️ FOUNDER (Section M Q57):** what's the policy once the window has closed — forfeit (no refund),
  or refund-via-support? The agent needs a rule to follow here.

### 3️⃣ Refund status 
> For more information, please read (App Logistics's document)
> **Bot:**
> If you cancelled within the allowed window, your refund starts automatically.
> Refunds go back to your **original payment method** and take about **5–7 working days**.
> Has it been **more than 7 working days**?
> • Reply **YES** and share your order # — we'll trace it
> • Reply **MENU** otherwise

- **YES →** escalate → human · tag `refund-delay`.
- **⚠️ FOUNDER (Section M Q52/Q53/Q54):** confirm before this copy is final —
  (a) is it always a 100% refund or is there a fee? (b) auto-refund or merchant-approved?
  (c) original payment method only, or is store credit offered? The wording above assumes
  *100%, automatic, original method* — change if any of those differ.

### 4️⃣ Return / Exchange
> **Bot:**
> Returns and exchanges are reviewed by the store.
> In the app → **Your Orders** → tap the order → **Return / Exchange**, add a **reason** and a **photo**.
> The store responds within **[SLA]**.
> Reply **HELP** if the store hasn't responded in time or you think a decision was unfair.

- **HELP →** escalate → human · tag `return-dispute`.
- **⚠️ FOUNDER (Section E + Section M Q60):** the return/exchange feature is part of the June 6 build.
  Until it ships, this branch should route straight to a human. Also set the **[SLA]** value (Q22).

### 5️⃣ I paid but my order didn't go through ⚠️ HIGH PRIORITY
> **Bot:**
> So sorry about that — let's fix this fast. Please send:
> 1) the **amount** you paid
> 2) the **time** of payment
> 3) the **store name**
> We'll trace your payment right away.

- **Always escalate → human, marked URGENT** · tag `payment-no-order`.
- **After hours:** auto-reply → *"We've logged this as **urgent** and will resolve it by [next business hour]. Your money is safe — we'll trace it and update you."* `[TEMPLATE if reply >24h later]`
- **⚠️ FOUNDER:** should money-stuck cases ping an on-call founder immediately, even after hours?
  (This is the known "paid-but-no-order" issue — it deserves the fastest path.)

### 6️⃣ Store / pickup info
> **Bot:**
> Your store's **address, hours, and your pickup OTP** are all on the order screen in the app.
> Need the store's phone number?
> • Reply **YES** to get it
> • Reply **MENU** otherwise

- **YES →** if we can fetch store contact from the DB, the bot shares it; otherwise escalate · tag `store-info`.

### 7️⃣ Talk to a human
*(Also reachable anytime by typing "agent", "human", or "help" — see [§5](#5-human-handoff-logic).)*

---

## 5. Human-handoff logic

```
"Talk to a human"  (menu 7, or keyword: agent / human / help)
        │
        ├─ During business hours [FOUNDER: define]
        │     → assign conversation to the support team (Wati: open + route)
        │     [Bot] "Connecting you to our team — usually just a few minutes ⏳"
        │
        └─ Outside business hours
              [Bot] "Our team is offline right now (hours: [____]).
                     Leave your question and order # and we'll reply by [next business hour]."
              → mark conversation 'open-pending'  → team picks up next shift
              (reply that goes out later = [TEMPLATE])
```

**⚠️ FOUNDER (Q11):** define business hours, and whether support is **live during business hours +
ticketed after**, or **fully automated 24/7** with no live agent.

---

## 6. Global rules (apply across every branch)

| Rule | Behaviour |
|---|---|
| **Escape hatch** | Keywords `agent` / `human` / `help` jump to [§5 handoff](#5-human-handoff-logic) from anywhere. |
| **Catch-all** | If the bot fails to understand **twice** in a row → "Let me get a person for you" → handoff. |
| **Menu reset** | `menu` or `hi` → back to [§3 main menu](#3-main-menu-level-1). |
| **Tagging** | Every escalation carries a tag (see [§7](#7-escalation-tag-reference)) so the team can triage and we get clean support analytics. |
| **Language** | ⚠️ FOUNDER (Q51): English only for MVP, or Hindi + regional from day one? Multi-language **doubles** all the copy above. |

---

## 7. Escalation tag reference

| Tag | Branch | Priority | Agent needs |
|---|---|---|---|
| `order-status` | 1 — Track order | Normal | Order # |
| `late-cancel` | 2 — Cancel/Reschedule | Normal | Order #, policy on closed-window (Q57) |
| `refund-delay` | 3 — Refund | Normal–High | Order #, payment ref |
| `return-dispute` | 4 — Return/Exchange | Normal | Order #, photo, store decision |
| `payment-no-order` | 5 — Paid, no order | **URGENT** | Amount, time, store name |
| `store-info` | 6 — Store info | Low | Store name |

---

## 8. Quick FAQ index (flat list for the support team)

Canned answers the team (and the bot) can reuse. Copy is provisional — see ⚠️ notes above.

1. **How do I track my order?** → App → Your Orders. Stages: Accepted → Preparing → Ready → Picked up.
2. **Where's my pickup OTP?** → On the order screen in the app; show it at the counter.
3. **Can I cancel?** → Pickup: until 30 min before slot. Dining: until 45 min before slot. In-app, Your Orders → the order.
4. **Can I reschedule?** → Same windows as cancel; in-app.
5. **I missed my slot — now what?** → Escalate (`late-cancel`); policy pending (Q57).
6. **How long do refunds take?** → ~5–7 working days, back to original payment method *(confirm Q54)*.
7. **I cancelled but no refund yet** → Allow up to 7 working days; beyond that, escalate (`refund-delay`).
8. **How do I return/exchange?** → In-app, reason + photo; store reviews within [SLA]. *(Feature ships June 6.)*
9. **I paid but no order appeared** → Urgent. Collect amount + time + store; escalate (`payment-no-order`).
10. **Payment failed but money was debited** → Treat as #9 (`payment-no-order`).
11. **Store hours / address?** → On the order screen in the app.
12. **OTP not received / can't log in** → Re-send OTP from the login screen; if still failing, escalate.
13. **Convert my dine-in to a takeaway?** → Coming with the June 6 update; for now, escalate.

---

## 9. Visual map

```
                 ┌─────────────────────────────┐
                 │  Customer messages WhatsApp  │
                 │  (or taps "Need help?" app)  │
                 └──────────────┬──────────────┘
                                ▼
                       ┌─────────────────┐
                       │   MAIN  MENU    │
                       └───┬───┬───┬─────┘
        ┌──────────┬───────┤   │   ├───────┬──────────┐
        ▼          ▼       ▼   ▼   ▼       ▼          ▼
      1 Track   2 Cancel 3 Refund 4 Ret/Exch 5 Paid?  6 Store  7 Human
        │          │       │       │          │        │        │
     auto-reply (FAQ) ─ resolved? ─┐          │     auto-reply  │
        │          │       │       │  ALWAYS  │        │        │
        └─ "wrong/closed/delay/dispute" ──────┴── URGENT ───────┤
                                ▼                                ▼
                       ┌──────────────────┐          ┌────────────────────┐
                       │  ESCALATE + TAG  │────────▶ │  HUMAN HANDOFF      │
                       └──────────────────┘          │  hrs → live agent  │
                                                      │  off → ticket      │
                                                      └────────────────────┘
```

---

## 10. Open decisions (blocking go-live)

These must be answered by the founders before the tree is built in Wati. Cross-referenced to the
**Founder Questions** sheet.

| # | Decision | Ref |
|---|---|---|
| 1 | Who owns the Wati admin login (to build this tree)? | C-Q8 |
| 2 | Approve this FAQ/escalation logic (founders own it) | C-Q9 |
| 3 | Which WhatsApp number customers see (founder phone vs dedicated business number)? | C-Q10 |
| 4 | Support hours: live during hours + ticket after, or fully automated 24/7? | C-Q11 |
| 5 | Submit the proactive-message templates to Meta now (24–72h lead time)? | C-Q12 |
| 6 | Cancellation refund: 100% vs fee? auto vs merchant-approved? | Section M Q52, Q53 |
| 7 | Refund destination: original method only, or store credit too? | Section M Q54 |
| 8 | Closed-window / no-show policy (what the agent tells a late customer) | Section M Q57 |
| 9 | Return/exchange merchant SLA value for branch 4 | Section E Q22 |
| 10 | Languages: English-only MVP, or Hindi + regional? | L-Q51 |

---

## Change log
- **v0.1 (2026-05-28):** Initial proposal — entry points, main menu, 7 branches with paste-ready copy,
  human-handoff logic, global rules, tag reference, flat FAQ index, visual map, open decisions.
