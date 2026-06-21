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

## 🎯 PRIORITY QUEUE — Pranav's directive (2026-06-19)
> After reviewing `docs/pas-complete-assessment-shipped-and-pending-2026-06-19.html`, Pranav set this exact order to fix immediately, then revisit the rest. Work ONE at a time, approval-gated. Numbers = the assessment doc's Part-4 pending numbering.
- ✅ **NEW FEATURE — admin category enable/disable — SHIPPED (2026-06-21).** Admin can toggle any of the 15 Verticals + 136 Tier2Categories on/off; OFF hides the category + all its products from customers instantly (RESTRICTIVE RLS, no app update), auto-drops empty stores from discovery (`get_nearby_stores`), blocks new merchant listings (configure 403) + new orders (`POST /order-requests` 403 `CATEGORY_UNAVAILABLE`). Single coupled toggle (customer + merchant together, decision D2). **LIVE:** 3 DB migrations applied (`39aedd0c`/`03a18f2d`/`d0f63da4`), API deployed to EB (`app-260621_224810548610`). **⚠️ admin Categories tab NOT on prod yet** — only PREVIEW-deployed on Vercel (`https://pas-admin-hkt6v8hrp-ideaye.vercel.app`). ROOT CAUSE: production admin-web (admin.pickatstore.io) has been **frozen at the June-15 build** since `e4aa9ebc0`; Vercel deploys `main` but all admin work (incl. the June-17 taxonomy/names fix `6773db05` AND this tab) lives on `feat/consumer-global-config-wiring` → preview-only. FIX = promote the `f1cfbc01` preview to Production in Vercel (stopgap) OR reconcile feat→main (durable; branches diverged — main has Phase 8/9). Data verified clean: 139,965/140,174 products fully categorized, 0 hidden by RLS. **Deferred to next consumer OTA:** the in-app cart prune (T7b, committed `ce571deb`) — the server order-gate already covers correctness. **Future fast-follow:** "Paused by platform" merchant badge; two-toggle split (customer-hidden vs merchant-allowed). Spec `docs/category-visibility-toggle-spec-2026-06-19.html`, plan `docs/superpowers/plans/2026-06-19-category-visibility-toggle.md`.
- **#16 Security & deadlines — FIRST (in progress).**
  - ✅ **#16a credentials.json untracked + gitignored** (commit `780b024a`; local files kept so eas build works). **PENDING DECISION — keystore ROTATION:** passwords are in git HISTORY, but the `.jks` is NOT in git → not exploitable alone; clean fix = Play Console upload-key reset (NB both apps share ONE keystore — merchant `credentials.json` points at consumer's `.jks`). Rotate now vs accept residual history risk = Pranav's call.
  - **#16b GRANT migration:** deadline **Oct 30, 2026** — add `GRANT … TO authenticated, anon` to new-table migrations now (PR checklist) + audit existing tables before the date (schedule ~early Oct). (EB slow-deploy reminder below is RESOLVED — deploys are ~1 min now.)
  - **#16c broad RLS sweep:** separate focused audit — schedule after the queue.
