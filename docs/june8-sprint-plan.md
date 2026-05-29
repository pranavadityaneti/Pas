# June 8 Sprint — 360° Cross-Platform Plan

**Status:** DRAFT for Pranav + Opus to discuss → agree → execute.
**Date:** 2026-05-29 · **Ship:** June 8 (internal testers June 5) · **Team:** Opus (build) + Pranav (decisions, review, QA, deploys, founder/Wati coordination, DB SQL).

> Founder answers (sections A–M) are locked. This plan turns them into work, mapped across the four surfaces so we can see the real magnitude.

---

## 1. The four surfaces

| Surface | Stack | Ships via |
|---|---|---|
| **Customer app** | consumer-app (RN/Expo) | Native build (June 5/8) + OTA |
| **Merchant app** | merchant-app (RN/Expo) | Native build + OTA |
| **Admin dashboard** | admin-web (Vite React) | Vercel (git push) |
| **Backend** | API (Express/Prisma on EB) + Supabase (Postgres/Auth/Realtime) | EB deploy + SQL |

**Key truth:** the apps are thin; **most cross-platform logic lives in the Backend.** So for dependent features, the build order is almost always **DB → API contract → (Customer UI ∥ Merchant UI) → notifications.**

---

## 2. Independent vs Dependent — the magnitude map

**INDEPENDENT** = buildable & shippable on one surface without coordinating others.
**DEPENDENT** = needs a shared API/DB contract and coordinated build across ≥2 surfaces.

| # | Workstream | Customer | Merchant | Admin | Backend | Type | Size |
|---|---|---|---|---|---|---|---|
| **WS1** | Order reliability (Razorpay webhook → server-side order create; enable refunds) | small (backstop) | — | — | **heavy** | **Dependent** (API↔Customer) | M |
| **WS2** | Order lifecycle: Cancel / Reschedule / Return / Exchange | **heavy** | **medium** | (consumes, deferred) | **heavy** | **Dependent** (Customer↔API↔Merchant) | **L (the bulk)** |
| **WS3** | Notifications finish (lifecycle events + `recipient_role` cutover) | small | small | — | medium | **Dependent** (ordered API→apps) | M |
| **WS4** | Sentry crash reporting | small | small | (opt) | (opt) | **Independent** (per app) | S |
| **WS5** | Wati "Chat with us" deep-link | small | — | — | — | **Independent** (Wati tree = founder) | S |
| **WS6** | Returnable flag on catalog (supports WS2 eligibility) | tiny (reads) | (later) | (later) | small | **Dependent** (DB↔Customer) | S |

**Read of the magnitude:** WS2 is ~60% of the sprint and is the most dependent (three surfaces + backend in lockstep). WS1, WS3, WS6 are backend-led with thin app touches. WS4 + WS5 are independent quick wins we can land early to de-risk the native build.

---

## 3. Granular breakdown

### WS1 — Order reliability (foundation; do first)
**Why first:** every refund flow (cancel/return) needs Razorpay refunds *actually working* (today the refund code is commented/untested), and the webhook is the durable fix for "payment captured, order missing" (pairs with the FK hardening already shipped).

- **Backend**
  - `POST /webhooks/razorpay` — verify signature; on `payment.captured`, create the order **server-side** (reuse the now-idempotent order-create; keyed on paymentId). Acts as the safety net so a failed client POST still yields an order.
  - Extract order-creation into a shared function called by both `/orders` (client) and the webhook.
  - **Enable Razorpay refunds** — wire `razorpayInstance.payments.refund(...)` into a `refundOrder(orderId, amount, reason)` service (used by WS2). Test in Razorpay test mode.
  - `webhook_events` table (event id, type, payload, processed_at) for idempotency + audit.
  - Extend `scheduled-jobs.ts` with a payments-vs-orders reconciliation pass (flag captured-but-no-order).
- **Customer:** keep the existing (idempotent) client POST as primary; webhook is additive backstop → **near-zero app change** for June 8.
- **Deps:** Customer checkout depends on the refund + webhook contract being stable. **Independent-ish on the app side; backend-heavy.**
- **Owner:** Opus builds; Pranav configures Razorpay webhook secret + tests refunds in dashboard.

### WS2 — Order lifecycle: Cancel / Reschedule / Return / Exchange (the bulk)
Locked rules to encode: pickup late-cancel = no-show = **5%/max ₹50** (auto-refund ≤5 min, store hours); **dining late-cancel/no-show = no refund**, takeaway-convert until prepared; return window **24h from pickup**; **refund-without-return** for missing/wrong/quality (+ photos for damage); opened perishable/prepared/intimate = **non-returnable**; exchange = **single-step within 24h**, no fee, changed-mind qualifies, CSA-mediated; reschedule cutoff **45 min** (dining), merchant-defined peak-hour delay charge.

- **Backend (spine — build before the UIs)**
  - **DB:** confirm/extend order status enum (CANCELLED, RETURN_REQUESTED/APPROVED/REJECTED, EXCHANGE_REQUESTED/APPROVED/REJECTED); new `order_issues` table (order_id, type, reason, photos[], status, refund_amount, created_at, resolved_at, sla_due_at); `returnable` flag (WS6).
  - **Endpoints:** `POST /orders/:id/cancel` (window + fee + refund + notify), `POST /orders/:id/reschedule` (cutoff + slot update + cap + notify), `POST /orders/:id/return` (window/eligibility + reason + photos), `POST /orders/:id/exchange` (24h single-step), `PATCH /orders/:id/issue/:issueId` (merchant approve/reject + reason).
  - **Rules engine:** fee/window/eligibility/peak-charge from locked answers.
  - **Cron:** merchant-SLA auto-approve (Q22); auto-refund ≤5 min during store hours.
