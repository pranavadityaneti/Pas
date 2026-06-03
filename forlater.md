# PAS — Deferred Work Queue

> **Purpose:** Items consciously deferred — not forgotten. Read at session start and at natural phase breaks during a session. When an item becomes the active priority, move it out of here into the working session and check it off when done.
>
> **Format per item:** Title, what + why, scope (files / surfaces touched), status, date added, originated from.

---

## How to use this file

- **Claude's job:** Read this file at session start. Surface a short summary to Pranav: "You have N items queued — top 3 are X, Y, Z. Want to tackle any?" Re-surface at natural phase breaks (task closure, "what next" moments, wrap-ups).
- **Pranav's job:** Decide whether to pick something up, defer further, or strike through as no-longer-relevant.
- **Both:** When an item is started, move it to "In Progress" section. When done, move to "Done — archived" section with completion date. Never silently delete an item — strike-through + reason is the lowest level of removal.

---

## ⏰ NEXT SESSION REMINDERS (read at start of next session)

1. **Verify B3 (API server-side notification metadata) is actually populating link + metadata.** Yesterday's `eb deploy` officially failed but the new code activated at 17:52 UTC after a 45-minute npm install. No notifications fired between then and end-of-session — so verification was deferred to next morning. **First action of next session:** run this SQL:
   ```sql
   SELECT id, type, link, metadata, created_at
   FROM notifications
   WHERE created_at > '2026-05-27 17:52:00+00'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
   If `link` (e.g. `/(main)/orders`) and `metadata` (JSON with orderNumber etc.) are populated → B3 is live and working. If null → debug API-side.

2. **Address founder questions** from `docs/exchange-return-flow-proposal.md` final section. Founders had not yet answered when this session ended.

3. **Fix EB slow deploys** (item below) — pre-sprint blocker.

4. **Supabase public schema GRANT migration** (item below) — deadline far out but worth surfacing.

---

## 🚀 June 6 Build Sprint (target: native build + production push)

> **Founder commitment for June 6, 2026.** All items here must land in the build that goes out that day. Scope is heavy for 11 days — see "Sprint scope concerns" in the founder questions doc.
> **Important fact correction:** Wati IS already integrated for OTP delivery. The new work is *extending* the existing Wati integration (chat support, status messages, marketing). Not a fresh integration.

### ✅ RESOLVED 2026-05-29 — Order-create FK race (charged-but-no-order) + 4-layer hardening
- **Symptom:** intermittent **"Order Sync Failed" / `fk_orders_user (index) | user=present`** — payment captured (`pay_…`), order NOT created, raw DB error shown to customer; "worked 5 min later" for the same user.
- **Root cause:** consumers exist only as `auth.users` + `profiles`; `orders.user_id` FKs to `public."User"`, which **nothing created for consumers** (the `handle_new_user` trigger made only a `profiles` row; no app path made a `User` row). New customers had a window with no `User` row → checkout FK failure.
- **Fixed & LIVE:**
  - **DB (Pranav ran):** backfilled the 6 missing `User` rows; updated `handle_new_user()` to also create the `User` row on signup (ON CONFLICT + exception-guarded so it can never break signup).
  - **API (deployed `app-260529_222820`, Green):** **L2** — `POST /orders` upserts the `User` row in-transaction before insert (FK now impossible); **L4** — idempotency on Razorpay `paymentId` (no double order/charge on retry), sanitized money-safe error (no raw DB leak), loud `[ORPHANED-PAYMENT][ALERT]` log; **L3** — `scheduled-jobs.ts` self-heals any missing `User` row every minute and alerts if found.
- **Fast-follows (NOT shipped):**
  1. **Consumer Layer-4 UI** — friendly error + idempotent auto-retry in `CheckoutScreen.tsx` + `DiningCheckoutScreen.tsx` (coded + tsc-clean; **held** for a clean consumer release/OTA per Pranav).
  2. **Auto-refund wiring** — fire a Razorpay refund on a confirmed orphaned payment (existing refund code is commented/untested; until enabled, reconciliation is via the ALERT + ops).
  3. **Token-verify `POST /orders`** — it currently trusts client-supplied `userId`; gate on the verified auth token (spoofing hardening).
- **Verify:** `SELECT count(*) FROM profiles p LEFT JOIN "User" u ON u.id=p.id WHERE u.id IS NULL;` → must stay **0**.
- **Note:** API changes are live but uncommitted in git (consistent with EB shipping the working-tree `dist`). Originated from a founder-reported screenshot.

### 2026-05-29 late-night updates
- ✅ **Razorpay refunds tested + working** (Pranav confirmed in test mode) → **WS2 unblocked**: cancel/return refunds + the order-FK auto-refund fast-follow can now actually fire (`razorpayInstance.payments.refund(...)`).
- ⚠️ **Razorpay X does NOT support our business type** → **Settlement/Payout is blocked on a payout-vendor alternative.** Research: Cashfree Payouts, Open Money, Decentro, or similar. Decide vendor before building the merchant Settlement screen. (Was tagged Phase 1; now gated on vendor selection.)

### Notifications (both apps)
- **Merchant in-app + push notifications:** finish Phase B (B2 + B3 pending) + Phase C (cleanup of dead `NotificationCenter.tsx`, send `deviceId`). Plus the native build needs to ship B1 (Android 13+ permission + iOS background mode) which is already in `app.json` waiting for build. Plus the notification sound bundling work (forlater item — see "Notification sounds" below).
- **Customer in-app + push notifications:** full Phase 1 of forlater #22 (push infrastructure + 7 immediate events: order confirmed/payment success/order packed/order picked up/order cancelled/dine-in booked/dining ready). Includes building customer-side push token registration + bell icon + notifications screen + realtime subscription. **(Steps 4+5 DONE on disk 2026-05-28 — inbox, bell+badge, realtime toast, tap deep-link.)**
- **[STAGED 2026-05-28] `recipient_role` cutover (notifications Option B):** migration `apps/api/prisma/migrations/20260528120000_add_recipient_role` + dispatch wiring (notification.service.ts sets 'merchant'/'consumer') are written but NOT applied. Today the consumer inbox is scoped by a temporary type-allowlist (`CONSUMER_NOTIFICATION_TYPES` in consumer `useNotifications.ts`). **On the June 6 deploy, in this order:** (1) `prisma migrate deploy` (creates column + backfills existing rows by type), (2) deploy API (now writes `recipient_role`), (3) THEN swap app read-filters — consumer: replace the allowlist with `.eq('recipient_role','consumer')`; merchant: add `.eq('recipient_role','merchant')` in merchant `useNotifications.ts`. Order matters — swapping filters before steps 1+2 are live would make null-role rows vanish. Full checklist in the migration file header.
- **NOT included this sprint:** scheduled notifications (Phase 2) and return/refund notifications (Phase 3 — return system itself is in this sprint but the notification wiring may slip).
- **NOT included this sprint:** Email notifications — Pranav removed this from the v2 list. Stays queued for a later phase.

### Customer app changes
- **In-app help / customer support via Wati:** add a "Chat with us" button (probably on a Help screen or in the order detail screen) that opens WhatsApp via deep link to the Wati-backed business number. Wati's automation flow handles the actual support routing (greeting, FAQ tree, escalate-to-human). **Founders need to design the Wati automation tree separately — this is a Wati admin task, not an app code task.**
- **Reschedule pickup / dining slot:** new UI on OrderDetail (see "Exchange/return screen refactor" below) with a slot picker. Backend endpoint to update `orders.pickup_time` / dine-in slot. Merchant gets notified. Needs reschedule cutoff rules (founder question).
- **Exchange and return flow:** **major UX refactor** — the current `YourOrdersScreen` taps an order card → opens `InvoiceModal`. New design: replace the modal with a full `OrderDetailScreen` route. The screen surfaces order details + invoice section + **new actions: Exchange, Return, Cancel (pre-pickup), Reschedule**. Flow chart documented separately: `docs/exchange-return-flow-proposal.md`.
- **Pre-pickup customer cancellation:** new "Cancel order" button on the order detail screen, visible only before the order is picked up. Cancellation triggers Razorpay refund (if paid) and notifies merchant. Needs cutoff window (founder question).

### Merchant app changes
- **Exchange and Refund management flow:** merchant-side UI to review customer return/exchange requests. Approve/reject + reason capture. On approve+return → Razorpay refund API → customer notified. On approve+exchange → handoff workflow. Lives in a new "Returns" tab or section in the orders screen.
- **Settlement / payout history:** new screen surfacing Razorpay Route payout data (or whatever Razorpay's settlement API exposes). Probably under Earnings & Reports.
- **Merchant signup flow redesign:** the existing notes are in `docs/signup-flow-redesign-notes.md` per CLAUDE.md. Full rework — atomic creation of merchants + Store + branch + store_staff + User rows (triggers already help). Founders need to confirm the new step-by-step flow (founder question).

### ✅ RESOLVED 2026-05-30 — Frequent signouts (refresh-token rotation race)
- **Symptom:** founder hit forced logouts on BOTH apps across 3 timings (relaunch after a while / few-min background / mid-session no trigger). NOT post-login.
- **Root cause (confirmed via Supabase Auth Logs):** concurrent `refreshSession()` callers in the apps caused two `/token` POSTs at the same timestamp; second one used the already-rotated refresh_token → Supabase reuse detection revoked the whole token family → permanent purge in consumer api.ts → SIGNED_OUT and unable to recover. Log evidence: paired rows at `12:44:12` — one `request completed`, one `400: Invalid Refresh Token: Refresh Token Not Found`.
- **Concurrency sources counted:** consumer had 7 explicit `refreshSession()` call sites (api.ts 401 interceptor + CheckoutScreen + DiningCheckoutScreen + BookingModal x2 + useOrderRequests + supabase.ts setSessionFromTokens). Merchant had 1 + uses `setSession()` (separate concern, not changed tonight).
- **Fix shipped (two layers):**
  1. **Dashboard (Pranav):** Supabase → Auth → Sessions → Refresh Token Reuse Interval `10s → 60s`. Live for all users instantly, no deploy.
  2. **Code (OTA pushed):** monkey-patched `supabase.auth.refreshSession` in both apps' `supabase.ts` so concurrent callers share a single in-flight Promise. Consumer `@lock` (May 1 approved config) overridden with Pranav explicit approval; override documented in file header. Internal supabase-js auto-refresh uses a private path and is unaffected.
- **Shipped:**
  - Consumer OTA `6dd7d98f-ed88-4ab7-aba0-dfac619d54b7` (runtime 1.1.1, iOS + Android)
  - Merchant OTA `75197597-6d15-4ad9-8add-a2f96494f29b` (runtime 1.2.3, iOS + Android)
- **Verify:** founder relaunches both apps → forced-logout rate should drop ~to zero. If any logout still occurs, capture the Auth Logs row at that timestamp — should now be a single `/token request completed` (no paired error), and any residual logout has a different root cause.
- **Phase 2A/2B/2C status:** Phase 1 (May 26) + Phase 2A (May 26) + the rotation-race fix (tonight) collectively cover the main signout failure modes. Phase 2C extras (merchant AppState gating + `setSession→refreshSession` switch + Phase 3 SecureStore→AsyncStorage migration) remain in the plan as **optional further hardening** if any residual logouts surface.
- **OTP ban removed 2026-05-30** (`apps/api/src/index.ts` ~3483) — was blocking founder testing; verify-OTP attempt limit retained. TODO: replace with per-IP throttle + Wati cost cap before scale.

### 💰 HIGH PRIORITY — Real merchant payout formula (replace the `× 0.98` placeholder)
- **Symptom that surfaced this:** founder screenshot 2026-05-30 — merchant dashboard "Estimated Payout (Today)" shows a float-spill (`₹6.8599999999999999` for revenue `₹7`). Display rounding was fixed tonight (`apps/merchant-app/app/(main)/dashboard.tsx:104-110`). **The float artifact is incidental — the real problem is the math itself.**
- **Current code (`apps/merchant-app/src/hooks/useEarnings.ts:86`):**
  ```ts
  estimatedPayout: todaySum * 0.98 // 2% platform fee simulation
  ```
  This is explicitly a **placeholder**, not real business logic. It deducts a flat 2% and calls it the merchant's payout. That is wrong for at least 5 reasons (see table below).
- **What the real payout must consider:**

  | Component | Typical real value | Notes |
  |---|---|---|
  | Razorpay payment-gateway fee | UPI 0% · cards 2-3% · wallets 2% · netbanking ~1-2% | Founder confirmed Razorpay refunds work; gateway fees vary by payment method, need method-aware logic |
  | GST on the gateway fee | 18% of the fee | Standard Indian e-com practice |
  | **Platform commission (PAS)** | TBD — needs founder decision | Could be flat % (e.g. 5/10/15), tiered by category, or tiered by merchant plan |
  | Refunds / chargebacks netted off | Variable | Settlement should be net of refunds in the same window |
  | TDS (sec 194-O) | 1% of gross sale | E-commerce operator obligation; applies above certain thresholds |
  | Settlement frequency | T+1 / T+2 / weekly | Affects what "Today's payout" actually means displayed-to-merchant |

- **Decisions needed from founder before coding:**
  1. PAS platform commission structure (flat / tiered / category-based / merchant-plan-based)
  2. Pre-fee or post-fee display to the merchant (gross expected payout vs net after deductions)
  3. Whether "Today's Estimated Payout" includes refunds/chargebacks pending in the same window
  4. TDS handling — deduct at source and show net, or show gross and note TDS separately
  5. Settlement frequency that maps to merchant expectation of "today"

- **Where to wire it:**
  - **Backend:** payout calc must live in `apps/api` (single source of truth), exposed as `GET /merchant/:id/payout/today` (or similar). The merchant app must NOT compute this client-side.
  - **Frontend:** `useEarnings.ts` becomes a thin API call instead of the multiplication.
  - Settlement screen / payout flow is gated on the payout-vendor selection (Cashfree / Open / Decentro — Razorpay X doesn't support our business type; separate forlater item).
- **Risk if left as-is:** merchants make commercial decisions based on a fake number. Real bank credits won't match the dashboard "Estimated Payout" → trust erosion + support tickets.
- **Date added:** 2026-05-30
- **Originated from:** founder dashboard screenshot during testing; Pranav's question "how did you decide on `todaySum * 0.98`?" — honest answer: I didn't, that 0.98 was already in code as a labeled simulation that had been overlooked.

### Admin Dashboard changes
- **✅ RESOLVED 2026-05-31 — Coupon consumer-side wire-up (checkout cards + tap-to-apply + redemption).** End-to-end live: admin publishes a themed coupon → it appears as a real ticket on the customer checkout (pickup + dining) → tap applies discount → on payment success a `POST /coupons/redeem` fires fire-and-forget (idempotent on orderId) → admin list shows `usedCount` increment. **What shipped:**
  - **API** (live on EB): new `requireUser` helper; new `GET /coupons/available` (filters `isActive` + validity window + audience match — NEW_USERS only if user has 0 orders; INACTIVE_USERS if last order > 30 days; respects storeId scope + `usageLimit`); `requireUser` lock on `POST /checkout/validate-coupon` and `POST /coupons/redeem`, deriving `userId` from the verified token (closes the spoofing hole tracked separately as 🔒).
  - **Consumer (Consumer OTA `f91396bc-e159-4062-be17-63efca31f1f8`, runtime 1.1.1, iOS+Android):** new `apps/consumer-app/src/components/CouponCard.tsx` (RN port of the 4 admin themes; perforation via absolute-positioned dots; digit-aware auto-shrink mirrors web heuristic); new `CouponsSection.tsx` (horizontal carousel, loading + empty states, tap → validate → onApply); hard-locked `CheckoutScreen.tsx` + `DiningCheckoutScreen.tsx` got scoped lock-override comments documenting the 2026-05-31 add-only edits; dead `AVAILABLE_COUPONS` hardcoded array deleted from CheckoutScreen.
  - **Untouched:** `handlePaymentSuccess` session-recovery (`effectiveUser`, refresh+getSession), `errorDiagnostic` UI, sticky CTA layout, Android picker dismiss, May 19 demo recovery layers — all preserved verbatim. Lock-override scope was 7 edits in CheckoutScreen + 5 in DiningCheckoutScreen, all add-only.
  - **Open follow-up:** `OffersScreen.tsx` still has its own hardcoded `AVAILABLE_COUPONS` (line 12) and a manual code-entry path. The checkout-cards path makes it largely moot for the customer journey, but `OffersScreen` will silently fall behind reality until it's switched to `GET /coupons/available` too. Track as a low-priority cleanup. Also: `CartScreen` (locked) wasn't touched — its coupon math still works because checkout sets the same state shape it expects.
  - **Plan doc:** `docs/coupon-consumer-wireup-plan.md` kept as historical reference; phases 1-7 all complete; Phase 5 (theme rendering on customer) achieved via the RN CouponCard port, not via the planned "extend OfferCard" shortcut.
- **🔒 Consumer-side coupon routes still open** (`POST /checkout/validate-coupon`, `POST /coupons/redeem` in `apps/api/src/index.ts`). Tonight (2026-05-30) we closed the 4 admin-management routes with `requireAdmin`; the 2 consumer routes were left untouched because we hadn't verified whether the consumer app sends a Bearer token on those calls. Fix: confirm consumer-app api client injects the Supabase JWT (it almost certainly does — the rest of the consumer flow uses it), then add `const u = await requireUser(req, res); if (!u) return;` (helper to be added next to `requireAdmin` at ~line 79). Verify validate + redeem still work for a logged-in consumer. Then redeploy. Added 2026-05-30.
- **Coupon card visual-style tweaks — DECISION REVERSED 2026-05-30: shipped preset themes.** Initial decision was "platform defaults only" but on seeing the builder Pranav requested style options visible in preview. Picked the *lighter-persistence* path: single `coupons.theme` text column (one of `classic` / `bold` / `modern` / `festive`) instead of 5 free fields. Each theme maps in code to a curated combination of `cardStyle / shape / accent / radius / density` (see `COUPON_THEMES` in `apps/admin-web/src/components/modules/marketing/CouponCard.tsx`). Migration `20260530120000_coupon_theme`. API POST/PATCH validate against the allowed list with silent fallback to `classic`. Adding/removing themes later is a code-only change (no DB migration), because the column is plain text validated app-side. **Open follow-up:** consumer app must read `coupon.theme` and pass the same preset to its own CouponCard render when the customer-view ships.
- **Coupon card overlap fix (shipped 2026-05-30):** value-text auto-shrinks via `Math.min(1, 3.6/len)` when amount has 4+ chars; row container has `minWidth:0 + overflow:hidden` so any residual extreme case clips instead of overlapping the logo. Covers `Fixed amount` + `Percentage`; BOGO is fixed-width. Lives in `apps/admin-web/src/components/modules/marketing/CouponCard.tsx`.
- **Coupon fonts:** design calls for `Hanken Grotesk` (body) + `Space Mono` (redeem code). Not loaded in admin-web `index.html` (uses Nunito Sans + a monospace fallback). If exact typography matters, add the Google Fonts `<link>` to `apps/admin-web/index.html` (shared file — left untouched for scope). Added 2026-05-30.
- **`coupon_redemptions` GRANTs:** the new table (migration `20260530100000`) must include explicit `GRANT`s per the Oct 30 Supabase item below if the apps ever read it via the Data API (currently only the API/service_role touches it). Added 2026-05-30.
- **Order / refund / dispute resolution queue:** unified view of stranded payments, customer complaints (escalated from Wati), pending refunds. Needs Wati+Razorpay integration into the admin dashboard so the support team can see context.
- **Cross-merchant analytics dashboard:** GMV, top stores, top products, geographic trends. Date-range filters. For founder visibility + investor decks.
  - **🟡 PARTIAL 2026-06-03 — Analytics v1 shipped** (`apps/admin-web/src/components/modules/analytics/AnalyticsDashboard.tsx`): date-range chips (Today/7d/30d/90d/Custom), KPI strip (GMV, Orders, AOV, Cancellation Rate), Revenue Trend area chart, Order Volume line chart, Order Status pie, sortable Top Stores (5/10/25), CSV export of the current view.
  - **✅ DB step applied 2026-06-03** — `get_super_admin_stats_in_range(from_date, to_date)` RPC live in production (founder confirmed "SQL is successful"). Date chips on `/reports` and FinanceHome now hit the new RPC; amber fallback banner is gone. SQL preserved in `docs/migrations-pending-2026-06-03.sql` for the schema history record.
  - **Still deferred (honest non-scope):** top SKUs / category breakdown (needs OrderItem joins), city / geo breakdown (needs branch-join aggregation), compare-vs-previous-period delta tiles (needs RPC extension to return prior-window numbers).
  - **🟢 Role-aware home Dashboard shipped 2026-06-03 (Tier C):** `apps/admin-web/src/components/Dashboard.tsx` is now a role router. Each tier (SUPER_ADMIN, OPERATIONS, FINANCE, SUPPORT) lands on its own home page composed from `apps/admin-web/src/components/home/*Home.tsx`. Reuses `get_super_admin_stats` + direct Supabase reads. Shared building blocks in `home/_shared.tsx`.
  - **Tier D deferred (post-launch):** drag-rearrange tiles + per-user saved layouts + tile picker UI. Requires react-grid-layout + new `user_dashboard_layouts` table. ~3-4 hrs. Not blocking June 6.
- **🟢 Customers page Phase 1+2+3 shipped 2026-06-03**: Fake city "Hyderabad" replaced with real city from last order's branch (Unknown if no orders). Fake status "active" replaced with real `User.status`. Added Orders / AOV / Last Order (recency badge) columns + Total / Active / Suspended totals strip. Per-row dropdown: View details, Send WhatsApp (wa.me), View orders, Wati history, Suspend/Reactivate (wired to PATCH /admin/users/:id). CustomerDetailsSheet bug fixed: was `.from('orders')` (wrong table — real one is `Order`) so many sheets showed empty history; email was `<id>@example.com` literal fake. Brand red replaces fuchsia/pink throughout.
- **Customers — follow-ups (low priority):** (1) `/orders` page now respects `?userId=X` query param ✅ shipped 2026-06-03 night. (2) `/customer-support` page still needs to respect `?phone=X` so the "Wati history" link filters the inbox to that customer's thread — flagged for next session.
- **🔥 ROOT CAUSE FIX 2026-06-03 night — wrong-table bug class** (founder audit caught it). My initial diagnosis claimed there were two order tables (legacy `orders` + production `Order` capital) — that was WRONG. The Prisma `Order` model maps to the lowercase `orders` table via `@@map("orders")` on schema.prisma:409. Same pattern for Merchant→merchants, MerchantBranch→merchant_branches, OrderItem→order_items, Coupon→coupons. The REAL bug: admin-web was reading via PostgREST as the `authenticated` JWT role, which is blocked by RLS on production tables (the home Dashboard's KPIs work because `get_super_admin_stats` RPC is SECURITY DEFINER). Founder approved Path B (proper architecture): all admin reads now route through API endpoints that use Prisma server-side (direct PG, no PostgREST cache, no RLS jungle). New endpoints: `GET /admin/customers`, `GET /admin/orders`, `PATCH /admin/orders/:id`, `GET /admin/customers/:id/orders` — all gated by `requireRole`. Hooks `useCustomers` + `useOrders` + `CustomerDetailsSheet` refactored to use them. Rebuilt OrderManager UI around the real 6-state enum (PENDING/CONFIRMED/READY/COMPLETED/CANCELLED/REFUNDED) — removed fake SLA column, fake driver/delivery block, hardcoded timeline, fake customer/merchant reconstruction. NOT touched: consumer-side POST /orders flow including 4-layer FK-race hardening from 2026-05-29.
- **📋 ARCHITECTURAL RULE (going forward, 2026-06-03 night):** admin-web reads for production data should hit the API (`api.get('/admin/...')`), NOT Supabase PostgREST directly (`supabase.from(...)`). The API uses Prisma + service_role-equivalent + auth middleware — no schema-cache surprises, no RLS policy management per table. Direct Supabase reads from admin-web are OK only for: (a) tables intentionally exposed with admin-friendly RLS (e.g. `wati_inbox`), (b) RPC calls (`supabase.rpc('get_super_admin_stats')`), (c) Auth (sign-in flows). When in doubt, add an `/admin/...` endpoint.
- **Home dashboards still query Supabase directly for KPI counts:** `SuperAdminHome`, `OperationsHome`, `FinanceHome`, `SupportHome` use `.from('orders').select('id', { count: 'exact', head: true })` patterns for tile counts (pending orders, KYC queue, cancelled today, refund pressure, etc.). These may return 0 due to RLS even after the table-name reverts. Follow-up: add count endpoints (`GET /admin/stats/operations`, `GET /admin/stats/support`, `GET /admin/stats/finance`) and migrate the home dashboards. Not blocking June 6 launch since the main pages now work — flag for post-RBAC-test polish.
- **Wati-OTP consumer profile capture (data quality):** roughly 27 customers in the database, most with NULL `User.name` because phone-OTP signup doesn't ask for a name. Customer column shows "(no name)" italic for these. Consumer app should prompt for name on first login (or at first checkout) to populate the User.name field — currently a profile incompleteness issue that makes customer list harder to scan.
- **✅ `admin_audit_log` table applied 2026-06-04** (founder confirmed "SQL: Success. No rows Returned"). PATCH /admin/orders/:id Force Complete / Force Cancel actions now leave a row with actor_id + before/after status + IP + UA. SQL preserved at `docs/migrations-pending-2026-06-04.sql` for schema history.
- **Follow-ups to extend audit coverage (low priority, after launch):** wire `recordAdminAudit` into (1) PATCH /admin/users/:id for suspend/reactivate + role-change events (action='user.suspend' / 'user.role_change'), (2) POST /admin/users/invite (action='admin.invited'), (3) merchant KYC approve/reject (action='merchant.kyc_decision'). Each is a 3-line addition next to the existing endpoint logic. Build an `/audit` admin viewer page once data accumulates.
- **Customers page load-more UI:** `/admin/customers` server-side pagination shipped 2026-06-04 (limit=500 default, cap 2000). Client always requests the default — no UI for paging through beyond 500 yet. Build a "Show more" / infinite-scroll when consumer base crosses ~400.
- **Customers — post-launch deferred:** Wallet balance + Grant Credit (needs `wallets` table), customer tags (VIP / At-Risk — needs `customer_tags` table), LTV percentile rankings, cohort retention analysis.
- **Global Config tab hidden 2026-06-03**: the GlobalConfig.tsx form was 100% mock (hardcoded `defaultValue` strings, Save button just toasted without persisting). Hidden from AnalyticsHub tabs. To revive: build a `platform_settings` table + GET/PATCH admin routes + make consumer/merchant apps consume Max COD / Min Order / Platform Fee / Delivery Fare / Referral Bonuses / Service Radius / Driver Assignment Timeout. ~2-3 hrs + a few app-side wires.
- **Reports / data exports (CSV/Excel):** downloadable order reports, refund reports, GST reports, payout reports. Likely a "Reports" tab with date pickers + export buttons. (Analytics-page CSV shipped 2026-06-03 — see above. Order/refund/GST/payout reports still pending.)
- **Multi-admin RBAC:** roles like `founder`, `support`, `ops`, `viewer`. Permission middleware on admin routes. Each role sees what it should.
- **Audit log of team and admin actions:** every admin/support action (approve merchant, issue refund, contact customer) logged with actor + timestamp + reason. Schema: `audit_log` table + middleware.

### New external API integrations (to wire in this sprint)
- **Sentry** — crash + error reporting on both apps. Free tier sufficient initially.
- **Razorpay Webhooks** — server-side order creation on payment success (proper fix for "Network request failed" bug class — forlater #18). Critical pairing with exchange/return work since refund flow needs webhook handling too.
- **KYC / GST Verification** — Karza, IDfy, or DigiLocker. Picked based on cost + Indian compliance coverage. (Founder question on which vendor.)
- **Wati extension** — already integrated for OTPs. Extend to: order status messages, payment OTPs (additional flow), reminders, marketing campaigns, customer support chat routing. Each is a separate Wati template + automation in their dashboard.
- **Cloudinary** (or imgix) — image CDN. Replaces local-bundle image serving for product photos, banners, store photos. Massive bandwidth win on customer app.
- **PostHog** (or Mixpanel) — product analytics. Funnels, retention, feature usage. PostHog is cheaper + self-hostable; Mixpanel has slicker UI.
- **Resend** — transactional emails (even though customer-facing email notifications aren't in scope, the admin dashboard will need email for password resets, invitations, etc.).
- **Razorpay Route / Razorpay X** — automated merchant payouts. Powers the merchant Settlement/Payout History screen.

### 🔧 Supabase public schema GRANT migration (DEADLINE Oct 30, 2026)
- **What:** Supabase notified that on May 30, 2026 NEW projects will no longer expose `public` schema tables to the Data API by default — every new table needs explicit `GRANT` before PostgREST/GraphQL/supabase-js can access it. EXISTING projects (us) keep the current default behavior until **Oct 30, 2026**, after which the same restriction applies.
- **Why it matters:** Our project uses `public` schema heavily for everything (orders, order_requests, notifications, merchants, etc.). After Oct 30, anything we touch without explicit grants becomes inaccessible to the apps via the Data API. Also affects every new table we create in the meantime once we cross that date.
- **What needs to happen:**
  1. Update our `prisma/migrations/*.sql` or wherever new tables are created to ALWAYS include the proper `GRANT ... ON ... TO authenticated, anon;` statements.
  2. Audit existing tables — confirm RLS policies + GRANTs are explicit (RLS controls row visibility, GRANTs control TABLE visibility; they're separate).
  3. Read Supabase's changelog post for the canonical SQL pattern + migration script.
- **Date added:** 2026-05-28
- **Originated from:** Supabase email notification received May 27.
- **Status:** Queued — well before Oct 30 deadline but should be addressed before any post-Oct 30 table creation. Worth adding to standard PR review checklist.

### 🔧 Fix EB slow deploys (PRE-SPRINT TASK — do before June 6)
- **What:** The May 27 B3 API deploy took **45 minutes** because EB ran `npm install` on the instance for 260 packages. EB's CLI gave up at 21 min and marked the deploy "failed," but `npm install` continued and the new version eventually activated at 17:51 UTC. API is currently live with B3 changes despite EB metadata showing the old version.
- **Why it matters:** A 45-minute deploy is unworkable for the sprint. We'll need to deploy multiple times in 11 days. If each deploy is 45 min + half rolled-back + half mysteriously succeeded, we'll burn an entire day on deploy theater.
- **Root cause:** `apps/api/.ebignore` (or absence thereof) likely tells EB to skip uploading `node_modules`. EB then runs `npm install` server-side, which on a small instance takes 45 min due to native module compilation (Prisma, bcrypt, etc.).
- **Recommended fix shape:**
  1. **Quick win** — bundle `node_modules` with the upload (modify `.ebignore` to NOT exclude it). Deploy time drops from 45 min → 2-3 min. Zip uploads larger (maybe ~150MB instead of ~11MB) but that's a tiny tradeoff.
  2. **Cleaner long-term** — move build + `npm ci` to CI (GitHub Actions / similar). CI produces a built artifact (built `dist/` + pruned `node_modules`); EB just unzips and starts. Adds CI infrastructure but matches modern practice.
  3. **Bigger** — Docker-based EB platform. Layered caching, predictable builds. Largest refactor; defer.
- **Pre-sprint deliverable:** apply option 1. Test deploy completes in <5 min before the sprint starts.
- **Status:** Queued — must complete before sprint deploys start.
- **Date added:** 2026-05-27
- **Originated from:** May 27 B3 deploy investigation. eb-engine.log evidence: npm install took 17:07:10 → 17:51:43 (~44 min, 260 packages).

### Sprint scope concerns (flag for founders)
- This is **3-4 weeks of work for one engineer** packed into 11 days. Either: (a) multiple engineers needed in parallel, (b) some items need to be deferred, (c) feature scope per item needs to be tightened.
- Items most likely to slip without scope-trim: cross-merchant analytics, RBAC, audit log.
- Items that are foundational to others (and must land first): Sentry (visibility into everything else we ship), Razorpay Webhooks (required by exchange/return), Cloudinary (if banner overhaul is part of the build).

---

## Active queue (priority order)

### 1. Unify Request ID → Order ID (Option A)
- **What:** Generate `PAS-YYYYMMDD-NNNN` at `order_request` creation. Persist on the request row. Copy to the `orders` row at payment. Customer + merchant see the same number throughout the lifecycle — no identity flip mid-flow.
- **Why it matters:** Current behavior — request UUID flips to a different order_number the instant payment lands. Confusing for customers (support conversations break, receipts mismatch) and merchants (can't recognize an order they approved 30s ago). Trust impact at scale.
- **Scope:** DB migration (add `order_number` to `order_requests`) → API change at request creation → API change at order creation (copy, don't regenerate) → consumer app UI (show order_number) → merchant app UI (show order_number) → 2 OTAs.
- **Status:** Queued (full plan + staging order written in May 26 session — see Claude's response that day).
- **Date added:** 2026-05-26
- **Originated from:** May 26 session after RLS fix landed and Pranav observed the ID swap was confusing.

### 2. Realtime for merchant Pending/Processing order tabs
- **What:** Audit `apps/merchant-app/src/hooks/useOrders.ts` for missing Supabase Realtime subscriptions on `order_requests` and `orders`. Add polling + AppState foreground refetch in the same pattern as today's `StoreContext.tsx` sync fix.
- **Why it matters:** Right now merchant Pending and Processing tabs only update on screen refresh or pull-to-refresh. New orders arrive silently. Merchants will miss orders in real-world operation.
- **Scope:** `apps/merchant-app/src/hooks/useOrders.ts` only. 1 merchant OTA.
- **Status:** Queued.
- **Date added:** 2026-05-26
- **Originated from:** May 26 session after RLS fix — observed during post-fix testing.

### 3. Tighten RLS on `merchant_branches`
- **What:** Drop the over-permissive `USING (true)` policies (UPDATE, DELETE, SELECT). Keep the scoped `merchant_id = auth.uid()` ones. Plus an `is_active = true` SELECT policy for public storefront read.
- **Why it matters:** Today any authenticated user can update/delete any merchant's branch row. Security gap; not exploited yet but easy to.
- **Scope:** DB-only (DROP + CREATE POLICY). No app code.
- **Status:** Queued (spawned as chip — position 3 in spawn-task queue).
- **Date added:** 2026-05-26

### 4. Timings save bug + propagate timings to customer app
- **What:** Two-part task. (1) Diagnose why some branches have `operating_hours = null` despite merchants believing they set the schedule. (2) Once timings are saving reliably, ensure customer app reflects timing changes in real-time (currently doesn't — same staleness pattern as `is_active` was before today's fix).
- **Why it matters:** Customer app shows "Open Now" for stores that are actually closed. Wrong customer expectations, wasted trips, support issues.
- **Scope:** Audit first. Then likely customer-side `useStores` (LOCKED — needs override) or `StorefrontScreen` (LOCKED) realtime extension. Plus merchant-side timings save flow check.
- **Status:** Queued (spawned as chip — position 2 in spawn-task queue).
- **Date added:** 2026-05-26

### 5. `is_active` field overload (architectural)
- **What:** Today `merchant_branches.is_active` serves two purposes: (a) permanent deactivation by admin, (b) merchant's manual go-offline toggle. These should be separate columns (`is_active` + `accepting_orders`) so admin lifecycle state and merchant transient state don't collide.
- **Why it matters:** Already bit us during the Branch B cleanup — admin set false → merchant saw "Store Offline" red banner unexpectedly. Will keep biting as features (scheduled offline, vacation mode) get added.
- **Scope:** Schema migration + API + customer-side filter logic + merchant-side toggle target. Significant change.
- **Status:** Queued for "before scaling to real merchants."
- **Date added:** 2026-05-26
- **Originated from:** May 26 session, surfaced during offline-toggle bug discussion.

<!-- Item #6 moved to In progress section below — 2026-05-26 -->

### ~~6. Frequent signout investigation~~ (moved to In progress)

### 7. Operating hours coverage check (across all stores)
- **What:** Run the 3 SQL queries Claude wrote May 26 to determine how many merchant_branches rows have `operating_hours = null` vs populated. Determines whether the save flow is broken for everyone or just historical data.
- **Why it matters:** Cheap to verify; high signal. Feeds into item #4 above.
- **Scope:** SQL only.
- **Status:** Queued (SQL written but not run yet).
- **Date added:** 2026-05-26

### 8. Security audit — broader RLS sweep across all tables
- **What:** Today we found that `orders` had broken RLS (branch UUID vs merchant UUID comparison) and `merchant_branches` had over-permissive policies. The same patterns likely exist elsewhere — `StoreProduct`, `notifications`, etc.
- **Why it matters:** Two structural RLS bugs found by accident already; high probability of more. Pre-launch security audit needed.
- **Scope:** Audit-only first. Then policy rewrites where needed.
- **Status:** Queued — for after the orders RLS work (just done) settles.
- **Date added:** 2026-05-26

### ~~9. Varsha's issue — Order Sync Failed (FK violation)~~ — RESOLVED 2026-05-26
*Closed by Store.id realignment + signup triggers. See Done section.*

### 9. Varsha's issue — Order Sync Failed after successful payment (CRITICAL, money-impacting) [closed]
- **What:** On Android, after Razorpay payment succeeded (`pay_StrS3Vuy4GpJ5X`), the order failed to insert into the database with `Foreign key constraint violated: fk_orders_store (index)`. Customer paid; no order row was ever created. Money in Razorpay limbo, no order in our system.
- **Likely cause (unconfirmed):** Customer app sending a `store_id` value that doesn't exist in `merchants` table. Possibilities: (a) sending a `branch_id` where merchant_id is expected, (b) stale cart data referencing a deleted/changed store, (c) race condition where `acceptedRequest.store_id` wasn't populated at order-creation time.
- **Why it matters:** Direct financial integrity issue. Even one occurrence in production = refund/dispute. Need to find which store + customer + flow path produced this so we can (1) refund manually if not already done, (2) fix the code path so it can never happen again.
- **What we still need to investigate:**
  - Which store / branch was Varsha attempting to order from?
  - Pickup or dine-in?
  - Approximate time of failure?
  - Customer phone / user account?
  - API server-side log for payment ID `pay_StrS3Vuy4GpJ5X` — will show the exact `store_id` value that failed FK
  - Whether an `order_requests` row was created before payment (so we can compare intended vs actual store_id)
- **Scope (when picked up):** Customer-app order-creation payload (`apps/consumer-app/src/screens/CheckoutScreen.tsx` and `DiningCheckoutScreen.tsx` — both LOCKED, will need override) + API `POST /orders` validation (`apps/api/src/index.ts`).
- **Status:** **Urgent — money-impacting bug**. Should be picked up as soon as Pranav has the missing data.
- **Date added:** 2026-05-26
- **Originated from:** May 26 session, after Varsha (tester) reported on Android. Krishna's issue (item #10) is related but distinct.

### 11. OTP cache bug in merchant Ready tab
- **What:** On the merchant app's Ready tab, the "Enter customer OTP" input is **pre-filled with the OTP from a previously-completed order** instead of starting empty for each new order. Input UI state is not being reset between orders. Confirmed by Pranav 2026-05-26.
- **Why it matters:** Annoying UX — merchant has to clear the field manually. Potential safety issue: if the merchant doesn't notice the pre-fill and taps Complete, the system tries to verify the WRONG OTP against the current order. Could silently fail OR accidentally succeed if both OTPs match.
- **Scope when picked up:** Likely a small React state-management fix in the merchant app's Ready-tab order-complete flow. Component probably maintains OTP input state without resetting on modal close or order switch.
- **Status:** Queued.
- **Date added:** 2026-05-26
- **Originated from:** Pranav's observation during post-RLS-fix testing on May 26.

### 13. "Order Sync Failed — Network request failed" pattern (root cause confirmed 2026-05-26)
- **What:** Customer-side network failure during the brief window between Razorpay payment success and POST /orders. Investigated thoroughly 2026-05-26 with Leo pets test case (`pay_Stt2klnzcwRdw0`, customer `c94819d2-…`). Confirmed root cause: **transient mobile-network flake** at the exact moment the customer app fires POST /orders, especially with UPI which has a longer Razorpay WebView interaction. Customer eventually retried at a different store (Varsha bangles, payment `pay_StuGFBcO9KWAoN`) — confirming no code bug, just network flakiness.
- **Diagnostic SQL for future occurrences:** Cross-reference `order_requests.consumer_user_id` + Razorpay payment_id from the failure screen. Compare with `orders.metadata->>'razorpayPaymentId'` — if no match, the order never landed.
- **Current handling:** Stranded `order_requests` rows sit ACCEPTED forever because the 2-min client-side timeout only fires if the app stays open. Server-side expiry (item #17) and webhook-based order creation (item #18) are the proper fixes.
- **Likely causes (unconfirmed):**
  - Customer's network dropped during the API call (most likely on Android with flaky connectivity)
  - API endpoint unreachable transiently (DNS, gateway, server briefly down)
  - Timeout exceeded (the customer-app's `fetch` has a 10s default per `api.ts`)
  - Razorpay WebView session-eviction interfering — though `DiningCheckoutScreen` and `CheckoutScreen` both have `refreshSession` recovery patterns (per earlier audit)
- **Why it matters:** Same outcome as Varsha's bug from the customer's perspective — money in Razorpay limbo, no order in our system. But different root cause class — fixing this requires either: (a) retry-on-network-error in `POST /orders`, (b) idempotent server-side reconciliation, (c) a "you paid, your order didn't go through, retry" UX, OR (d) server-side payment-webhook-driven order creation that's independent of the customer's network state.
- **What we need from the team:**
  - Store/branch the order was placed against
  - Pickup or Dine-in
  - Approximate time of failure with timezone
  - Customer phone / user account
  - Whether this is a one-off or reproducible
  - Whether the user was freshly logged in or had been using the app
- **Scope when picked up:** `apps/consumer-app/src/lib/api.ts` (could be `CheckoutScreen.tsx` / `DiningCheckoutScreen.tsx` but those are LOCKED). Possibly API-side `POST /orders` to make order creation idempotent based on payment_id + order_request_id, so a retry doesn't create duplicates but a fresh attempt can succeed.
- **Status:** Urgent — investigate when team details arrive. Likely not solvable without webhook-driven server-side flow long-term.
- **Date added:** 2026-05-26
- **Originated from:** Team test on May 26, 2026 at 11:34 IST.

### 14. Cosmetic data cleanup (low priority)
- **What:**
  1. 6 merchants have `Store.merchant_id IS NULL` despite their Store row being correctly `id`-matched (Pooj Kitchen, Teja stationary, Ak colths, Leo pets accessories, Freshly, Freshly Foods). Cosmetic data drift — doesn't break anything but should be backfilled for consistency.
  2. "Security Test Store" is a leftover test merchant in production data (`c210042f-…`). Should be deleted or marked as test.
  3. "Test City" + "Test City 1774176523" entries in the `City` table — leftover test data.
  4. "Teja stationary" merchant has a branch called "Puja Stationary" — apparent naming mistake. Worth a manual review by the merchant or admin.
- **Why it matters:** Doesn't affect functionality today, but creates confusion in admin tools, queries, and reports. Pre-launch cleanup hygiene.
- **Scope:** All DB-only updates / deletes. Safe to do whenever.
- **Status:** Queued, low priority.
- **Date added:** 2026-05-26

### 15. Phone format inconsistency in `merchants` table
- **What:** Most merchant rows have 10-digit phones (`9182369196`), but Freshly (Pranav's account) has the with-prefix format (`919959777027`). Inconsistent storage breaks naive phone-based JOINs and equality checks — we already had to handle this with `OR u.phone = ('91' || m.phone)` workarounds during today's backfill.
- **Why it matters:** Will keep biting us in future code (notifications, OTP lookups, etc.). Worth normalizing to a single format.
- **Scope:** DB migration to normalize, plus a CHECK constraint to enforce going forward, plus possibly a code review of every place that writes to `merchants.phone`.
- **Status:** Queued, medium priority.
- **Date added:** 2026-05-26

### 17. Server-side `order_requests` expiry mechanism (HIGH priority)
- **What:** Currently the 2-minute timeout on PENDING/ACCEPTED order_requests is implemented purely client-side via `setTimeout` in `useOrderRequests.ts`. If the customer app closes, crashes, or loses connectivity at the moment of failure (e.g., the "Network request failed" scenario), the timer never fires. The row stays ACCEPTED forever in the DB → merchant's UI shows phantom approved-but-no-payment requests indefinitely.
- **Why it matters:** Investigation on 2026-05-26 found 2 stranded ACCEPTED order_requests from over an hour before the discovery. The Leo pets merchant was likely seeing both as "pending work" with no way to resolve them. We had to manually `UPDATE … SET status='EXPIRED'`. This will keep happening.
- **Proposed fix:** Postgres `pg_cron` extension or a periodic API job that runs every few minutes and flips overdue rows (`created_at + interval '5 minutes' < now()` AND `status IN ('PENDING','ACCEPTED')`) to `EXPIRED`. Or a Supabase scheduled function. DB-only fix, no app code change required.
- **Risk:** Low. Additive. Reversible.
- **Status:** Queued, high priority — every Razorpay-failed payment leaves a phantom row otherwise.
- **Date added:** 2026-05-26
- **Originated from:** Leo pets stranded-payment investigation, May 26 2026.

### 18. Razorpay webhook → server-side order creation (PROPER long-term fix)
- **What:** Move the `orders` row creation from the customer-app's POST /orders to a server-side handler triggered by a Razorpay payment-success webhook. Customer pays → Razorpay sends webhook to our API → API verifies signature, looks up `order_request_id` from payment notes/receipt, creates the `orders` row idempotently (deduped on `razorpayPaymentId`). The customer's network state at the POST /orders moment stops mattering.
- **Why it matters:** This is the **only real fix** for the "Network request failed" bug class. Every other approach (client retry, idempotent endpoints, etc.) is a band-aid. With the webhook approach, even if the customer's app crashes/dies right after payment, the order still gets created server-side. Customer-app just shows "Order will appear shortly" instead of "Order Sync Failed."
- **Scope:** Significant. Touches:
  - API: new endpoint `/webhooks/razorpay` with signature verification
  - API: refactor `POST /orders` to be a no-op or fallback if order already exists (idempotency via payment ID)
  - Customer app: change failure UX from "Sync Failed" to "Processing — refresh in a moment"
  - Razorpay dashboard: configure webhook URL + secret
  - Possibly Razorpay payment notes need to carry `orderRequestId` so the webhook handler knows what to create
- **Risk:** Medium. Significant change to the payment-to-order pipeline. Needs careful testing in Razorpay sandbox before production. Won't break existing flow (POST /orders can stay as fallback), but webhook is the new source of truth.
- **Status:** Queued for proper engineering sprint (not a same-day fix).
- **Date added:** 2026-05-26
- **Originated from:** Leo pets investigation showed customer paid Razorpay successfully but app couldn't tell us; investigation concluded this is unfixable purely client-side.

### 20. Reschedule + Reorder for both pickup and dining (PRODUCT feature)
- **What:** Two related customer-app capabilities:
  1. **Reschedule** an existing booking/order time slot after the customer has already selected it. For dining (booked table slot) AND pickup (chosen pickup time). Customer can move their slot earlier/later without cancelling + re-ordering.
  2. **Reorder** from a previously ordered store. One-tap "order the same thing again" from order history. Works for both pickup and dining.
- **Why it matters:**
  - Reschedule: today, if a customer's plans change, they must cancel + place a new order = bad UX, lost cart, possible refund-then-pay cycle. Common request in food/grocery apps.
  - Reorder: massive UX win for repeat customers. Single-tap to re-trigger their cart with the same items at the same store. Drives retention.
- **Scope:**
  - **Reschedule UI:** new screen / modal on OrderDetail with slot picker. Backend endpoint to update `orders.pickup_time` (or `dine_in_time` / `slot_id`) with merchant notification.
  - **Reschedule rules:** merchant should be able to set "reschedule cutoff" (e.g., must reschedule at least 1 hr before slot). Possibly a paid feature.
  - **Reorder:** add "Reorder" button on past order cards in `YourOrdersScreen`. Tapping copies the order's items into the cart, navigates to checkout. Edge cases: items no longer in stock, items removed from store, price changed since last order.
- **Status:** Queued, product feature — not a bug fix. Significant scope.
- **Date added:** 2026-05-26
- **Originated from:** Pranav's request, May 26 2026.

### 21. Instagram tagging & hashtag campaign integration (FUTURE)
- **What:** Build the Meta Graph API integration for the "Local Stores & Their Stories" social movement campaign. Capture @mentions of `@pickatstore` and posts using `#LocalStoresAndTheirStories` to power the Live Memory Map, Digital Memory Wall, and Memory Chain features.
- **API cost:** $0 from Meta directly. Indirect costs: 2-4 weeks of App Review wait time, 1-2 weeks of dev integration work, optional paid third-party tools ($50-200/month) for broader coverage if needed.
- **Capability summary:**
  - ✅ Real-time webhook for @mentions of business account (most reliable channel)
  - ✅ Mentions in comments, photos, reels, stories
  - ⚠️ Hashtag search limited to 30 unique hashtags / 7-day rolling window per account
  - ❌ Hashtag posts from PERSONAL Instagram accounts will NOT appear in API results (only Business/Creator accounts) — single biggest limitation
  - ❌ No webhooks for hashtags; must poll
  - ❌ Stories not indexed in hashtag search
  - ❌ Cannot store media beyond 24 hours per Meta Platform Terms (need re-fetch or user consent)
- **Required UX strategy:** Ask users to BOTH @-mention `@pickatstore` AND use the hashtag, to maximize API capture rate. Add a landing-page "submit your story" form to catch the personal-account hashtag-only posts.
- **Pre-requisites checklist before dev work:**
  - Verified Instagram Business or Creator account for `@pickatstore`
  - Facebook Business account + Facebook Page linked to the Instagram account
  - Meta Developer account + app created
  - App Review passed for `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list` (2-4 weeks of waiting)
- **Reference reading:**
  - https://developers.facebook.com/docs/instagram-api/
  - https://developers.facebook.com/docs/instagram-api/guides/mentions
  - https://developers.facebook.com/docs/instagram-api/guides/hashtag-search
  - https://developers.facebook.com/docs/instagram-api/guides/webhooks
- **Status:** Queued — separate later session when campaign is ready to launch and Meta App Review can be initiated.
- **Date added:** 2026-05-26
- **Originated from:** Founders' campaign brief discussed May 26, 2026. Full Q&A captured in earlier session messages.

### 22. Customer app notifications — full plan (14 scenarios across 4 phases)

**Pickup lifecycle (6 events):**
1. **Order confirmed, proceed to payment** — fires when `order_requests.status` → `ACCEPTED`. Immediate. Push + in-app. Tap → CheckoutScreen.
2. **Payment successful, order processing** — fires when `orders` row inserted with `ispaid=true`. Immediate. Push + in-app. Tap → OrderDetail (status Confirmed).
3. **Order packed, ready for pickup** — fires when `orders.status` → `READY`. Immediate. Push + in-app. Tap → OrderDetail (shows pickup OTP).
4. **Reminder: Pickup slot in half an hour** — scheduled, 30 min before `pickup_time`. Time-scheduled. Push only. Tap → OrderDetail.
5. **Your order is waiting (10 min before slot)** — scheduled, 10 min before `pickup_time`. Time-scheduled. Push only. Tap → OrderDetail.
6. **Order picked up, enjoy!** — fires when `orders.status` → `COMPLETED` (after OTP verify). Immediate. Push + in-app. Tap → OrderDetail / review prompt.

**Dine-in lifecycle (3 events):**
12. **Dine in slot booked** — fires when `orders` inserted with `order_type='dine-in'` AND `status='CONFIRMED'`. Immediate. Push + in-app. Tap → OrderDetail with booking info.
13. **Dine in slot in half an hour, confirm your visit** — scheduled, 30 min before `dine_in_time`. Time-scheduled. Push. Tap → OrderDetail with "Confirm Visit" button.
14. **Your food is waiting, have you arrived?** — fires when `orders.status` → `READY` AND `order_type='dine-in'`. Immediate. Push + in-app. Tap → OrderDetail.

**Cancellation / Return / Refund lifecycle (5 events):**
11. **Order cancelled** — fires when `orders.status` → `CANCELLED` OR `order_requests.status` → `REJECTED`/`EXPIRED`. Immediate. Push + in-app.
7. **Return request raised** — fires when customer submits return form. Immediate. In-app + push (confirmation). *Requires return system — doesn't exist yet.*
8. **Return successful** — fires when merchant/admin marks return processed. Immediate. Push + in-app. *Requires return system.*
9. **Refund request raised** — fires when customer submits refund OR auto-triggered by return approval. Immediate. In-app + push. *Requires refund system.*
10. **Refund successful** — fires when Razorpay refund webhook fires OR admin marks completed. Immediate. Push + in-app. *Requires Razorpay refund integration.*

**Infrastructure required:**
- ✅ Already exists: `notifications` table, server-side `notificationService`, realtime subscription pattern.
- ❌ Need to build:
  - Customer-side push token registration (mirror of merchant's `usePushNotifications` + new API endpoint)
  - Customer-side notification list screen + bell icon
  - Scheduled notifications infrastructure (server-side cron — recommended over client-side `expo-notifications.scheduleNotificationAsync` for durability across reinstalls)
  - Return + Refund tables/flows (don't exist yet — these are features, not just notifications)
  - Razorpay refund integration
  - Order detail deep-link support
  - Notification preferences UI (opt-in/out per category)

**Recommended implementation order (4 phases, ~15-20 dev-days total):**
- **Phase 1 (3-5 days):** Push infrastructure + in-app list + 7 immediate events (#1, #2, #3, #6, #11, #12, #14). Doesn't depend on building new features. Biggest value-for-effort.
- **Phase 2 (3-5 days):** Scheduled notifications via server-side cron (also solves forlater #17 — order_request expiry). Wire #4, #5, #13.
- **Phase 3 (7-10 days):** Build return + refund system end-to-end. Then wire #7, #8, #9, #10.
- **Phase 4 (2-3 days):** Preferences screen, archival/TTL, tap analytics, polish.

**Sample copy for each notification:** Captured in May 26 session messages — finalize tone with founders before shipping.

- **Status:** Queued — major scope. Wait until merchant notification gaps (item #23 below) are closed before starting customer-side.
- **Date added:** 2026-05-26
- **Originated from:** Founders' 14-instance list shared May 26, 2026.

### 23. Merchant app notifications — fix gaps (audit completed)

**🔴 Critical (in-progress now per May 26 session):**
1. OS push notification tap doesn't deep-link. Server already sends `referenceId` in data payload; merchant app never registers `addNotificationResponseReceivedListener`. Result: tapping a notification opens the app's last route, not the relevant order. **Single biggest UX gap.**
2. In-app notifications list tap doesn't deep-link. `notification.link` is never populated by the server.
3. Type taxonomy inconsistent across 3 layers (lowercase TS union, uppercase server emits, third taxonomy in dead `NotificationCenter.tsx`). Result: most notifications fall back to default bell icon because type strings don't match.

**🟡 Important:**
4. Android 13+ `POST_NOTIFICATIONS` permission missing from `apps/merchant-app/app.json`. Newer Android users may have notifications silently disabled.
5. Settings toggle for `CANCELLED` doesn't match the actual emitted type `ORDER_CANCELLED`. Toggle silently doesn't apply to customer-cancellation events.
6. `metadata` column on notifications table defined but never written. Could carry order total, customer name, item count for rich offline browsing.

**🟢 Missing functionality (require underlying features):**
7. No notifications for payouts, refunds, returns, reviews, ratings, KYC status, payment-only (separate from order-created).
8. Low-stock notification piggybacks on `POST /orders` only. No scheduled or manual-edit trigger.
9. No retry/dead-letter on Expo push API failures — errors only logged.
10. No notification archival/TTL — `notifications` table will grow unbounded.

**🗑️ Dead code:**
11. `apps/merchant-app/src/components/NotificationCenter.tsx` defined but never mounted. Either wire up or delete.
12. `deviceId` field exists end-to-end (DB column, API route param) but never sent from the merchant client.

**Already working events** (don't break these when fixing gaps):
- New order placed (`NEW_ORDER`)
- New order request (`NEW_ORDER_REQUEST`)
- Order request cancelled (`ORDER_CANCELLED`)
- Order cancelled lifecycle (`CANCELLED`)
- Rider arrived (`RIDER_ARRIVED`)
- Status changes (`ORDER_UPDATE`)
- Order completed via OTP (`COMPLETED`)
- Low stock during order creation (`LOW_STOCK`)

- **Status:** IN PROGRESS as of 2026-05-26 session.
- **Date added:** 2026-05-26
- **Originated from:** Read-only audit of merchant notifications, May 26 2026.

### 19. Other stranded customer at Leo pets — `dbae65f2-…` / consumer `6ec2ee0f-…`
- **What:** During the Leo pets investigation, found a SECOND stranded ACCEPTED order_request (`dbae65f2-…`) from a different consumer (`6ec2ee0f-…`) at 06:01:35 UTC — 8 seconds before the team's reported failure. Same merchant, same time window. The team only mentioned ONE tester (phone 7842687373); this is a different person.
- **Why it matters:** Possibly another silent failure where a customer paid Razorpay but didn't report the issue. They may have:
  - Just walked away assuming it didn't work
  - Tried again silently
  - Their payment might also be stranded at Razorpay needing refund
- **Action needed:** Ask the team to identify who this customer is (consumer_user_id `6ec2ee0f-…`). Cross-reference with Razorpay dashboard for any payments around 06:00 UTC 2026-05-26. If a payment exists, refund.
- **Status:** Queued, operational follow-up.
- **Date added:** 2026-05-26

### 16. Verify Trigger 1 + Trigger 2 in real-world signup
- **What:** Triggers installed and chain-tested in synthetic transactions, but not yet observed firing during a real merchant signup. Have a tester sign up a brand-new merchant via the merchant app and confirm: (a) `merchants` row created, (b) `merchant_branches` row auto-created by Trigger 1, (c) `store_staff` row auto-created by Trigger 2, (d) `Store` row aligned by pre-existing trigger.
- **Why it matters:** Trust but verify. Synthetic tests pass; real-world tests confirm.
- **Scope:** Operational — 5 minutes of testing, no code or DB changes.
- **Status:** Queued, do whenever a tester has bandwidth.
- **Date added:** 2026-05-26

### 12. "Manager creates new branch → becomes owner of it" — noted decision, not a bug
- **What:** As part of the Phase 3 store_staff DB trigger (Path A), whoever inserts a new `merchant_branches` row will automatically get assigned as `'owner'` in `store_staff` for that branch. This is the **correct** behavior — whoever creates a branch is presumed authorized for it. If they're not, that's a permissions issue at the trigger's calling site (i.e., who's allowed to create branches), not a bug in the trigger.
- **Why it matters:** Documenting this so future reviewers don't see "manager became owner of a new branch" and think the trigger is broken. It's working as designed.
- **Status:** Decision recorded — no action needed unless permissions model changes.
- **Date added:** 2026-05-26

### ~~10. Krishna's issue — paid order not appearing in merchant tabs~~ — RESOLVED 2026-05-26
*Closed by orders RLS structural fix + store_staff backfill. See Done section.*

### 10. Krishna's issue — paid order not appearing in merchant Processing or Ready tabs [closed]
- **What:** Merchant approves order on merchant app → customer pays on customer app → customer sees "Order Confirmed" with order number `PAS-20260526-7500`, payment ID `pay_StrRGarBSyUiPO`, store "Ak colths". Merchant checks Processing and Ready tabs — order absent. Same symptom shape as the bug we fixed earlier today (orders RLS structural bug) but possibly different root cause, since RLS has been corrected.
- **Likely causes (ranked, unconfirmed):**
  1. "Ak colths" merchant doesn't have a `store_staff` row linking Krishna's auth.uid to any branch → RLS-after-JOIN still returns zero rows. Same root pattern as Classic Cafe before we backfilled.
  2. Krishna is viewing **Main Store** in merchant app; the order's `branch_id` is a real branch UUID; the merchant `useOrders.ts` Main-Store filter (`branch_id IS NULL OR branch_id = merchantId`) still excludes real-branch orders. This is the pre-RLS query layer that we never fixed today.
  3. Krishna's active branch in merchant app doesn't match the branch the order was placed against.
- **Why it matters:** Same risk shape as the earlier Classic Cafe bug — merchant has been paid for an order they can't see → won't fulfill → customer arrives, no order, dispute.
- **Scope when picked up:** Data check first (SQL on order, on `store_staff` for Ak colths, on Krishna's user link). If data is fine and bug is in query layer, fix `useOrders.ts` Main Store branch filter.
- **Status:** Urgent — investigate inline. Diagnostic SQL queries written and pasted to Pranav.
- **Date added:** 2026-05-26
- **Originated from:** May 26 session, immediately after Varsha's issue.

---

## In progress

### Frequent signout investigation & fix — STARTED 2026-05-26
- **What:** Customer + merchant apps sign users out frequently. Investigation done; staged fix plan approved (Phase 1 → 2A → 2B → 2C). One diff + tsc + approval at each step.
- **Audit root causes (confirmed):**
  - **Customer:** `apps/consumer-app/src/lib/api.ts:45-89` 401 interceptor calls `purgeAuthSession()` → `supabase.auth.signOut({ scope: 'local' })` on ANY 401 response. Single point of failure for "stale session" and "dumped to home" symptoms.
  - **Merchant:** `apps/merchant-app/src/lib/supabase.ts` — (1) `ExpoSecureStoreAdapter` swallows all keychain errors silently, (2) no AppState gating of `startAutoRefresh`, (3) uses `setSession()` instead of `refreshSession()` (consumer-app deliberately avoids the former due to GoTrue hang).
- **Plan:**
  - **Phase 1 (Customer):** Soften 401 interceptor in `api.ts`. Attempt refresh on 401, retry original request once if refresh succeeds; only purge session on confirmed permanent auth failure.
  - **Phase 2A (Merchant):** Add error logging to `ExpoSecureStoreAdapter` catches in `supabase.ts`. Diagnostic only — no behavior change.
  - **Phase 2B (Merchant):** Add AppState `startAutoRefresh` / `stopAutoRefresh` gating to `supabase.ts`.
  - **Phase 2C (Merchant):** Switch `setSession` → `refreshSession` in `setSessionFromTokens` in `supabase.ts`.
  - **Phase 3 (Optional):** Migrate merchant from SecureStore → AsyncStorage if 2A-C insufficient.
- **Scope:** `apps/consumer-app/src/lib/api.ts` + `apps/merchant-app/src/lib/supabase.ts`. Locked files (consumer `supabase.ts`, `AuthContext.tsx`, `CartContext.tsx`, `CheckoutScreen.tsx`, `DiningCheckoutScreen.tsx`) NOT touched.
- **Originated from:** May 26 session — Pranav flagged as task #5 in a multi-ask message.

---

## Done — archived

### Android order realtime polling fallback — DONE 2026-05-25
- Shipped consumer OTA `a7ea5ab9-...`. Polling + AppState reconnect in `useOrderRequests.ts`. Verified on Android pickup orders. File now `// @lock`.

### Merchant branch state sync (`is_active`) — DONE 2026-05-26
- Shipped merchant OTA `ede26024-...`. AppState + Realtime UPDATE + 60s polling fallback in `StoreContext.tsx`. Also enabled `ALTER PUBLICATION supabase_realtime ADD TABLE merchant_branches`. Verified sub-5-second propagation both directions.

### Orders RLS structural fix — DONE 2026-05-26
- DB-only. Rewrote `Merchants can view their store orders` and `Merchants can update their store orders` policies on `orders` to JOIN through `merchant_branches` (translating branch_id in `store_staff.store_id` → `merchant_id` in `orders.store_id`). Verified end-to-end via real test orders that had been invisible — they reappeared, were marked complete via OTP. Fix applies to every merchant in the system, not just Classic Cafe.

### Branch A coords fix — DONE 2026-05-26
- DB-only. Set `latitude=16.8165, longitude=81.812` on Branch A (Pranav-owned Freshly Vadapalli) so it surfaces in the customer app's nearby search. Both Freshly Vadapalli branches now visible to customers in Vadapalli.

### Signout fix — Phase 1 (consumer 401 interceptor) — DONE 2026-05-26
- Consumer OTA `b30507b4-3918-4e0b-a4af-29607669aeba`. `apps/consumer-app/src/lib/api.ts` 401 interceptor now does soft-recovery: try refresh + retry original request once before purging session. Purges only on permanent failures (`invalid_grant`, etc.). Eliminates the "transient 401 = forced signout" pattern.

### Signout fix — Phase 2A (merchant SecureStore observable) — DONE 2026-05-26
- Merchant OTA `19d7086a-6deb-4767-87e0-97742a4d40cd`. `apps/merchant-app/src/lib/supabase.ts` `ExpoSecureStoreAdapter` now logs `[SecureStore]` warnings on keychain failures instead of swallowing them silently. Diagnostic only — no behavior change. Awaiting in-the-wild logs from device tethering (iOS Console.app or `adb logcat`).

### Krishna's bug — orders RLS structural fix — DONE 2026-05-26
- DB-only. Rewrote `Merchants can view their store orders` and `Merchants can update their store orders` policies on `orders` to JOIN through `merchant_branches` (resolves the branch_id vs merchant_id semantic mismatch between `store_staff.store_id` and `orders.store_id`). Now every merchant with proper `store_staff` linkage can see their own paid orders.

### Systemic store_staff backfill — DONE 2026-05-26
- DB-only. 9 merchants (out of 11 active) were missing `store_staff` rows for their owners. Backfilled with `INSERT INTO store_staff ... SELECT DISTINCT ON (m.phone) FROM merchant_branches mb JOIN merchants m JOIN auth.users u`. One row per merchant, linking auth.uid → oldest branch with role='owner'. The remaining 2: Pranav-Freshly already had a row; Security Test Store has no real auth user.

### Varsha bangles bug — Store.id realignment — DONE 2026-05-26
- DB-only. `orders.store_id → Store.id` FK was failing because Varsha bangles' Store row had `id = 63c32d5a-…` (a fresh UUID generated at signup in April 2026, pre-existing trigger). Updated 23 `StoreProduct` rows and the 1 `Store` row to use `id = e49016c2-…` (her merchant_id). Future orders for Varsha bangles will pass FK.

### Phase 3 — DB triggers for signup integrity — DONE 2026-05-26
- DB-only. Two triggers installed:
  1. `trigger_auto_create_default_branch` (AFTER INSERT ON `merchants`): creates a default `merchant_branches` row with id = merchant_id if none exists. Closes Gap A (single-store merchants previously got no branch).
  2. `trigger_auto_create_owner_store_staff` (AFTER INSERT ON `merchant_branches`): creates an `owner` `store_staff` row linking the merchant's auth uid → the new branch. Closes Gap B (no store_staff at signup).
- Both verified via chain test: merchants INSERT → Trigger 1 → branch INSERT → Trigger 2 → store_staff INSERT, all in one transaction.
- Combined with pre-existing `trg_auto_link_store_merchant` (Store.id alignment) and `trg_sync_merchant_data_robust` (User row), every future merchant signup is now data-integrity-complete by construction.

---

## Strikethroughs (no longer relevant)

*(none)*