- **#14** Full notification scenario coverage (customer 14-scenario plan across 4 phases + merchant gaps).
- **#11** KYC approval UX overhaul (decision audit trail [compliance], view uploaded PDFs, show hidden captured fields, panel redesign, Approve-confirm).
- **#8** Pack-size / sibling variants (group by sibling; sibling data already in `extraData`).
- **#7** Delete legacy/test products (`source='zepto'` 134 + null 111 + live_sync 39) — confirm first.
- **#6** Drop `StoreProduct.storeId` column (B10) — gated on merchant 1.2.6 build live + adopted on BOTH stores.
- THEN revisit the rest of Part 4 (legal #1-4 [agreements re-draft, Play login fix], payout #5, etc.).

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

## 🎟️ Coupon Foolproof — deferred audit findings + open flags (added 2026-06-10)

### 🔐 Phase 8 RLS lockdown — IN PROGRESS (2026-06-13)
**Item 1 (User + order_items + 5 defense tables RLS) — DONE & APPLIED to prod** (PR #3, migrations 20260611020000 + 030000). Verified: scripts/p8_rls_verify.ts all pass.

**Item 2 (merchant_branches write lockdown) — backend + app routing DONE; lockdown migration GATED:**
- ✅ API: POST/PUT/DELETE /merchant/branches (userCanManageMerchant / userCanManageBranchFull / isPlatformAdmin). Deployed to EB.
- ✅ merchant-app: services/branches.ts + branches.tsx + settings/index.tsx + StoreContext (toggleStoreStatus, updateStoreDetails) all route through API. **Rides next merchant OTA.**
- ✅ admin-web: useMerchants.ts add/deleteMerchantBranch → API. Ships on PR #3 merge to main (Vercel).
- ⛔ **GATED — DO NOT APPLY until merchant OTA propagated**: `apps/api/scripts/phase8_branch_lockdown.STAGED.sql` revokes anon/authenticated INSERT/UPDATE/DELETE on merchant_branches. Verify with phase8_branch_lockdown_verify.ts. This closes "any logged-in user can modify/delete any branch." SELECT stays open (discovery + storefront).
- **Rollout order**: (1) merge PR #3 → main (admin-web live, API already deployed); (2) Pranav OTAs merchant app; (3) after OTA propagates, apply the staged lockdown migration + verify.

### Remaining verified-pending items from the June 6 audit (next, in priority order)
- ~~**#11 OTP modal reset**~~ — ✅ FIXED 2026-06-13 (PR #4, branch fix/merchant-otp-modal-reset). useEffect keyed on (visible, orderId) clears otp/error/loading on each open. Rides next merchant OTA.
- **#7 operating_hours**: 25/26 branches NULL → customer app defaults "Open Now" to true on NULL. Fix: flip default to fail-closed + backfill/prompt.
- **#1 order_number unification** (order_requests has no order_number column).
- **Wati-OTP name capture** (22/32 consumers NULL name).
- **#14 data hygiene**: 2 NULL-merchant_id stores (Clean cuts, Folli Medicals), 2 test cities.
- **#15 phone format** (3 merchants; defer until more scale).


### Phase 7G audit — deferred mediums/lows (added 2026-06-11; blockers + highs all FIXED in commit 04734624)
- **Negative-net cycles & mark-paid semantics** — a clawback-only week produces netPayout < 0; the mark-paid flow treats it like a payout. Needs a founder decision: carry the debt into the next cycle automatically vs invoice the merchant. (audit M-22/M-24)
- **Refund rupee-rounding vs clawback paise** — the cancel path rounds refunds to whole rupees before paise conversion; recorded clawback can differ from moved money by <₹1. Align rounding in one place. (M-21)
- **Close scalability** — the close scans every eligible order since the epoch in one IN-list; fine now, needs paging before order volume grows (thousands/week). (M-31)
- **Missed-Monday catch-up** — if the process is down at Mon 02:00 IST the close is skipped; roll-forward still settles every order at the NEXT close but under the later week's period label. Add a startup catch-up check. (L-39)
- **detectClawback DB uniqueness** — find-then-create idempotency is per (orderId, note); add a defensive unique index if clawback volume grows. (L-43)
- **Order-create price validation** (deep fix for the commission-evasion hole) — items are client-priced at POST /orders; the close-time coherence guard (HOLD + Sentry) is live, but validating against StoreProduct at create time is the root fix. Touches the hot checkout path — schedule deliberately.
- **Payment-verification override UI** — the endpoint exists (POST /admin/orders/:id/payment-verification, audit-logged); an admin surface for it (held-orders worklist) is not built yet. Until then: curl with an admin token.
- **Residual micro-race** — a refund whose transaction commits between the close's in-tx revalidation read and the close commit can settle at full value with no clawback (sub-second window). Sentry's mid-close drop messages + weekly reconciliation cover it; a full fix needs SELECT FOR UPDATE on candidate orders.
- **OPERATIONAL PREREQUISITE for first real settlement**: assign commission categories in admin → Finance → Settlements → Merchants tab. Until assigned, ALL merchants are held (verified by prod dry-run 2026-06-11: 11 orders held no-profile, 0 cycles created). Also decide CRON_DRY_RUN flip-back (set 2026-06-10 ~22:00 UTC for the orphan sweep's first 24h).


> Source: adversarial audits on PR #1 (merged) and PR #2 (branch `coupon-foolproof-phase4-2026-06-09`).
> **Status 2026-06-10:** Phases 1-5 DEPLOYED to EB (`app-260610_132434177329`); PR #2 merge + consumer OTA pending. Full audit report: `docs/coupon-foolproof-audit-phase1-5.html`.

### 🚨 OTA GATES (must land BEFORE the consumer EAS OTA — from full audit 2026-06-10)
- **N1 (CRITICAL): thread `storeProductId` into addItem callsites.** No add-to-cart path sets `CartItem.storeProductId` (StorefrontScreen.tsx L402-413, FavoritesScreen.tsx L101-111, useProducts.ts L72) — without this the OTA ships a DEAD coupon feature (every apply fails "items out of date"). Fix: pass `storeProductId: product.id` at each callsite + run the e2e apply test.
- **N3: clear order coupon snapshot on capped multi-store replay** (apps/api POST /orders appended===0 non-idempotent branch) — replayed orders currently still book the slice discount.
- **N5: token-verify failure after payment must not bypass orphan handling** — while REQUIRE_COUPON_TOKEN=false, proceed couponless + Sentry instead of bare 400.
- **N4: clearAppliedCoupon on SIGNED_OUT + cloud-cart restore** (CartContext 🔒 — needs explicit lock override).
- **N6 decision: orphaned-payments sweep cron** (referenced in 3 comments, never built) — build it, or soften the client "automatic refund" copy and accept manual reconciliation.

### Operational flags / gates (time-sensitive, not code)
- **`REQUIRE_ORDERS_AUTH=true` flip** — POST /orders + PATCH /order-requests are in soft-auth (Phase 2J). Flip via `eb setenv REQUIRE_ORDERS_AUTH=true` once Sentry shows `phase: pre-ota-soft-auth` at zero for 24h after the consumer OTA rolls. Added 2026-06-09.
- **`REQUIRE_COUPON_TOKEN=true` flip** — token enforcement is logged-only. Flip after consumer OTA propagates. **Prerequisite met 2026-06-10:** R3 qty-binding landed (`7b07df82`); audit said it must precede this flip.
- **Pre-deploy operational check (eligibleVerticals)** — Phase 5B's server-derived store-id fix means verticals-scoped coupons start WORKING the moment the API deploys (they were silently broken before). Review with Pranav which verticals-scoped coupons exist and whether their budgets are intended to go live. From Phase 5 audit cleanup #5.
- **branch_id NULL count query** — run `SELECT COUNT(*) FROM "StoreProduct" WHERE branch_id IS NULL AND is_deleted = false;` before relying on branch-grouped allocation. From Phase 5 audit cleanup #9.

### Consumer-app (CheckoutScreen 🔒 — each needs explicit lock override)
- **R4 — stale discount at payment consent.** After a store rejection, the results screen shows the full-cart discount; the tap silently re-validates and Razorpay asks for a higher amount with no in-app explanation. Money-safe but a trust gap. Fix: confirmation line ("Store B declined — your discount is now ₹60, total ₹X. Continue?"). From Phase 5 re-audit, 2026-06-10.
- **R5 — late swap-accept during Razorpay window (PRE-EXISTING).** Merchant accepts a pending swap while the payment sheet is open → fresh closure POSTs a paid:true order for a store whose subtotal was never charged. Fix: snapshot accepted-request ids at confirmAccepted; handlePaymentSuccess iterates only the snapshot. From Phase 5 re-audit.
- **R6 — per-store GST whole-rupee drift (PRE-EXISTING).** `groupGst = Math.round(finalGstToPay * share)` drifts ±₹1 from the charged GST across stores; discount is now paise-exact but GST isn't. Same largest-remainder treatment as the discount split would fix it.

### Backend (apps/api) — mediums from PR #1 + Phase 5 audits
- **Single-store token jti single-use** (PR #1 medium #9) — multi-store now has the jti fingerprint + R1 cap; the SINGLE-store path token is still replayable across distinct orders within 10 min (bounded by per-(coupon,order) unique + usage counters). Full fix: persist consumed jtis with TTL.
- **perCustomerLimit atomic CAS** (PR #1 medium #7) — checked only at validate-time, race-able across concurrent checkouts. In-txn count or partial unique index.
- **Payment-level idempotency index** (PR #1 medium #12) — partial unique on `orders(metadata->>'razorpayPaymentId', store_id)`. Requires migration.
- **Store-scope coupon check broken both ways** (Phase 5 audit cleanup #4, PRE-EXISTING) — `coupon.storeId` comparison uses client-supplied storeId in the single-store path; id-space ambiguity (Store id vs branch id). Server-side derivation now exists for multi-store; extend to single-store.
- **Partial unique index drift risk** (Phase 5 audit cleanup) — `coupon_redemption_cart_fingerprint_unique_idx` lives only in migration SQL (Prisma can't express partial indexes); a future schema reset could drop it. Schema comment exists; consider a CI check.
- **Rate-limiter sweep** (PR #1 low #5) — in-memory Map grows unbounded on long uptimes; add setInterval sweep.
- **BOGO 0/0 infinite-loop guard** (PR #1 low #6) — server-side validator refusing bogoBuy<=0 || bogoGet<=0 on POST /coupon.
- **Idempotency-Key honor on POST /coupon** (PR #1 low #14) — admin-web sends it; server ignores it.
- **GIN index on split_order_ids** (Phase 5 nit) — cancel-path `splitOrderIds has` is a sequential scan today; fine at current volume.

### Admin-web
- **CouponBuilder field extensions** (queued earlier in this file, still open) — dailyUsageLimit, eligibleVerticals, eligibleOrderTypes, bogoMode, inactiveSinceDays not settable from the builder UI; admins use direct DB.

### Consumer-app nits (locked files — need explicit override)
- **Dead static-data imports** in StorefrontScreen.tsx L17 + FavoritesScreen.tsx L17 (RESTAURANTS/STORES never used; products fallback provably empty). Pre-existing; flagged by Phase 6 audit 2026-06-10. One-line removals, both files 🔒.

### Phase 7 design decisions (carry into the settlement discussion)
- **RETURN_REJECTED revenue rule**: orders never return to COMPLETED after a won return dispute, so earnings (and now coupon reimbursement aggregates) stop counting them. Decide whether RETURN_REJECTED / partially-refunded orders count as settled revenue + reimbursable, and apply the same rule to both aggregates. (Phase 6 audit, 2026-06-10.)
- **Anomaly-set rule**: snapshot-less orders whose total diverges from items-gross are the Sentry-flagged N3/N5 anomaly set — Phase 7 settlement math should exclude or flag them.

### Process
- **Post-Phase-7/8: full line-by-line consumer-app + merchant-app audit** — Pranav explicitly requested (2026-06-09) a dedicated plan to find plainly-visible errors and loose ends across both apps' native + OTA changes, to be run AFTER Phase 7/8 completes.

---

## ✍️ Merchant e-Sign V1 — deferred reconciliation items (added 2026-06-14)

> The on-screen drawn-signature + personalized signed-PDF feature is IN PROGRESS (plan: `docs/merchant-esign-v1-build-plan-2026-06-14.html`; routing analysis confirmed the vertical→agreement map). These two items were consciously deferred during that design.

### A. Agreement commercial terms vs admin commission_rate — alignment (DECISION: "leave independent for now", 2026-06-14)
- **What:** Each vendor agreement states a FIXED commission in its text (Grocery 2% / Other Stores 5% / Restaurant 5% pickup, 7% pickup+dining) and a fixed onboarding fee (₹999 standard / ₹2,999 restaurant). But admin sets each merchant's `commission_rate` INDEPENDENTLY (`apps/api/src/index.ts:9850`, ADMIN_MERCHANT_COLS). So a merchant can sign a "5%" contract yet be charged a different rate in admin — a contradiction in a legal document.
- **Why deferred:** Pranav chose to ship the fixed-text agreements as-is for V1 and revisit alignment later (AskUserQuestion 2026-06-14).
- **Revisit options:** (1) treat the agreement's stated % as binding + add an admin guard so `commission_rate` must match the vertical's agreement rate; or (2) merge-fill each merchant's actual commission + fee into the agreement so the signed PDF always matches reality (changes legal-text figures → needs CA sign-off).
- **Scope:** apps/api (commission_rate guard) + agreement template (if option 2) + admin-web warning.
- **Originated from:** agreement-routing analysis during eSign V1 design, 2026-06-14.

### B. Bakeries & Desserts — routing/pricing/fee mismatch (added 2026-06-14)
- **What:** Bakeries & Desserts is routed to the **Restaurant agreement** (Pranav's decision — it's food + dining-enabled), but it's priced **standard (₹999)**, not premium. The Restaurant agreement's text states **₹2,999** onboarding + 5/7% commission, so a bakery's signed contract will show ₹2,999 while they actually paid ₹999. Tied to item A.
- **Config inconsistency to resolve:** `getIsDining('Bakeries & Desserts') = true` (`apps/consumer-app/src/utils/dataTransformer.ts:93`) yet the vertical is `isPremium = no`. Decide whether bakeries should be premium-priced (so the Restaurant agreement's fee matches) or whether the dining flag / chosen agreement should change.
- **Why deferred:** rolled up under decision A ("leave independent for now").
- **Scope:** vertical config (isPremium / pricing) + the agreement fee line + the routing helper.
- **Originated from:** agreement-routing analysis 2026-06-14.

### C. Agreement compliance review — findings (added 2026-06-15, 6-domain read-only workflow)
> Full report: `docs/merchant-agreements-compliance-review-2026-06-15.html`. NOT legal advice — for counsel + CA. Below = the must-fix-before-go-live items, several VERIFIED in code.
- **🔴 CRITICAL — 1.9% gateway fee not authorized in the signed text.** No clause anywhere makes the merchant bear it (§23 is liability-disclaimer-only; §3.5/§3.7 "other agreed charges" is undefined). Deducting it on already-signed agreements = unauthorized-deduction exposure. **The payout-build's gateway deduction must NOT go live until the charge is papered + re-consented.** Add an explicit Payment Processing Fee clause + Schedule of Charges.
- **🔴 CRITICAL — commission engine default (8/10) exceeds signed restaurant/bakery rate (5/7).** Migration `20260610170000` seeds Restaurant/Bakery NULL-tier default = 8%/10%; restaurant body promises 5%/7%. No code path links the signed rate to the engine. **Fix before first real settlement:** set NULL-tier default to 5/7 OR capture the signed rate onto the settlement profile at e-sign + have resolveRule() prefer it. (Settlements currently in dry-run, so latent not yet charged — but must fix.)
- **🟠 HIGH — contract says T+2 settlement; system settles WEEKLY** (Mon 02:00 IST close + manual PAID). Structural breach of the written promise. Rewrite §3.5/§3.7 to a weekly cycle + stated post-close SLA.
- **🟠 HIGH — bakery signs ₹2,999 but charged ₹999** (ties to item B) + inherits 8/10 default. Resolve before any bakery signs.
- **🟠 HIGH — 18% GST-on-commission + 0.1% §194-O TDS are only "thin-but-arguable"** in the text (and not implemented in the engine). Add explicit clauses (GST tax-invoice/ITC; TDS authorization + PAN + Form 16A).
- **🔴 Must-haves absent:** real DPDP Data Processing Addendum (only a placeholder §22); FSSAI mandatory licence + consumer-display + PAS's own e-commerce FBO registration (field is optional today); **pharmacy routed to generic template with ZERO drug controls** (block or build e-pharmacy schedule); arbitration/dispute-resolution clause (none, yet §27 references it — add as §34, fills the 33→35 gap).
- **🟡 Enforceability:** drawn signature ≠ §3A e-signature → no §85B presumption (still a valid §10A e-contract via the audit trail — reword §24); **Telangana stamp duty unaddressed** (admissibility risk); missing boilerplate (notices/severability/waiver/signatory-authority/insurance); unilateral-amendment exposure (§3.6/§3.8).
- **Quick wins:** signed Schedule of Charges (puts the full economic deal on the hashed page); §2.5 signatory-authority warranty; §32 timelines (48h + 1 month + ticket #); mandatory FSSAI for food templates; alcohol/tobacco in Prohibited Products.
- **Strengths (fair):** clear intermediary status, named Grievance Officer, real e-execution audit trail (IP/device/SHA-256/click-accepts), Aadhaar last-4 masking, strong indemnity/liability cap, well-differentiated restaurant body.
- **Originated from:** Pranav's request to compare the 3 agreements vs Indian compliance + today's GST/TDS decisions, 2026-06-15.

---

## 📦 Inventory + KYC Hardening — phase-wise plan (added 2026-06-15)
> Full plan: `docs/inventory-kyc-hardening-plan-2026-06-15.html`. Triggered by buying a one-time Zepto dataset (~172,113 SKUs / 40 cats / 451 subcats + sibling sets) to replace expensive APIFY. Read-only 8-agent audit, every claim file:line-verified. 16 phases / 3 tracks (inventory, siblings, kyc-ux). **No code written — phase-wise, approval-gated.**
- **🚨 URGENT, independent of the data buy — ALL catalog/product WRITE endpoints are UNAUTHENTICATED** (`index.ts` ~1500-2420, zero requireAdmin/requireRole). Anyone can inject/promote products or call `/products/bulk-delete` which CASCADES into StoreProduct (merchant inventory). = **Phase 1**, ship regardless of the dataset.
- **MUST-FIX before any 172k load:** (1) Phase 1 auth; (2) Phase 2 data-driven CategoryMapping table — `mapCategory` is an 8-keyword matcher that dumps ~25-35 of 40 cats into `'General'` (not a real category → `category_id=NULL`); (3) Phase 5 delete the `MRP>1000?/100` heuristic — corrupts every genuine ₹1200 product → ₹12; (4) Phase 5 streaming/chunked/resumable bulk-load CLI bypassing the queue + HTTP handler (current path = whole file in memory + 172k serial awaits in a 60s tx, can't finish); (5) Phase 3 additive `Product.variantGroupId/variantLabel` cols BEFORE load (else sibling linkage lost); (6) Phase 4 reconcile StoreProduct migration drift; (7) don't stage 172k into the unbounded sync-queue UI (freezes the tab).
- **BROKEN today:** `POST /products/bulk-import-json` passes a non-existent `category` key masked by `:any` → Prisma rejects 100% of rows at runtime (Phase 6).
- **Siblings:** NOT supported (no parent/variant-group anywhere; the merchant picker's `cleanName` dedup COLLAPSES variants; a modal FABRICATES fake variants from hardcoded ratios). Minimal additive model = `variantGroupId`+`variantLabel` (NULL=flat=today). Phasing: schema col FIRST → ingest-with-linkage → merchant grouping → consumer selector LAST (defer; touches `useProducts.ts` @lock).
- **KYC UX (Phases 14-16):** works but persists NO decision audit trail (who approved/rejected — none recorded); can't view PDF docs (`SecureImage` is img-only); hides captured fields (is_veg/cuisines/restaurantType/bank_name/signature); 340px cramped decision panel; irreversible Approve has no confirm. Phase 14 (audit trail) is compliance-critical.
- **Recommended order:** A) 1→4→2+3→5 (before load) · B) 7→10→9 (usable) · C) 12→13 (sibling UX) · D) 6→11→8 (hardening) · KYC 14→15→16 (parallel).
- **DATA PURCHASED + PROFILED 2026-06-15 (it's BLINKIT, not Zepto):** `Blinkit Data.csv`, 165MB, **141,405 rows**, 14 cols (product_id, platform, name, mrp, **price**, brand, images, deeplink, quantity, category, subcategory, created_at, updated_at, **data_dump**). Quality EXCELLENT: product_id 0 nulls / 0 dups / all numeric (stable key); category/subcategory only 0.2% null; brand 2.7% null; price 100% present (82% discounted < mrp). Image CDN = `cdn.grofers.com` (`images` = JSON array). **OPEN QUESTIONS NOW ANSWERED:** (a) format = CSV ✓ (stream it); (b) **sibling linkage IS explicit** — `data_dump` is the full raw scrape JSON per row and contains `siblings:[product_ids]` + `parentIndex` + `childIndex` (+ bonus: rating/ratingCount/inventory/offer_price) → Phase 3/5 fully supported; derive `variantGroupId = uuidv5(sorted(siblings).join())`, only when siblings.length>1; (c) taxonomy extracted → **47 categories / 561 subcategories / 643 (cat,subcat) pairs**, written to `docs/blinkit-category-taxonomy.csv` (ready for Phase 2 seed).
- **CONFIRMED CRITICAL by the real data:** the `MRP>1000?/100` heuristic would corrupt **23.6% (33,385 rows)** — max MRP is ₹229,900 (electronics) → it'd become ₹2,299. MUST delete it (Phase 5).
- **NEW Phase-2 input — category naming needs normalization:** the 47 cats have dup spellings ("Fashion & Accessories" vs "Fashion and Accessories", "Personal Care" vs "Personal Care & Beauty", "Organic & Premium" vs "Organic & Gourmet") + 325 literal-NULL rows + a long tail (Grocery=8, Stationery=1). Broad NON-grocery catalog (Fashion/Beauty/Electronics/Toys/Books/Magazines/Pet) → maps to PAS "Other Stores" verticals; Books/Magazines/Digital Goods may have no PAS vertical (human-curation decision). The 47→PAS-vertical map is the human bottleneck (one-time, reviewed by ops).
- **Originated from:** Pranav's request to harden the inventory module + improve KYC UX ahead of (now completed) the Blinkit data purchase, 2026-06-15.

### Phase 1 DONE (2026-06-15) — catalog/product endpoints locked
- 16 endpoints gained `requireRole(req,res,CATALOG_ADMIN_ROLES)`; Apify webhook now needs `CATALOG_WEBHOOK_SECRET` (fail-closed). `apps/api/src/index.ts`, tsc 0. **✅ COMMITTED (2609058a) + DEPLOYED to EB 2026-06-15 (app-260615_231119528572, Ready/Green). VERIFIED: GET /catalog/sync/queue with no auth → 401.** The server-side min-order floor shipped in the same commit (inert at min_order_value=0). NB: if Apify sync is ever used again, set `CATALOG_WEBHOOK_SECRET` on EB + add `?secret=` to the webhook URL (else it's rejected — fine, moving to the dataset). Committed on branch `feat/consumer-global-config-wiring`.

### Phase 2 taxonomy DECISIONS (2026-06-15) — `docs/phase2-category-taxonomy-mapping-2026-06-15.html`
- 15 verticals confirmed. Blinkit's 47 cats / 643 pairs → folded into existing 95 subcats + 28 new (all new subcats are Blinkit's OWN labels, lightly renamed). **Pharmacy +10 APPROVED. Tobacco/cigarettes EXCLUDED.** Drop "Yogurt Desserts" (1 item). 3 empty verticals now POPULATED from Blinkit: **Pooja & Festive** (~5,200 items: Festive & Occasion 2826 / Spiritual & Religious 1377 / Pooja Essentials 934 / Festive Gifting 56), **Sports & Fitness** (~1,255: Fitness Equipment & Gear + Sports & Outdoor Accessories), **Hardware & Plumbing** (~1,400: Home Improvement & Tools + Hardware & Fittings). **DECISIONS 2026-06-15:** baby apparel (772) → **Fashion → Kids' Wear** (move apparel out of Pharmacy); body jewellery (234) → **Fashion → Accessories & Jewelry**; frozen ice-cream/desserts → **Bakeries**; **Pooja/Sports/Hardware subcats APPROVED**. **Locked-file edits APPROVED** (useProducts.ts, catalog-picker.tsx — refresh lock headers after editing). **NEW: Hardware & Plumbing gets a 3rd subcat "Plumbing & Bathroom Fittings"** — ~150-200 genuine plumbing SKUs exist (faucets, taps, bib cocks, angle valves, health faucets, inlet/drain pipes, sink fittings) but Blinkit files them mixed inside "Bathroom Essentials"/"Home Improvement", so route by a NAME-based rule at import (NB: a raw keyword sweep also hit 350 "sanitary pads" false-positives — exclude). Full taxonomy CSV: `docs/blinkit-category-taxonomy.csv`.
  - **✅ PHASE 2 STEPS 1-4 DONE + APPLIED TO PROD (2026-06-15), committed:** Step 1 `CategoryMapping` table (e1c40367); Step 2 seed 41 new subcats → 136 total, 3 empty verticals populated (fcfd1735); Step 3 seed 643 Blinkit→PAS mappings — 630 ACTIVE (0 null category) + 13 PENDING_DECISION (NULL/Specials/Digital E-Cards/tobacco held, founders can enable later) (65d7002c). Mapping generator: `/tmp/gen_mapping_seed.py` (logic captured in the SQL files). **REMAINING:** Phase 3 sibling cols, Phase 4 drift reconcile, Phase 5 bulk-load importer (+ load guards: re-host images, load-inactive/zero-stock, ₹0-block, veg-default fix, FSSAI gate, hide-empty-stores), Step 6 admin review screen, then the 141k load. NB `prisma db execute` choked on the JOIN-VALUES INSERT ("table not exist" — misleading); applied via Prisma client `$executeRawUnsafe` instead — use that for big seeds.
  - **Admin catalog UI (2026-06-15, per Pranav):** removed the **Template** button (had a hardcoded `localhost:3000/products/template` bug) + the **Refresh Import** (Apify live-sync) button from `MasterCatalog.tsx` — Bulk Import is now the ONLY ingest path (refreshes will also be done via bulk import). `vite build` ✓. UNCOMMITTED in admin-web (rides next push → Vercel; note admin-web also has the local `vite.config.mts` proxy override + index.html fonts — do NOT commit the proxy override). Tabs: **Merchant Requests** = `GET /products?type=custom`, **Sync Queue** = `GET /catalog/sync/queue` (now auth-gated); both trigger a fetch on tab-switch (useEffect MasterCatalog:173) — correctness being verified by the inventory error-hunt.
  - **DEFERRED — delete old ZEPTO data AFTER Phase 5 Blinkit load is verified:** `source='zepto'` = 134 Product rows (+ likely the 111 null-source legacy/test rows + 39 live_sync); admin UI shows "183 SKUs". DO NOT delete until the 141k Blinkit catalog is loaded + confirmed live. (Pranav, 2026-06-15.)

### 🚨 INVENTORY ERROR-HUNT (2026-06-15, 41-agent adversarial audit) — `docs/inventory-error-hunt-2026-06-15.html`
- **VERDICT: NOT ready for 141k.** 34 confirmed defects (3 critical / 14 high / 6 medium / 2 low), false-positives refuted + dropped.
- **ROOT CAUSE (one bug, many symptoms):** API treats `category`/`vertical` as scalar Product columns but ONLY `category_id`/`vertical_id` FKs exist → breaks importer + edits + filters + browse, all masked by MOCK_PRODUCTS.
- **🔴 CRIT 1: the importer inserts 0 rows but returns HTTP 200** (`index.ts:2379` phantom `category` key; Prisma throws per row, swallowed). A 141k load would silently land NOTHING. (This is `bulk-import-json`, already flagged broken — now confirmed it fails SILENTLY.)
- **🔴 CRIT 2: MRP>1000 ÷100 corrupts prices** (`index.ts:1466`) — ₹1899→₹18.99; 24% of Blinkit >₹1000.
- **🔴 CRIT 3: `StoreProduct.storeId` holds a branch id, FK not enforced — 26/44 listings orphaned**, only 2/4 stores return inventory (`schema.prisma:448`, `index.ts:10452`).
- **HIGH:** phantom category/vertical breaks 6 handlers (grid edit 100% fails, bulk-update 500, filter→mock, consumer 500 — **= the blank Category column Pranav saw**); MOCK_PRODUCTS served in PROD on any DB error (HTTP 200, no env guard); + the display-audit blockers re-confirmed (286/294 default-veg, soft-delete leak, ₹0, hotlinked images, uom bug).
- **5-PHASE FIX PLAN:** 1 Unblock load (remove phantom category, kill MOCK fallbacks→500, fix MRP, 1-row smoke test) → 2 Data integrity (storeId FK + backfill 26, fix 6 handlers) → 3 Customer safety (is_deleted filter, veg tri-state, re-host images, reject ₹0) → 4 Scale (paginate picker, batch importer) → 5 Polish. **Do 1-3 before any Blinkit row reaches customers.**
  - **✅ PHASE 1 DONE + DEPLOYED (2026-06-15, commit e86734f8, EB app-260616_011514329472 Ready/Green):** removed MOCK_PRODUCTS (def + 3 fallbacks→handleApiError); bulk-import-json phantom `category` removed (smoke-test verified row inserts, MRP=1899); MRP ÷100 removed on APIFY path. VERIFIED live: /products 200 real data (no mocks), /catalog/sync/queue 401, 0 mock leakage.
  - **✅ PHASE 2 CODE DONE + DEPLOYED (2026-06-15, commit d5b1b81f, EB app-260616_015147794725 Ready/Green):** eliminated the category/vertical scalar→FK root cause across 6 handlers — GET /products (relation filter + include + name mapping), PATCH /products/:id (name→id resolution), /products/bulk-update (name→id), consumer storefront + store-list + search (filter on real `subcategory`), /catalog/sync/approve audit-log join by sourceProductId. VERIFIED live: `?vertical=Pharmacy & Wellness` returns Pharmacy products with cat/vert names, no 500. (Skipped: approve "reject missing taxonomy" — policy choice, not a bug.) **Next: Phase 2 FINAL item = the storeId/branch_id FK migration + backfill 26 orphans (DB — investigate + show SQL + confirm).** Then Phase 3 (customer safety: veg tri-state, ₹0 block, image re-host) before any Blinkit row reaches customers.

#### ✅ PHASE 2 FINAL (storeId/branch_id rework) — Option B chosen (eliminate the column, not patch the FK). 2026-06-16.
  > Pranav's directive: "no leaks, no gaps, no errors" — so instead of adding a FK to the vestigial `StoreProduct.storeId`, we relocated the Store↔branch link to `merchant_branches.store_id` (the correct domain location) with a real FK, then decoupled all code from `StoreProduct.storeId` so the column can be dropped. Investigation: the Prisma schema *declared* a `storeId→Store` FK that **did not exist in the DB**; 26/44 listings were orphaned (22 Freshly Vadapalli+Ravulapalem with storeId==branch_id, 4 "mystery" rows pointing at a phantom store with branch_id NULL). Only 2/4 stores returned inventory; **Freshly silently lost 67% of its catalog** (33 real listings, only 11 visible). Zero order_items referenced any orphan.
  - **✅ DONE + APPLIED TO PROD DB (2026-06-16):** B1 `merchant_branches.store_id` col (nullable); B2 backfilled 5 branches (Clean cuts, Freshly ×3, Wakey Owl-Kokapet) via branch.merchant_id==Store.id rule, 21 test/orphan branches stay NULL by design; **B3 hard-deleted the 4 mystery StoreProduct rows** (Pranav-approved; 0 order history); B4 repaired the 22 Freshly orphans (storeId→Freshly Store `9143278d`); **B5 added `fk_merchant_branches_store` FK** (ON DELETE/UPDATE NO ACTION) — negative-tested live (DB rejects fake store_id) + positive-tested, both rolled back; B6.0 `StoreProduct.storeId` DROP NOT NULL; **B9 `StoreProduct.branch_id` SET NOT NULL** (+ Prisma relation now required). All via `$executeRawUnsafe` node scripts in `apps/api/scripts/phase2final_b*.ts` (+ `investigate_storeid_fk*.ts`). Migration scripts are idempotent.
  - **✅ DONE — CODE (committed `7eb29e24`+`00872d09`; ⚠️ API NOT yet deployed — deploy gated, awaiting Pranav's explicit go):** B6.1 coupon `/checkout/validate-coupon` now derives storeId via `merchant_branches.store_id` include (not `StoreProduct.storeId`); B6.2/B6.3 the two StoreProduct upserts (`POST /merchant/products/save`, `POST /merchant/store-products/configure`) stop writing `storeId`; B7 the 3 client read-sites swapped to `branch_id` — admin `StoreProductTable.tsx`, merchant `AddMenuProductModal.tsx` + `useInventory.ts` (query + realtime filter). Consumer FavoritesScreen already used `branch_id` (no change). API tsc 0, build 0; admin-web build 0; merchant-app tsc 0. **Prod is consistent right now: new DB schema + currently-deployed OLD code are mutually compatible (old code sets both storeId+branch_id; storeId nullable, branch_id NOT NULL both satisfied).**

  ##### 🔬 ADVERSARIAL AUDIT of B1-B9 (2026-06-16, Pranav-requested) — found 3 real bugs + structural gaps; remediation = B11 (Full DB-enforced cert chosen)
  > Verified vs live DB + all 8 apps + DB functions/triggers. **Certified clean:** all 40 StoreProducts reach a Store (0 leak); all storeId values consistent with derived store_id; FK works (negative-tested); no view/trigger/index/pg_depend on storeId (B10 drop won't be blocked); app-reader sweep complete across all 8 apps. **BUT not self-sustaining — bugs found:**
  - **F1 (CRITICAL forward-leak) — FIXED in code:** branch creation NEVER set `store_id` → every NEW merchant/branch would get store_id=NULL → inventory unreachable to a Store (orphan class reborn). Fixed at all **6** creation sites (signup v2 upsert ~7790, signup v1 main ~7865 + additional ~7895, signup-handler-2 main ~8257 + additional ~8279, `POST /merchant/branches` ~9963) — set storeId=userId (signup) / merchantId (add-branch); FK rejects a wrong value. tsc 0.
  - **F2 (HIGH, B10-breaking) — FIXED in DB:** `delete_merchants_cascaded` (live admin "delete merchant", called from useMerchants.ts:296/323) referenced `StoreProduct.storeId` twice → would break at B10. **Missed in B7 because only app code was swept, not DB functions.** Rewrote to key StoreProduct+OrderItem deletes off `merchant_branches.merchant_id` (matches the branch-delete criterion). Bonus: correctness check proved the OLD function only caught 7/40 StoreProducts (missed Freshly's 33) — the rewrite is strictly more correct. Applied + verified 0 storeId refs remain. (`scripts/phase2final_F2_rewrite_delete_cascade.ts`; original def saved there for rollback.)
  - **F3 (HIGH, money-path) — FIXED in code:** my B6.1 null-filter regressed the coupon vertical-eligibility check from fail-CLOSED to fail-OPEN (a null-store cart item was silently dropped from the check; all-null carts skipped it entirely). Restored fail-closed: any unresolvable store → reject the vertical-scoped coupon (index.ts ~6107). Latent until F1 manifested, but real. tsc 0.
  - **F5 (LOW) — FIXED in DB:** added `idx_merchant_branches_store_id` (FK column was unindexed).
  - **F4 (MEDIUM, structural) — ✅ DONE, fully DB-enforced:** `merchant_branches.store_id` is now NOT NULL. **(a) F4a deleted the 21 orphan/test branches** (`scripts/phase2final_F4a_delete_orphan_branches.ts`; 0 inbound refs; 5 branches remain). **(b) F4b `ALTER ... store_id SET NOT NULL` APPLIED** (`scripts/phase2final_F4b_store_id_not_null.ts`, commit `e60d91fe`) — negative-tested (DB rejects NULL store_id insert), 0-leak chain verified, Prisma model synced to `storeId String` + required relation. The Store↔branch↔StoreProduct chain is enforced end-to-end at the DB level.
  - **✅ API DEPLOYED 2026-06-16: `app-260616_182606893154`, Ready/Green** (`/health` ok, `/products` 200). Ships B6.1/6.2/6.3 + B11 F1/F3. Commits `7eb29e24`, `00872d09`, `f80b99a4`.
  - **⛔ GATED — B10 DROP `StoreProduct.storeId` COLUMN — explicitly DEFERRED by Pranav 2026-06-16 to ride the batched merchant OTA (after phases 3/4/5).** Shipped merchant-app bundles read the column DIRECTLY via Supabase (`useInventory.ts:75`+:114 realtime, `AddMenuProductModal.tsx:116`); dropping it before the merchant OTA propagates would break the merchant inventory screen in production. Pranav is holding ALL merchant OTAs (multiple pending) for a sequential verify-then-push pass after phases 3/4/5 — B10's column drop joins that batch. **Rollout order:** (1) ✅ API deployed (`app-260616_182606893154`); (2) ✅ branch pushed `e60d91fe` (admin-web `StoreProductTable` branch_id fix — **Vercel PRODUCTION needs a main merge; feature-branch push = preview only**); (3) ⏳ merchant OTA (batched, post-3/4/5) carrying `AddMenuProductModal` + `useInventory` branch_id fixes; (4) after the OTA propagates: `ALTER TABLE "StoreProduct" DROP COLUMN "storeId";` + drop the Prisma `store` relation on StoreProduct + the `Store.products` inverse. Verify Freshly storefront returns its full catalog. F2 already removed the only DB-function dependency; no DB object blocks the drop.
  - **Adjacent FK gaps found during B-investigation (own tickets, NOT touched):** (a) **`Order.storeId`/`Order.branchId` is the SAME bug class** — notification payloads do `storeId: updated.branch_id` (index.ts :3721/:3748/:3763); Order has parallel dual columns. Audit Order orphans + apply the same merchant_branches.store_id-derivation fix. (b) **`Store.merchant_id` has no DB FK** (the Freshly Store↔branch merchant_id mismatch lives here, not on the branch side — branch FK exists & is `ON DELETE SET NULL`, which is *why* 21 branches have NULL merchant_id: their merchants were deleted). (c) **Folli Medicals**: a Store with NO `merchant_branches` row at all (legacy) → 0 inventory; and **Wakey Owl** Store is inactive. Admin data-cleanup.
- **DATA CLEANUP (294):** 176 null vertical / 209 null category → recategorise; ~~26 orphaned listings~~ ✅ FIXED (Phase 2 FINAL B3/B4); 286 default-veg; MRP-corrupted rows.

### EMPTY-STORE behavior — ✅ RESOLVED (Phase 3 Item 4, 2026-06-16)
- Was: a store with no active inventory STILL appeared in the nearby/discovery list (`get_nearby_stores` was location-only). **Decided: hide zero-active-product stores.** `get_nearby_stores` now has an `EXISTS(active, non-deleted StoreProduct)` filter + a modernized FK join (`s.id = mb.store_id`, Option B). Applied + verified (`scripts/phase3_item4_hide_empty_stores.ts`); 0 stores hidden today (forward guard for the Blinkit inactive load).

### 🛡️ PHASE 3 (customer safety) PROGRESS — 2026-06-16
- **✅ Item 1** — `is_deleted:false` on all 5 consumer StoreProduct reads (commit `e00cdb29`, rides consumer OTA).
- **✅ Item 2** — ₹0 listing can never be live: app guards at 3 write paths + DB CHECK `NOT (active AND price<=0)` (commit `c0f8b977` + `phase3_item2_check_active_price.ts`, negative-tested). API rides next EB deploy.
- **✅ Item 3** — `SafeImage` broken-image fallback in ProductCard/SearchResults/CartScreen (commit `db25c0c2`, Option B; NativeWind-v2-safe via style). Root fix = Phase 5 re-host.
- **✅ Item 4** — hide empty stores from discovery (`get_nearby_stores`, applied above).
- **⏭️ DESIGN PASS (deferred, coupled):** Item 6 veg default tri-state + Item 7 food-only veg/non-veg filter (Blinkit has no veg flag → derive from subcategory; dots only on food; store-aware filter), + Item 5 FSSAI gate (food verticals). Needs a focused brainstorm/plan before building (touches useProducts @lock + the ProductCard veg dot at lines 69-73).
- **NB consumer-app OTA batch:** Items 1+3 (and the future veg/FSSAI consumer bits) ride the held consumer OTA. Item 2 (API) + Item 4 (DB) are already live/next-deploy.

### 📦 PHASE 4 (scale) — decomposed into 3 sub-projects; loader spec written (2026-06-16)
> Decomposition (Pranav-confirmed order): **(1) bulk-loader → (2) paginated catalog picker → (3) consumer veg/non-veg filter + dots.** Each gets its own spec→plan→build. The veg/FSSAI "design pass" folds in: veg-derivation = loader ingest rule; FSSAI = listing-time gate (separate); consumer veg filter+dots = sub-project 3.
- **✅ Sub-project 1 (bulk-loader) DESIGN DONE + spec written:** `docs/blinkit-bulk-loader-spec-2026-06-16.html` (HTML per global rule). Brainstormed decisions: **lazy/on-list image re-host** · **defer siblings** (load flat, sibling data → extraData) · **default-VEG** for unsignalled food · **skip unmapped-category** rows · **local streaming Node CLI** (option A, like the migration scripts) · **mrp=ceiling, Blinkit price=suggested selling price** (verified on 20k rows: price ≤ mrp, never additive; 1 anomaly → clamp). Loads `Product` (master catalog) ONLY — customers see nothing until a merchant lists. Idempotent/resumable via `sourceProductId @unique`; dry-run mandatory first. **OPEN DECISION in spec:** store derived veg in a new `Product.isVeg Boolean?` column (recommended, queryable for the filter) vs `extraData.isVeg` (current useProducts read) — Pranav to confirm at spec review. **NEXT:** spec review → writing-plans → build.
- **✅ Sub-project 1 (bulk-loader) BUILT + LOADED to prod (2026-06-17).** Plan `docs/superpowers/plans/2026-06-17-blinkit-bulk-loader.md`; built TDD (node:test) — `src/blinkitLoader/{vegRules,transform,types}.ts` + `scripts/load_blinkit_catalog.ts` + `scripts/migrate_add_product_isveg.ts`. Veg decision = **`Product.isVeg` column** (added, migration applied). **Adversarial audit (`scripts/audit_blinkit_loader.ts`) found 0 data-path bugs** (requiresFssai flags the 4 food verticals; header/field map exact; 0 numeric corruption; data_dump 100% valid JSON; 0 false-unmapped — the 1,505 skips are intentional: digital goods/NULL/tobacco/services; 0 sourceProductId collisions). Dry-run tuned veg rules (real Blinkit non-veg subcat names + plant-based/vegan override). **⚠️ PERF BUG caught + fixed mid-load:** `$transaction([500 upserts])` = 500 round-trips/batch (~4-5h) → switched to bulk `createMany({skipDuplicates})` (one round-trip/batch); 4358 rows/14s. **FINAL LOAD: 139,880 Product rows (source='blinkit'), 0 errors** — exactly the dry-run prediction. Verified: null_vert=0, no_img=0, suggestedPrice>mrp=0, veg 41,826 / non-veg 1,920 / unknown(non-food) 96,134, 13 verticals. Catalog now = 139,880 blinkit + 294 legacy. Rollback if needed: `DELETE FROM "Product" WHERE source='blinkit'`.
  - **NEXT sub-projects:** (2) paginated catalog picker [+ the MRP-ceiling listing guard below, + lazy re-host mechanism, + FSSAI gate]; (3) consumer veg/non-veg filter + dots (reads `Product.isVeg`; also backfill existing 294 products' veg + switch `useProducts` off `extraData.isVeg`).
  - **✅ SUB-2 (catalog picker) DONE + API DEPLOYED (2026-06-18, EB `app-260618_205151010488` Ready/Green).** Commits 29896b3b→4d3c96b7. DB live: `enforce_mrp_ceiling` trigger (price≤mrp, neg+pos verified) + `idx_product_name_trgm` GIN. API deployed: `GET /merchant/catalog` (keyset pagination, branch-scoped, excludes already-listed, filters + trigram search) + `POST .../configure` extended (MRP 400 + FSSAI 403 + lazy grofers→Supabase re-host, 5s-bounded). Units cursor/validate/imageRehost (20 node:tests). Audit 6/6. Merchant UI: useCatalogPicker + catalog-picker.tsx rewrite (server-paginated, veg dot food-only; @lock FilterModal/DEFAULT_FILTERS intact) + ConfigureProductsModal rebuild (per-row price+stock, MRP validate, FSSAI banner; fabricated variants dropped). Rides merchant OTA. Live: 401 unauth, keyset no-overlap, trigram search ✓.
  - **✅ SUB-3 (consumer veg filter + dots) DONE (2026-06-18, commit 9e4092ad; rides consumer OTA).** Backfill set 80 legacy food→veg (0 food null). useProducts.ts (@lock isVeg edit pre-approved) reads `is_veg` tri-state (was `extra_data?.isVeg ?? true` = all-veg bug). ProductCard dot only when isVeg true/false. StorefrontScreen (@lock layer 3 pre-approved) VegToggle gate dining-only→any-food-store. tsc clean.
  - **₹0 app-guard (c0f8b977) DEPLOYED** in `app-260618_205151010488` (the pending API deploy is done).
  - **🏗️ NATIVE BUILDS TRIGGERED (2026-06-18, commit 3cf039e2).** Build-readiness audit `docs/build-readiness-audit-2026-06-18.html`: previous (1.1.2/1.2.5) builds INSUFFICIENT — native deps added since (consumer: expo-notifications/device/updates; merchant: react-native-svg/expo-updates) + push entitlements + expo-updates OTA engine → must rebuild. Bumped **Consumer 1.1.2→1.1.3, Merchant 1.2.5→1.2.6** (runtimeVersion policy appVersion follows → fresh OTA lanes). Live store versions were 1.1.2/1.2.5 (Pranav confirmed). All 4 EAS production builds queued (creds ready, iOS certs→Feb 2027, Android keystores present): **merchant** android `b7582bb8` / ios `ff7a69d1`; **consumer** android `5aac7ddd` / ios `7368ed4b` (acct pranavadityaneti). Builds carry ALL committed work → **no OTA backlog after they go live**; future OTAs target 1.1.3/1.2.6 (run pre-OTA .env protocol). **NEXT:** monitor builds → `eas submit` → store review. **⚠️ SECURITY (chip task_075bff46):** `apps/*/credentials.json` are git-tracked (may hold keystore passwords) — gitignore + rotate if exposed.
  - **📲 BUILDS SUCCEEDED + SUBMISSION (2026-06-18).** Pranav manually uploads Android AABs to Play Store. **iOS:** merchant 1.2.6 (build 17, `ff7a69d1`) **SUBMITTED to App Store Connect** ✅ (ASC API key `K2FB92KG52` "[Expo] EAS Submit qBmg4BPaQM" on EAS servers; submission `1a7f2cc9`). **Consumer iOS (`7368ed4b`, 1.1.3, build 22) SUBMITTED ✅** (Pranav ran the interactive `eas submit`, selected existing key `K2FB92KG52`; now linked to consumer-app for future one-command submits; submission `4df1ae64`). **BOTH iOS apps submitted to App Store Connect** (merchant 1.2.6 + consumer 1.1.3) — Apple processing, then submit-for-review in ASC. Android AABs (1.1.3/1.2.6) handled manually by Pranav. **OTA backlog empty** (builds carry everything: catalog picker, veg filter, Phase 3 safety, notifications, eSign). Future JS-only fixes OTA onto 1.1.3/1.2.6 (run pre-OTA .env protocol).
  - **DEFERRED now unblocked:** delete old `source='zepto'` (134) + null-source (111) + live_sync (39) legacy/test products — the Blinkit catalog is loaded + verified, so the old data can be cleaned (confirm with Pranav first).
- **CARRY-FORWARD (Pranav: "must enforce"):** merchant's `StoreProduct.price ≤ Product.mrp` at listing (MRP as hard ceiling) — picker/listing guard (sub-project 2) + ideally a `StoreProduct` CHECK like the ₹0 one. Do NOT lose this.
- **CARRY-FORWARD:** lazy image re-host MECHANISM (download grofers→Supabase→swap URL on first listing) = small item in the StoreProduct write path. FSSAI listing gate = separate item in the write path. Both out of the loader.

### VEG / NON-VEG FILTER requirement (Pranav, 2026-06-15) — must be food-only + store-aware + sync'd
- **Today:** a veg/non-veg filter exists ONLY on the Dining screen (restaurant-level, `DiningScreen.tsx:64`). The product storefront has the buggy veg DOT on EVERY product (`useProducts.ts:82 ?? true`) and NO product-level filter.
- **Required:** dots ONLY on food products; veg/non-veg filter shown ONLY on food-selling stores; a customer-app veg/non-veg/food filter button in sync with the dots.
- **⚠ DATA CAVEAT:** Blinkit data has NO veg/non-veg flag (not in data_dump). Must DERIVE per-product veg/non-veg at import (non-veg keywords: chicken/mutton/fish/egg/prawn/meat + subcats "Chicken, Meat & Fish"/"Frozen Non-Veg" → non-veg; clearly-veg → veg; else UNKNOWN = no dot). "Is food" = food vertical (Grocery & Kirana, Fresh Items, Bakeries & Desserts, Restaurants & Cafes — drive off `Vertical.requiresFssai`). Needs its own phase/plan.

### 🚨 DISPLAY AUDIT (2026-06-15) — `docs/merchant-customer-display-audit-2026-06-15.html` — 5 CUSTOMER-FACING BLOCKERS before any Blinkit row reaches customers
- **🔴 1. GREEN VEG DOT on all non-veg/non-food** — `useProducts.ts:82 isVeg ?? true`; 141k rows (meat/fish/eggs/pet/electronics) show vegetarian. Fix `?? undefined`. **`useProducts.ts` is @lock — need Pranav approval.**
- **🔴 2. ₹0 LIVE products** — Blinkit is MRP-only; write paths coerce price→0 + active=true (`index.ts:10455/:10526`). Reject price≤0 while active.
- **🔴 3. HOTLINKED `cdn.grofers.com` images** — no re-host, no onError; competitor-CDN/IP/breakage risk. Re-host to Supabase at ingest. **Un-shippable to customers until done.**
- **🔴 4. DATA LEAK** — `GET /products` (1087) + `GET /merchants/:id/inventory` (5550) NO auth + full Product row (source/source_product_id/product_url/extra_data) to anyone. Add auth + whitelist + column grants.
- **🔴 5. FOOD ships with ZERO FSSAI/allergen/net-qty** — no fields, `requiresFssai` not enforced. Gate food verticals.
- **MASTER GUARD:** load every Blinkit row **inactive + zero-stock + re-hosted images**; surface only after a merchant sets price+stock — neutralizes ₹0-live, stale-stock, OOS-flood, broken-image at once.
- **Highs:** ~1000-row merchant catalog cap; name-only dedupe hides pack sizes; brand invisible on storefront; uom precedence bug (`index.ts:2572` blanks pack size); `is_deleted` not filtered on consumer; raw Blinkit subcategory shown as section header (Phase 2 fixes); names/deeplinks unsanitized. `catalog-picker.tsx` partial @lock.

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
- **DECISION 2026-06-15 (Pranav):** the **merchant bears BOTH the PAS platform commission AND the payment-gateway charges.** So payout = gross sale − platform commission − payment-gateway charges (+ any GST/TDS that legally rides those).
- **GROUNDED ANALYSIS 2026-06-15 (read-only workflow `payout-formula-grounding`, 6 agents):**
  - **KEY FINDING — the real engine already exists.** The Phase-7 settlement engine (`apps/api/src/services/settlement.service.ts`) already computes the PAID number: `netPayout = Σgross − Σcommission + ΣcouponReimbursement(PLATFORM-funded) − Σclawback(refunds)`, frozen per-line at weekly close (Mon 02:00 IST). Commission base = **items subtotal pre-GST pre-coupon** (FQ-4), rate from the **CommissionRule table** (resolved by commissionCategory × orderType × turnoverTier). The admin `Merchant.commission_rate` field is **orphaned** (never read). The dashboard `× 0.98` (`useEarnings.ts`) is a **separate client-side placeholder**, NOT the engine.
  - **WHAT THE DECISION ADDS = the gateway charge.** Only new deduction: `− gatewayCharge`. **DATA MISSING:** `rzpPayment.fee` / `.tax` / `.method` are fetched at `index.ts:2917` but **discarded** — never stored. So exact per-order fees are not computable on existing orders.
  - **LOCKED SPEC 2026-06-15 (Pranav, via worked-example AskUserQuestion):** `payout = gross − commission − 18%GST(commission) − 1.9%gateway(gross) + platformCouponReimb − clawback − 0.1%TDS(gross)`. The **1.9% is the GATEWAY pass-through** (of gross, all-in); the **per-vertical commission (2-7%) stays** as PAS revenue (CommissionRule table, items-subtotal base — UNCHANGED, honours signed agreements); **18% GST on commission = ENABLED** (reserved col `SettlementCycle.gstOnCommission`); **TDS §194-O 0.1% of gross = ENABLED** (needs a properly-named `tds_amount` col — the existing `tcsAmount` col is semantically GST-TCS, NOT income-tax TDS; do NOT reuse it). GST TCS §52 (0.5%) NOT chosen — TDS only. Worked ₹1,000 restaurant (5%): 1000−50−9−19−1 = **₹921 payout, ₹50 PAS revenue**. Full spec+plan: `docs/merchant-payout-formula-v1-2026-06-15.html`.
  - **PROPOSED SEQUENCE (one approved step at a time, money-path):** (1) FREE additive — persist `rzpPayment.fee/tax/method` into `order.metadata` at `index.ts:2917` (object already in hand) → unblocks exact fees for all future orders; (2) settlement engine — add per-SALE-line `gatewayCharge` column + cycle column + wire into `netPayout`; (3) new read-only `GET /merchant/payout/today` running the real formula; (4) merchant app `useEarnings` → call endpoint, kill `× 0.98`, relabel to "estimate".
  - **RISKS:** real fees make payout LOWER than the 0.98 estimate (comms to merchants before launch); gateway fee deducts on GROSS, commission on items-subtotal (different bases — show each on its own line); Razorpay doesn't refund its fee on refunds (merchant correctly eats it — confirm intended); today's-estimate will diverge from final weekly netPayout on late refunds/holds (label clearly).
  - **CA GATE (before first LIVE payout, not before building):** confirm PAS is the "e-commerce operator" under §194-O (depends on the still-unchosen payout money-flow), confirm the 0.1% TDS rate + ₹5L/PAN threshold, confirm PAS raises an 18% GST invoice on commission, and confirm whether GST TCS §52 (0.5%) ALSO applies. Real settlements aren't running yet (cron dry-run, no commission categories assigned, no payout vendor) → window exists to confirm before money moves. If §194-O/§52 ARE mandatory, non-deduction is PAS's liability. **No code written yet — approval-gated; review plan first (Pranav).**
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
- **🟡 Consumer app native build PENDING** (2026-06-04 night): `app.json` updated with `updates.fallbackToCacheTimeout: 0` so future cold launches don't block on the OTA check — fix for the "stuck on PAS splash" bug multiple founders see after every OTA push. This is NATIVE config, not OTA-shippable. Takes effect after the next `eas build` + install. Batch with: Aadhar eSign native vendor SDK if it requires one, Agreements V1 if it changes the build at all, or any other native-touching work queued. Until the new build ships, the stuck-splash behavior persists after each OTA.
- **Customers — post-launch deferred:** Wallet balance + Grant Credit (needs `wallets` table), customer tags (VIP / At-Risk — needs `customer_tags` table), LTV percentile rankings, cohort retention analysis.
- **Global Config tab hidden 2026-06-03**: the GlobalConfig.tsx form was 100% mock (hardcoded `defaultValue` strings, Save button just toasted without persisting). Hidden from AnalyticsHub tabs. To revive: build a `platform_settings` table + GET/PATCH admin routes + make consumer/merchant apps consume Max COD / Min Order / Platform Fee / Delivery Fare / Referral Bonuses / Service Radius / Driver Assignment Timeout. ~2-3 hrs + a few app-side wires.
- **Reports / data exports (CSV/Excel):** downloadable order reports, refund reports, GST reports, payout reports. Likely a "Reports" tab with date pickers + export buttons. (Analytics-page CSV shipped 2026-06-03 — see above. Order/refund/GST/payout reports still pending.)
- **Multi-admin RBAC:** roles like `founder`, `support`, `ops`, `viewer`. Permission middleware on admin routes. Each role sees what it should.
- **Audit log of team and admin actions:** every admin/support action (approve merchant, issue refund, contact customer) logged with actor + timestamp + reason. Schema: `audit_log` table + middleware.

### New external API integrations (to wire in this sprint)
- **Sentry** — crash + error reporting on both apps. Free tier sufficient initially.
- **Razorpay Webhooks** — server-side order creation on payment success (proper fix for "Network request failed" bug class — forlater #18). Critical pairing with exchange/return work since refund flow needs webhook handling too.
- **KYC / GST Verification** — Karza, IDfy, or DigiLocker. Picked based on cost + Indian compliance coverage. (Founder question on which vendor.)
  - **DECISION 2026-06-15 (Pranav): keep the current MANUAL process for now. No vendor integration.** Revisit only if/when automated verification is actually wanted — then integrate any of the above. Parked, not cancelled.
- **Wati extension** — already integrated for OTPs. Extend to: order status messages, payment OTPs (additional flow), reminders, marketing campaigns, customer support chat routing. Each is a separate Wati template + automation in their dashboard.
- **Cloudinary** (or imgix) — image CDN. Replaces local-bundle image serving for product photos, banners, store photos. Massive bandwidth win on customer app.
  - **DECISION 2026-06-15 (Pranav): not needed now. Parked.**
- **PostHog** (or Mixpanel) — product analytics. Funnels, retention, feature usage. PostHog is cheaper + self-hostable; Mixpanel has slicker UI.
  - **DECISION 2026-06-15 (Pranav): not needed now. Parked.**
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

### 11. `POST /orders/:id/refund` legacy endpoint — auth, metadata-merge, state guards (WS2 third-pass audit)
- **What:** The pre-existing endpoint at `apps/api/src/index.ts:2985` (1) has NO `requireUser` auth check, (2) returns a stub Razorpay id (`rfnd_test_*`) instead of calling the actual Razorpay refund, and (3) sets `metadata` to `{ razorpayRefundId }` which REPLACES (does not merge) the existing JSON — wiping `razorpayPaymentId`, `orderRequestId`, and the entire WS2 cancellation audit trail. The state guard at line 2997 only blocks REFUNDED orders, so it can be called on a CANCELLED order (post-WS2-cancel) to flip → REFUNDED + nuke metadata.
- **Why it matters:** After WS2 cancel ships, every cancelled-with-refund order is one call away from losing its audit trail. Combined with no auth, an unauthenticated caller can wipe the WS2 metadata of any order. Out of scope for the WS2 fix bundle because it's a different feature's endpoint — but adjacent and dangerous.
- **Scope when picked up:** `apps/api/src/index.ts` lines 2985-3061. Add `requireUser` + `userCanManageOrderStore`. Spread metadata instead of replace. Extend state guard to block `CANCELLED`, `RETURN_*`, `EXCHANGE_*` so the WS2 endpoints own those transitions. Decide whether to actually wire the Razorpay refund call (currently stubbed). Audit who calls this endpoint (merchant-app `useOrders.refundOrder`) and what they expect on response.
- **Status:** Queued — deferred from WS2 third-pass audit bundle, June 5 2026.
- **Date added:** 2026-06-05
- **Originated from:** WS2 third-pass audit (the bundle that fixed N1/N2/N4/N5/N7).

### 12. `PATCH /orders/:id/status` legacy endpoint — auth + stock-restoration idempotency (WS2 third-pass audit)
- **What:** Endpoint at `apps/api/src/index.ts:2798` has NO auth check. On a CANCELLED transition it iterates items and increments stock (line 2855-2862), but the terminal-state guard at line 2814 only blocks setting CANCELLED on `COMPLETED/REFUNDED/RETURN_APPROVED` — it does NOT block CANCELLED → CANCELLED. So a duplicate call restores stock a second time, inflating inventory.
- **Why it matters:** WS2 cancel already restores stock atomically (inside its transaction). If someone (or a merchant-app `updateOrderStatus` retry) hits the legacy endpoint with `status: 'CANCELLED'` on a WS2-cancelled order, stock gets bumped twice. Inventory drift compounds over time. Also: the no-auth surface means any caller can flip any order's status.
- **Scope when picked up:** `apps/api/src/index.ts` lines 2798-2917. Add `requireUser` + store auth check. Block the CANCELLED → CANCELLED transition explicitly. Audit whether moving to WS2 lifecycle states (RETURN_*, EXCHANGE_*) via this endpoint should be blocked too (force callers through the WS2 endpoints). Merchant-app's `useOrders.updateOrderStatus` at line 385 calls this without an Authorization header — will need updating in lockstep.
- **Status:** Queued — deferred from WS2 third-pass audit bundle, June 5 2026.
- **Date added:** 2026-06-05
- **Originated from:** WS2 third-pass audit (the bundle that fixed N1/N2/N4/N5/N7).

### 13. WS2 round-4 audit follow-ups (MEDIUM cluster — concurrency hardening)
- **What:** The round-4 adversarial review (19 parallel agents × 3 lenses + cross-cutting) returned 0 critical / 0 high / 11 medium / 9 low. Five mediums were fixed inline in the same bundle (exchange copy, dining-cancel copy, metadata.orderRequestId persistence gap, awaited order_requests cleanup, multi-coupon redemption iteration). Six remaining mediums share a common theme: **the same compare-and-set pattern that fixed N2 should also gate the order.status writes in three more endpoints**.
- **Why it matters:** Each of these is real but narrow — a customer would have to double-tap submit (or the client retry on a slow first response) to hit the race. The mediums are listed in priority order:
  1. **Cancel endpoint** (apps/api/src/index.ts ~3323): re-check `order.status !== 'CANCELLED'` inside the tx as a compare-and-set. Without it, two parallel cancels both restore stock + both fire customer notifs. Pattern: `tx.order.updateMany({ where: { id, status: { not: 'CANCELLED' } }, data: {...} })` + bail if count===0.
  2. **Return endpoint** (apps/api/src/index.ts ~3594): same pattern on the status flip BEFORE the OrderIssue.create. Without it, two parallel return submits create two PENDING OrderIssue rows + cron auto-approves both = double refund in 24h.
  3. **Exchange endpoint** (apps/api/src/index.ts ~3689): same pattern. Two parallel exchange submits → duplicate issues.
  4. **Cron order.metadata lost-update** (apps/api/src/services/scheduled-jobs.ts ~157+217): `order.metadata` is read OUTSIDE the tx and re-merged inside; any concurrent metadata write (from the soon-to-be-hardened merchant PATCH) is silently clobbered. Fix: re-read metadata inside the tx via `tx.order.findUnique({ where: { id }, select: { metadata: true } })`.
  5. **Cron `tx.order.update` has no order.status CAS** (apps/api/src/services/scheduled-jobs.ts ~211): the issue-level CAS protects the issue row, not the order row. Future writers could be clobbered.
  6. **Cross-fix race: cancel + cron-auto-approve on same order** — if customer cancels while cron auto-approves a related return issue, both call Razorpay. evaluateCancel blocks RETURN_* states but reads OUTSIDE the tx. Same fix as items 1–3 closes this too.
- **Scope:** All 6 changes are in two files (apps/api/src/index.ts + apps/api/src/services/scheduled-jobs.ts). Pattern is identical (mirror of the N2 fix). ~80 lines total.
- **Status:** Queued — deferred from WS2 third-pass audit, round-4 follow-ups. Bundle includes both UPDATE patterns and possibly a partial unique index migration on `coupon_redemptions(order_id) WHERE order_id IS NOT NULL`.
- **Date added:** 2026-06-05
- **Originated from:** WS2 third-pass adversarial review workflow (the one that fixed N1/N2/N4/N5/N7 plus 5 round-4 inline tightenings).

### 14. WS2 round-4 audit follow-ups (LOW cluster — observability + polish)
- **What:** Round-4 review surfaced 9 low-severity items, grouped here:
  - **NotificationToast.tsx + NotificationsScreen.tsx icon maps**: the four new WS2 types (RETURN_REQUESTED, EXCHANGE_REQUESTED, RETURN_DECISION, EXCHANGE_DECISION) currently fall through to the generic Bell icon. Add proper mappings (suggested: Package icon for return, RefreshCw for exchange, distinct colors for requested vs decision).
  - **routeForNotification explicit cases**: same four types currently hit the default case. Add explicit cases for future routing intent (deep-link to specific order detail when OrderDetail screen ships).
  - **sendConsumerNotification dedup**: no `(userId, type, referenceId)` idempotency at the dispatch layer. Add an optional dedupKey or auto-dedupe when refId + type are both provided.
  - **Cron overlapping ticks**: `* * * * *` can fire while previous tick's Razorpay call is in flight. Add a running guard inside the cron callback.
  - **N7 reconciliation cron**: sweeper that finds `order_requests` with status='COMPLETED' whose linked order has status='CANCELLED' and flips them. Heals N7 cleanup misses (SIGTERM mid-await).
  - **Sentry on N7 cleanup catch**: route the catch through Sentry.captureException for visibility.
  - **N4 userId scoping defense**: add `userId: order.userId` to the `tx.couponRedemption.findMany` where-clause as defense-in-depth against malformed redemption rows.
  - **N4 `reversed_at` column for audit trail**: instead of deleting redemptions on cancel, mark them reversed — preserves audit trail and prevents theoretical double-decrement.
  - **Stock-restore inner `.catch` removal**: the per-item `.catch` on `tx.storeProduct.update` swallows errors but Postgres aborts the transaction anyway → subsequent ops fail with confusing "transaction aborted" messages. Remove the inner catch and let the outer try/catch handle it.
- **Scope:** Mixed surface — 2 mobile files (NotificationToast, NotificationsScreen), 1 lib file (notificationRoute), 1 service (notification.service.ts), 1 API endpoint (cancel), 1 cron file (scheduled-jobs.ts). Each item is small but they touch a lot of places.
- **Status:** Queued — defense-in-depth, ship after the medium cluster above.
- **Date added:** 2026-06-05
- **Originated from:** WS2 third-pass adversarial review workflow.

### 15. WS2 round-5/round-6 audit — remaining deferred items
- **What:** The round-5 hardening (CAS on cancel/return/exchange, requireUser on legacy endpoints, cron hardening, merchant-app Bearer tokens) closed 8 mediums + 4 highs inline. The round-5 adversarial review surfaced 1 cross-cutting critical (merchant rejection break — fixed inline as round-6) + 6 highs (3 fixed inline as round-6, 3 deferred) + 11 mediums + 9 lows. Remaining items below.
- **DEFERRED HIGHS:**
  1. **A1 cancel decision uses stale snapshot for fee calc.** Rules engine `decision` computed OUTSIDE the cancel tx against the pre-CAS snapshot. If order transitioned PENDING→CONFIRMED→PREPARING between the read and CAS, the cancel still succeeds (all 3 in CAS IN-list) but feeInr/refundInr/autoRefundEligible reflect stale state. Customer can be charged wrong fee. Fix needs rules engine re-evaluation inside the tx, or move evaluateCancel logic into the CAS predicate. Non-trivial restructure.
  2. **A8 SIGTERM gap on AUTO_APPROVED+pending-refund.** Between cron's first transaction commit (status=AUTO_APPROVED) and Razorpay call, SIGTERM leaves the issue auto-approved with no refund, and the next tick's PENDING-only findMany excludes it forever. Need a new reconciliation pass that finds AUTO_APPROVED issues with refundAmountInr>0 + refundRazorpayId IS NULL + resolvedAt > 5min ago.
  3. **/orders/:id/reschedule has no CAS.** Two parallel reschedules both pass evaluateReschedule's PENDING/CONFIRMED gate, last-write-wins on slot_time_at. Benign (no money/stock side effects) but breaks the symmetry round-5 established.
- **DEFERRED MEDIUMS:**
  1. **A1 cancel: order.metadata stale spread inside tx.** A1's CAS update spreads `order.metadata` from the pre-tx findUnique. Should re-read inside the tx via `tx.order.findUnique({ select: { metadata: true } })` like A8 cron now does.
  2. **A6 status: stock-restore not in tx + silent error swallow.** The legacy endpoint's stock-restore loop runs outside any tx, with `.catch(() => console.error)` per item. Partial failures = silent inventory drift. Should wrap in tx + drop the inner catch (like we did for A1 cancel).
  3. **A6 status: TOCTOU on CANCELLED guard.** Two concurrent merchant rejections both pass the CANCELLED→CANCELLED check, both run stock restoration. Needs `updateMany WHERE status != 'CANCELLED'` compare-and-set.
  4. **A6 status: input validation missing on req.body.status.** No enum check — attacker can probe schema by sending garbage and reading the Prisma error.
  5. **userCanManageOrderStore admits ANY storeStaff role.** No role-within-store granularity. A cashier-tier staff member can flip orders to CANCELLED, issue refunds, etc. Schema change: add `storeStaff.role` enum + tighten permission check for destructive transitions.
  6. **CRON_DRY_RUN doesn't cover other Razorpay call sites.** processRazorpayRefund (used by A1 cancel + merchant PATCH approve) and bookings.ts initiateRefund are unconditional. The DRY_RUN flag should either be cron-only (rename to CRON_REFUND_DRY_RUN + document) or universal (shared helper readRazorpayDryRun()).
  7. **CRON_DRY_RUN undocumented outside source.** Needs entry in a deploy runbook (currently only mentioned in scheduled-jobs.ts comments).
  8. **D-migration: no CONCURRENTLY + no pre-flight duplicate scan.** CREATE UNIQUE INDEX without CONCURRENTLY takes ACCESS EXCLUSIVE locks. The pre-flight queries are in docs/ws2-pre-deploy-checks.sql but the migration file itself doesn't guide ops to run them first.
- **DEFERRED LOWS:**
  - Pre-existing key mismatch: useOrders.updateOrderStatus sends `cancellationReason` but API reads `reason`. Merchant rejection reason silently drops.
  - authHeaders() silent degradation when session missing. Surfaces as confusing 'Failed to update' rather than 're-login required'.
  - `CONCURRENT_DECISION` sentinel uses string-message matching (fragile to future refactors).
  - `tryRazorpayRefund` returns `simulated:true` for three distinct reasons (dry-run / no-payment / error). Single boolean conflates them; ops can't query 'how many real failures today'.
  - Smoke-test python3 dependency for ISSUE_ID extraction (WARN added in round-6; jq would be more standard).
  - Dev test scripts (test_refund_order.ts, test_accept_order.ts) now 401 — needs comment update.
  - Reconciliation SQL casts `(metadata->>'orderRequestId')::uuid` without filtering — a single malformed legacy row will brick the entire reconciliation pass.
- **Scope when picked up:** ~6-8 files across apps/api/src/index.ts + scheduled-jobs.ts + merchant-app/useOrders.ts. Most are 5-20 line patches; the storeStaff.role addition needs a schema migration.
- **Status:** Queued — all are MEDIUM/LOW non-blockers per the round-5 adversarial review. The deploy-blocking critical (XC1 merchant rejection) was fixed inline in round-6.
- **Date added:** 2026-06-05
- **Originated from:** WS2 round-5 hardening bundle's adversarial review workflow (20 agents, 1M tokens).

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

### CouponBuilder refactor for Phase 1+2 new fields — DEFERRED FROM PHASE 3 (2026-06-08)
- **What:** Extend `apps/admin-web/src/components/modules/marketing/CouponBuilder.tsx` to expose the new schema fields the backend now supports: `dailyUsageLimit` (number), `eligibleVerticals` (multi-select from Vertical table), `eligibleOrderTypes` (multi-select: PICKUP / DINE_IN), `bogoMode` (radio: CHEAPEST default | SAME_PRODUCT), `inactiveSinceDays` (number, default 30, shown only when audience=INACTIVE_USERS). PLUS in the list view: rename "Delete" button to "Archive" with an explainer modal (because Phase 2D made delete a soft-delete); add Status filter chips (Active / Inactive / Archived) wired to the new `includeArchived` query param. PLUS build an `EditCouponModal` that reuses the form components and calls `updateCoupon` (the API already supports PATCH on all 21 fields; only the UI is missing). PLUS the debounced code-uniqueness check via `checkCodeAvailability` + a client-generated UUID `Idempotency-Key` header on `createCoupon` submit.
- **Why it matters:** Phase 1 added 8 new coupon columns + an `audit_log` table. Phase 2 hardened the entire validate-coupon → POST /orders pipeline to honor those new fields. Phase 3 backend (5 new endpoints) + service layer (`couponService.ts`) is ready. Admin can already SET these fields via direct API call (Postman, curl) — the only gap is the form UI. Without this refactor, the admin team will need to know which API fields to send via JSON body. With it, they get checkboxes and number inputs and a live preview.
- **Why deferred:** `CouponBuilder.tsx` is a single 600+ line component with tight coupling between form state, live preview, and theme picker. A correct extension needs careful refactoring (state hooks, validation, the live preview, sequential UI for "BOGO mode appears only when discountType=BOGO" etc.). Doing it in the same turn as the rest of Phase 3 risked introducing regressions on existing flows we couldn't fully verify. Better to do it as a focused single-component refactor with diff + tsc + Pranav review.
- **Scope:** `apps/admin-web/src/components/modules/marketing/CouponBuilder.tsx` (the existing list+create file — extend, don't rewrite). Possibly extract `EditCouponModal.tsx` as a sibling. No backend changes — couponService.ts already has every method needed.
- **Estimated effort:** ~90-120 min of focused work in one session.
- **Status:** Queued — Phase 1+2 ready to deploy without this; admin will be able to manage all old fields after deploy; the new fields will need direct API calls until this lands.
- **Date added:** 2026-06-08
- **Originated from:** Phase 3 session 2026-06-08 — completed backend endpoints, types/methods, analytics pages, audit log wiring, but explicitly deferred the CouponBuilder form refresh.

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

### 2026-06-13 — queue decisions + Phase 9 RLS epic kickoff
- **D1 store-hours — DECIDED (Pranav):** capture open/close time DURING merchant signup (when adding each store), editable later in Settings. Structural fix, forward-looking. NOTE: does not retro-fix the 25 existing NULL-hours branches — those merchants set hours in Settings (save bug already fixed) or via a one-time nudge. Implementation = merchant signup-flow change (rides OTA/native). QUEUED to build.
- **D2 data hygiene — DONE 2026-06-13:** deleted 2 "Test City" rows (0 refs); backfilled Clean cuts Store.merchant_id (= its own id; merchants row + branch already existed). 
- **⚠️ Folli Medicals (7c575305-…) — STRUCTURAL REPAIR NEEDED (separate):** Store.merchant_id still NULL because it has NO merchants row and NO merchant_branches row (lost them). Needs the "Part 0" repair from the see-the-attached-screenshots plan: recreate merchants row + main branch with real storefront lat/long (needs Pranav's confirmation of the store's real address/coords). Until then it stays invisible to customers.
- **Phase 9 RLS epic — STARTED:** route-through-API + gated lockdown for the 5 app-written exposed tables. Order (Pranav): merchants + Store FIRST (worst — merchants is anon-writable), then StoreProduct, Product, ProductImage. See docs/pending-queue-2026-06-13.html §3.

### Phase 9a backend — DONE 2026-06-13 (deployed; apps + lockdown remain)
- API L5568 merchants-sync: anon → supabaseAdmin ✅ (commit 5d3466ca).
- Endpoints LIVE (commit 2974e080, deployed + smoke-verified 401): PATCH /merchant/profile/:merchantId (Store+dining, whitelisted, userCanManageMerchant/admin), PUT /merchant/payout/:merchantId (bank, OWNER-ONLY/admin), POST /admin/merchants + PATCH /admin/merchants/:id (requireAdmin, whitelisted, audit-logged).
- **9a app rewires — DONE 2026-06-13 (commit 565bc6f6):** store-details.tsx + payouts.tsx (merchant-app, services/merchant.ts) → API; useMerchants + MerchantDirectory (admin-web) → API; merchant-web SignupWizard annotated RETIRED. Exhaustive re-grep: 0 direct merchants/Store writes in any live app. tsc clean.
- **9a lockdown — STAGED + GATED:** apps/api/scripts/phase9a_merchants_store_lockdown.STAGED.sql (REVOKE writes on merchants + Store, keep SELECT) + _verify.ts. APPLY ONLY after (a) PR #3 merged (admin-web live) AND (b) merchant OTA propagated.
- **9b (StoreProduct/Product/ProductImage)** still pending — see docs/pending-queue-2026-06-13.html §8.

### Phase 9b (StoreProduct/Product/ProductImage) — investigation + design DONE 2026-06-13; build pending
Most intricate cluster (core daily merchant catalog/inventory flows). Full write-flow analysis + proposed endpoint design in docs/pending-queue-2026-06-13.html §8 (9b). 5 endpoints: POST/PATCH /merchant/products (composite Product+StoreProduct+ProductImage txn, kind custom|menu), PATCH+DELETE /merchant/store-products/:id (inventory), POST /merchant/store-products/configure (bulk). Auth: userCanManageBranchFull on StoreProduct.branch_id / admin. Refactor 5 sites: AddCustomProductModal, AddMenuProductModal, ConfigureProductsModal, useInventory, admin StoreProductTable → re-grep → gated lockdown. RECOMMEND a dedicated session (breaking these = merchants can't manage catalog/stock).

### Phase 9b backend — DONE 2026-06-13 (deployed; app rewires + lockdown remain)
Endpoints LIVE (commit 020584b2, deployed + smoke-verified 401): POST /merchant/products/save (composite Product+ProductImage+StoreProduct, custom+menu, create+edit), PATCH + DELETE /merchant/store-products/:id (inventory; authorizeStoreProduct → branch owner/admin), POST /merchant/store-products/configure (bulk). Writes via supabaseAdmin, whitelisted literal DB cols.
**REMAINING 9b (next session — app rewires):** AddCustomProductModal + AddMenuProductModal → POST /merchant/products/save (build {product, images[], storeProducts[], replaceVariants}); ConfigureProductsModal → POST /merchant/store-products/configure; useInventory updateItem/deleteItem → PATCH/DELETE /merchant/store-products/:id; admin StoreProductTable → PATCH /merchant/store-products/:id. Keep storage uploads client-side (pass URLs). Then re-grep (0 direct StoreProduct/Product/ProductImage writes) → GATED lockdown (REVOKE writes on all 3, keep SELECT). Gate on merchant OTA + PR #3 merge.

### Phase 9b app rewires — DONE 2026-06-13 (commit d9d2a2bb); lockdown staged + gated
All 5 catalog write sites routed through the API: AddCustomProductModal + AddMenuProductModal → saveProduct; ConfigureProductsModal → configureStoreProducts; useInventory update/delete → PATCH/DELETE; admin StoreProductTable → PATCH. services/catalog.ts (NEW). Storage uploads stay client-side. Exhaustive re-grep: 0 direct StoreProduct/Product/ProductImage writes in any live app. tsc clean both apps.
**9b lockdown — STAGED + GATED:** apps/api/scripts/phase9b_catalog_lockdown.STAGED.sql + _verify.ts. APPLY ONLY after PR #3 merged + merchant OTA propagated.

### 🔐 PHASE 9 COMPLETE (code) — 3 staged lockdowns awaiting the SAME gate (PR #3 merge + merchant OTA propagation):
1. apps/api/scripts/phase8_branch_lockdown.STAGED.sql  (merchant_branches)
2. apps/api/scripts/phase9a_merchants_store_lockdown.STAGED.sql  (merchants + Store)
3. apps/api/scripts/phase9b_catalog_lockdown.STAGED.sql  (StoreProduct + Product + ProductImage)
Each has a matching *_verify.ts. Apply order doesn't matter; run each migrate deploy + verify once the gate opens. Also still pending from the broad sweep: ProductAuditLog/_prisma_migrations already locked (2026-06-13); City/table_bookings already locked.