- **Customer app**
  - **OrderDetailScreen** (new route — replaces InvoiceModal): details + invoice + action buttons.
  - Cancel flow (pre-pickup only; fee preview; confirm).
  - Reschedule flow (slot picker; cap; cutoff messaging).
  - Return flow (reason picklist; photo upload; eligibility copy; refund-without-return path).
  - Exchange flow (reason; "visit store within 24h" copy).
  - Request-status reflection (pending/approved/rejected).
- **Merchant app**
  - Returns/Exchange/Refund **review** section (list, photos, reason, approve/reject + reason).
  - Cancel/reschedule reflected in order list + notifications.
- **Admin:** dispute/refund queue **consumes** `order_issues` — deferred (phase 2), but the schema is built now so it's ready.
- **Deps:** **Highest in the sprint.** Build DB+API contract first; then Customer UI ∥ Merchant UI in parallel against the frozen contract; notifications last.
- **Owner:** Opus builds all surfaces; Pranav reviews flows + tests end-to-end (customer↔merchant round-trip).

### WS3 — Notifications finish
- **Backend:** apply staged `recipient_role` migration; turn on dispatch wiring; emit the new WS2 lifecycle events (cancel/reschedule/return-decision/refund).
- **Customer:** confirm push-token registration; swap inbox filter to `recipient_role='consumer'`.
- **Merchant:** Phase B (deviceId); swap filter to add `recipient_role='merchant'`.
- **Deps:** **Ordered cutover** — (1) migrate, (2) deploy API, (3) swap app filters. Wrong order hides notifications. Cross-platform.
- **Owner:** Opus; Pranav runs the migration + sequences the deploy.

### WS4 — Sentry (independent, do early — native)
- Add Sentry SDK + init to **Customer** and **Merchant** apps (native dep → must be in the June-5 build). Admin/API optional.
- **Independent** per app. No cross-surface contract.

### WS5 — Wati "Chat with us" deep-link (independent)
- **Customer:** a Help/OrderDetail button → `wa.me` deep link to the Wati business number.
- The greeting/FAQ/escalation **automation tree is Pranav/founders' Wati-dashboard task**, not app code.
- **Independent.**

### WS6 — Returnable flag (supports WS2)
- **DB:** `returnable` boolean on Product/category; seed category defaults (perishables/prepared/intimate = false).
- **Customer:** return eligibility reads it.
- Merchant catalog toggle + Admin catalog mgmt = phase 2.
- **Dependent** (DB↔Customer), small for June 8 (DB defaults suffice).

---

## 4. Build sequence (dependency-ordered)

| Days | Focus | Surfaces |
|---|---|---|
| **1–2** | WS1 (webhook + refunds enable + shared create/refund service) · WS2 **DB + API contract** + rules engine · WS6 DB · **Sentry SDK in both apps** (lands in the build early) | Backend + apps (deps) |
| **2–4** | WS2 **Customer**: OrderDetailScreen + cancel/reschedule/return/exchange UI · WS5 Wati deep-link | Customer |
| **3–5** | WS2 **Merchant**: review UI + cancel/reschedule reflect (parallel once API frozen) | Merchant |
| **4–5** | WS3 notifications (events + `recipient_role` ordered cutover) | Backend + apps |
| **June 5** | Cut internal-tester **native build** → QA round-trips (customer↔merchant↔refund) | All |
| **5–7** | Fix from testing (JS fixes via OTA; native only if a dep changed) | All |
| **June 8** | Public ship | All |

---

## 5. Deferred to phase 2 (not in June 8)
Admin dashboard build (dispute queue / analytics / RBAC / audit / reports) · Settlement/payout (Razorpay Route/X) · Merchant signup full redesign (FK + atomic-create already de-risked it) · Coupons build · Cloudinary / PostHog / KYC-GST vendor / Wati marketing · 2-lakh upload (parallel data/ops task).

---

## 6. Risks & open decisions to agree
1. **WS2 is large for one builder + one reviewer in ~7 days.** Realistic? Or trim (e.g., ship Cancel+Reschedule+Refund for June 8, defer Return+Exchange to a fast-follow OTA right after)?
2. **Razorpay refunds untested** — must validate in test mode before cancel/return ship (blocking dependency).
3. **Webhook vs client order-create** — keep client primary + webhook backstop (lower risk for June 8), or move to webhook-only (cleaner, riskier)?
4. **`order_issues` schema** — unified table vs separate return/exchange tables (recommend unified).
5. **Native build cutoff** — Sentry + any new native deps must be in by June 5; everything else can OTA.

---

## 7. What I need from you to lock this
- Confirm/trim the **WS2 scope** (full vs cancel+reschedule+refund-first).
- Confirm **webhook = backstop** (vs webhook-only).
- Any **moves** between launch-blocking and deferred (from §2/§5).
Then we freeze the API contract for WS2 and start the grind on WS1.
