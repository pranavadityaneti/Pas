# PAS — Session Log

> **Rule:** This file is updated every ~30 minutes during active work, and always before a session ends. It captures conversations, decisions, changes, and open threads so the next context window can pick up seamlessly.

---

## Session: June 21, 2026 — Admin Category Enable/Disable (SHIPPED end-to-end)

### What & why
Built the new feature from the priority queue: admins can toggle any of the 15 Verticals + 136 Tier2Categories on/off. OFF = platform-wide hide (decision D2, single coupled toggle: customer + merchant together). Resumed mid-feature (Task 2 RLS had a `CREATE POLICY` clause-order syntax error from the prior window).

### Done this session (all 8 tasks, approval-gated; 3 deploy decisions via AskUserQuestion)
- **T1–T3 DB migrations (applied to prod, one-at-a-time gated):** `Vertical.is_active` column (`39aedd0c`); 4 RESTRICTIVE RLS policies on Vertical/Tier2Category/Product/StoreProduct for anon+authenticated, AND'd onto existing permissive reads, service_role bypasses (`03a18f2d`); `get_nearby_stores` made category-aware so empty stores auto-drop (`d0f63da4`). Each verified with a no-role-switch logic check (the `SET ROLE anon`-in-prisma-tx test broke with P2028, replaced).
- **T4 (`0c0765a5`):** `validateCategoriesEnabled` pure guard + 5 unit tests (16/16 green via `npx tsx --test`).
- **T5 (`5fdfc981`):** 3 admin endpoints (`GET /admin/categories`, `PATCH .../vertical/:id`, `PATCH .../subcategory/:id`) — GET = CATALOG_ADMIN_ROLES, toggles = SUPER_ADMIN+OPERATIONS (Pranav chose the tighter RBAC), audit-logged; + merchant `CATEGORY_DISABLED` 403 guard in `POST /merchant/store-products/configure`.
- **T6 (`bd6836aa`):** admin-web Categories tab (`CategoriesTab.tsx` + minimal MasterCatalog wiring via early-return) — toggles, product counts, expandable subcategories, confirm-on-disable, optimistic updates.
- **T7 (`ce571deb`):** Pranav chose BOTH halves — T7a airtight server gate in `POST /order-requests` (`CATEGORY_UNAVAILABLE`, mirrors STORE_OFFLINE, pre-payment) + T7b consumer `revalidateCart()` prune on CartScreen focus.

### Deployed (Pranav chose "API + admin-web now, defer consumer OTA")
- **API → EB:** `npm run build` → committed `dist` (`f1cfbc01`) → `eb deploy` (`app-260621_224810548610`). Verified `/health`→200, `/admin/categories`→401 (route live). No `setenv` (no new env vars — per ERRORS.md never run setenv standalone here).
- **admin-web → Vercel:** pushed branch `feat/consumer-global-config-wiring` (32 commits, fast-forward); Vercel `pas-admin-web` build = **success**. (Confirmed Vercel deploys admin-web from THIS branch, not main — main is 80 commits behind.)
- **Deferred:** consumer cart-prune (T7b) rides the next consumer OTA; the server gate is the correctness backstop.

### Audit (adversarial, per the rule) — passed
No consumer service_role product-read leak (all 9 consumer read paths go through RLS-filtered supabase). Both toggles bite (139,965/140,174 products have category_id). Migrations intact (4 policies, column, RPC, 15/136 active). Accepted limitation: merchant can't see parked stock in a disabled category (intended coupling D2; "Paused by platform" badge deferred). Scope clean: my commits one-task-each; pre-existing working-tree noise (docs, index.html/vite.config, deleted script) left untouched.

### Open threads
- Consumer OTA carrying T7b (cart prune) — bundle into the next planned consumer OTA.
- "Paused by platform" merchant badge (fast-follow); two-toggle split (customer-hidden vs merchant-allowed) — future.
- Next priority-queue item after this: #14 Full notification scenario coverage.

---

## Session: June 16, 2026 — Phase 2 FINAL (StoreProduct.storeId rework, Option B)

### What & why
Picked up the inventory error-hunt's "Phase 2 FINAL" item: `StoreProduct.storeId` held a *branch* id with no real FK (the Prisma schema declared a `storeId→Store` FK that did NOT exist in the DB) → 26/44 listings orphaned, Freshly silently lost 67% of its catalog. Pranav directed a *solidified* fix ("no leaks, no gaps, no errors") rather than a patch → **Option B: relocate the Store↔branch link to `merchant_branches.store_id` with a real FK, decouple all code from `StoreProduct.storeId`, then drop the column.**

### Done this session (approval-gated until Pranav said "execute all")
- **DB (prod, via `$executeRawUnsafe` scripts in `apps/api/scripts/phase2final_b*.ts`):** B1 add `merchant_branches.store_id`; B2 backfill 5 branches (21 test/orphan stay NULL by design); B3 hard-delete 4 mystery StoreProduct rows (0 order history, Pranav-approved); B4 repair 22 Freshly orphans; B5 add `fk_merchant_branches_store` FK (negative+positive tested, rolled back); B6.0 storeId DROP NOT NULL; B9 branch_id SET NOT NULL.
- **Code (committed):** B6.1 coupon path derives storeId via `merchant_branches` include; B6.2/6.3 both StoreProduct upserts stop writing storeId; B7 3 client reads → branch_id (admin StoreProductTable, merchant AddMenuProductModal + useInventory). API tsc 0 / build 0; admin-web build 0; merchant-app tsc 0.
- **Caught a sequencing bug mid-flight:** removing the storeId write would have violated the column's NOT NULL — inserted B6.0 (DROP NOT NULL) as a prerequisite before the write-site edits. No prod incident.

### Adversarial audit of B1-B9 (Pranav-requested) — found 3 real bugs → B11 remediation (Full DB-enforced cert)
- Certified clean: 0 leaks in existing data, FK works, B10 won't be blocked, all-8-apps reader sweep complete.
- **F1 CRITICAL (fixed, code):** branch creation never set store_id → new merchants would re-orphan. Fixed 6 creation sites.
- **F2 HIGH (fixed, DB):** `delete_merchants_cascaded` referenced StoreProduct.storeId (B10-breaking) — missed in B7 (app-only sweep). Rewrote to branch_id; bonus: old fn only caught 7/40 rows.
- **F3 HIGH (fixed, code):** my B6.1 null-filter made coupon vertical-eligibility fail-OPEN. Restored fail-closed.
- **F5 LOW (fixed, DB):** indexed merchant_branches.store_id.
- **F4 MEDIUM (gated):** delete 21 verified-safe orphan branches (0 refs) → store_id NOT NULL (after F1 deploys). Awaiting delete confirm + deploy.

### Deferred (documented in forlater.md)
- **⛔ B10 (drop the column) — GATED** on admin-web Vercel deploy + merchant OTA propagating (shipped bundles read the column directly via Supabase).
- Order.storeId/branchId same bug class; Store.merchant_id missing FK; Folli Medicals branch-less store. All own tickets, untouched.

### Files changed
- `apps/api/src/index.ts` (B6.1/6.2/6.3), `apps/api/prisma/schema.prisma` (B1/B6.0/B9), `apps/api/scripts/phase2final_*.ts` + `investigate_storeid_fk*.ts` (new), `apps/api/dist/index.js` (rebuilt).
- `apps/admin-web/src/components/modules/merchants/StoreProductTable.tsx`, `apps/merchant-app/src/components/AddMenuProductModal.tsx`, `apps/merchant-app/src/hooks/useInventory.ts` (B7).

---

## Session: May 18, 2026

### Timeline

#### 10:00 — Service Modes & Store Visibility Fix (Completed)

**Three bugs reported from merchant Store Timings screen:**

1. **Toggle persistence** — Table Booking toggle resets to OFF on navigate away/back.
   - **Root cause:** `isDirty` in `timings.tsx` didn't include service mode state → Save button stayed disabled → changes never persisted.
   - **Fix:** Added 3 comparison lines for `servicePickup`, `serviceDinein`, `serviceTableBooking` to `isDirty`.

2. **Store "always active"** — Store shows active on consumer app despite being outside operating hours.
   - **Root cause:** `checkIsOpen()` defaults to `true` when `operating_hours` is null. Merchant likely never saved hours (because of Bug 1).
   - **Fix:** Added `__DEV__` warning for null operating_hours. Primary fix is Bug 1 — once toggle save works, hours will persist.

3. **Cross-tab visibility** — Dining restaurant with Pickup enabled doesn't appear on Pickup screen.
   - **Root cause:** Store tab filtering was vertical-based (`isDining`/`!isDining`). `service_pickup`/`service_dinein` never fetched.
   - **Fix:** Added `servicePickup`/`serviceDinein` to TransformedStore + SELECT query. Changed filter to `s.serviceDinein`/`s.servicePickup`. Added `orderMode` nav param for correct cart classification.

**Files modified (7):**
- `apps/merchant-app/app/(main)/settings/timings.tsx` — isDirty fix
- `apps/consumer-app/src/utils/dataTransformer.ts` — interface + mapping + warning
- `apps/consumer-app/src/hooks/useStores.ts` — SELECT + filter logic
- `apps/consumer-app/src/navigation/types.ts` — orderMode param
- `apps/consumer-app/src/screens/HomeFeedScreen.tsx` — passes `orderMode: 'pickup'`
- `apps/consumer-app/src/screens/DiningScreen.tsx` — passes `orderMode: 'dining'` (4 places)
- `apps/consumer-app/src/screens/StorefrontScreen.tsx` — reads orderMode, uses for cart isDining

**TypeScript:** Passed (`npx tsc --noEmit`). Only pre-existing DiningCheckoutScreen errors.

---

#### ~10:30 — Classic Cafe Pickup Visibility Debug

**Issue:** Classic Cafe - Kokapet has pickup enabled but doesn't show on Pickup screen.

**Root cause:** `get_nearby_stores` PostGIS RPC had `AND mb.is_active = true` — inactive stores were excluded entirely from Pickup (never even reached the client). Dining screen didn't have this issue because it uses `diningStores` from `useStores()` directly (no PostGIS gate).

**Fix:** Removed `is_active = true` filter from the RPC. Inactive stores now returned with distance data. Client already had "Currently Offline" overlay UI — it just never got rendered because inactive stores were excluded upstream.

**Files modified:**
- `apps/api/rewrite_get_nearby_stores.sql` — removed `is_active = true`
- `apps/api/apply_new_rpc.js` — same (inline SQL copy)

**Applied to production:** `cd apps/api && node apply_new_rpc.js` — SUCCESS

---

#### ~10:45 — Play Console Android Upload Errors (Open)

**Three errors when uploading AAB to Google Play Internal Testing:**

| # | Error | Cause | Fix Needed |
|---|-------|-------|------------|
| 1 | Version code 6 already used | `versionCode: 3` in app.json, but previous builds used up to 6. Need ≥ 7 | Bump `versionCode` in app.json |
| 2 | Package must be `com.pas.consumerapp` | Play Console registered as `com.pas.consumerapp` (matches iOS), but Android package is `io.pickatstore.consumer` | Change `android.package` in app.json |
| 3 | Content provider authority conflicts | `io.pickatstore.consumer.*` authorities claimed by other devs | Auto-fixes when package name changes to `com.pas.consumerapp` |

**Status:** Diagnosed, fix NOT yet applied. Requires:
1. Change `android.package` from `io.pickatstore.consumer` to `com.pas.consumerapp` in app.json
2. Bump `versionCode` to 7 (or higher)
3. Rebuild with EAS (`eas build --platform android --profile production`)
4. **WARNING:** Changing Android package name = new app identity. If any users have the old package installed, they'd need to uninstall/reinstall. Since this is pre-launch (internal testing only), this is fine.

---

### PAS_handoff.md Updates

Updated at ~10:20 with:
- Section 2: isDirty bug fix note
- Section 3: orderMode param
- Section 5: orderMode-aware cart
- Section 20 (NEW): Full Service Modes & Store Visibility Fix write-up
- dataTransformer, useStores, DiningScreen, HomeFeedScreen entries updated
- NEEDS TESTING checklist added
- File index entries updated (6 files)

---

#### ~11:00 — Handoff Audit + OTA Tracking Setup

**Deep audit of PAS_handoff.md** — subagent diffed every modified/new file against git HEAD and compared with handoff docs.

**6 items found MISSING from PAS_handoff.md:**
1. `get_nearby_stores` RPC: `is_active=true` removal (rewrite_get_nearby_stores.sql, apply_new_rpc.js)
2. CheckoutScreen: STORE_OFFLINE/CLOSED error alerts (was only documented for useOrderRequests)
3. DiningCheckoutScreen: getUser→getSession auth fix + store status errors + improved error parsing
4. AuthScreen: platform-specific KeyboardAvoidingView (was listed as "textAlign only")
5. GlobalHeader: X clear button on search (was listed as "textAlign only")
6. profile.tsx (merchant): `refreshUser()` after save (was listed as "minor cleanup")
7. Signup endpoint: dynamic verticalId with Prisma validation (was undocumented)

**All 7 now added** to PAS_handoff.md (sections 21–24 + file index updates).

**Created OTA_Updates.md** — tracks 20 consumer app changes + 11 merchant app changes. Consumer is 🔴 OVERDUE (no OTA since May 15). Merchant is ⛔ BLOCKED (needs new EAS build first).

**Updated CLAUDE.md** — added OTA tracking rules (remind after 6 changes, log every change).

---

#### ~11:30 — Android EAS Builds Kicked Off

**Consumer app fixes before build:**
- `android.package` changed from `io.pickatstore.consumer` → `com.pas.consumerapp` (matches Play Console registration + iOS bundleIdentifier)
- `android.versionCode` bumped from 3 → 7 (Play Console rejected 6, autoIncrement will handle from here)

**Both builds running in parallel on EAS:**
- Consumer: `eas build --platform android --profile production`
- Merchant: `eas build --platform android --profile production`

**Plan after builds complete:**
1. Download AABs from expo.dev
2. Upload to Play Console (consumer: internal testing, merchant: internal testing)
3. Push OTA to iOS for both apps

**Correction from earlier:** Merchant build 14 was already submitted to TestFlight on May 16 (not pending). Both OTAs (consumer + merchant) pushed earlier this session are already live for iOS testers.

---

#### ~11:45 — Android Builds Complete

**Both Android EAS builds finished:**
- Consumer: `8517d800` (versionCode 12, package `com.pas.consumerapp`) — AAB: `hre2PZhQ4bPiKWycVDrJur.aab`
- Merchant: `db30f8ec` (versionCode 25, package `io.pickatstore.merchant`) — AAB: `t4Sihp7VZBBHxuuoEHNzmt.aab`

Note: Two consumer builds ran (versionCode 11 from worktree, 12 from main repo). Use versionCode 12.

---

#### ~12:00 — Play Console Upload Key Issues

**Merchant signing key mismatch:** credentials.json pointed to consumer's keystore. Tried EAS remote — also wrong key. Original keystore password lost.

**Fix:** Requested upload key reset on Play Console:
- Exported PEM from `new-upload-keystore.jks` → `~/Desktop/merchant-upload-cert.pem`
- Submitted "Request upload key reset" (reason: forgot keystore password)
- Status: **Pending** — waiting for Google approval
- After approval, upload: `t4Sihp7VZBBHxuuoEHNzmt.aab` (versionCode 25)

**Consumer Android AAB:** Ready to upload now (`hre2PZhQ4bPiKWycVDrJur.aab`, versionCode 12, package `com.pas.consumerapp`)

---

#### ~12:30 — Merchant Dashboard "Offline" Audit & Fix

**Issue:** Merchant app shows store as offline despite operating hours being configured (all days, 12PM-9PM, current time 1:18PM).

**Audit findings (3 pre-existing bugs, not regressions):**

1. **Operating hours never saved to DB** — Queried `merchant_branches` directly. Only 2 of 34 branches have `operating_hours` set, and neither has 12PM. The user's changes existed only in local React state.
   - **Root cause:** `updateStoreDetails` does `supabase.update().eq('id', activeStoreId)`. If `activeStoreId` is a merchant UUID (not a branch UUID), the UPDATE matches 0 rows and **Supabase returns no error** — silent data loss.
   - **Root cause of wrong ID:** Owner discovery adds `{branchId: merchantId}` as a phantom branch. AsyncStorage can cache this stale ID across app restarts.

2. **Dashboard shows offline during loading** — `store` is null while `fetchStore()` runs → `!store?.active` → `!undefined` → `true` → offline banner. No loading guard existed.

3. **`toggleStoreStatus` has same 0-row risk** — Same pattern as `updateStoreDetails`.

**Fixes applied (3):**

| # | File | Fix |
|---|------|-----|
| 1 | `dashboard.tsx` | Added loading guard — spinner + "Loading store..." while `storeLoading \|\| !store` |
| 2 | `StoreContext.tsx` | Added `.select('id')` to both `updateStoreDetails` and `toggleStoreStatus` Supabase calls. Check `data.length === 0` → return error instead of silent success |
| 3 | `StoreContext.tsx` | After fetching real branches from `merchant_branches`, filter out phantom branches from `finalContext.branches` using `realBranchIds` Set. Prefer saved branch only if it exists in `allBranches`. Log whether resolved branch is a real DB row |

**TypeScript:** Passed. Only pre-existing `baseUrl` deprecation warning.

**OTA Status:** 3 merchant changes queued (not yet pushed).

---

### Open Threads

- [ ] **Push merchant OTA** — 3 new fixes queued (dashboard loading guard, row count validation, phantom branch cleanup)
- [ ] **Upload consumer AAB to Play Console** — should work now
- [ ] **Merchant key reset approved** — new key active May 20 7:01 AM UTC, then upload `t4Sihp7VZBBHxuuoEHNzmt.aab`
- [ ] **Test service modes fix** — toggle persistence, dual-tab visibility, cart mode, operating hours
- [ ] **Test store offline fix** — after OTA push, verify: timings save persists to DB, dashboard shows loading then correct status

---

## Session: May 25, 2026

### Timeline

#### ~Start — Apify/Zepto Scraper Category Pipeline Audit + Fix

**User request:** Audit the Apify/Zepto product scraping integration in the admin dashboard. Categories showing as "Other" instead of correct categories.

**Audit findings (3 critical bugs):**

1. **`mapCategory()` result never saved** — `processScraperDataset()` computes `{ vertical, category }` strings but never writes them to the SyncQueue upsert. `vertical_id` and `category_id` always NULL.
2. **Schema ↔ Frontend type mismatch** — SyncQueue has UUID FK columns (`vertical_id`, `category_id`), but frontend `SyncItem` interface expects string fields (`vertical`, `category`).
3. **Approve endpoint crashes on non-UUID** — Raw SQL casts `item.vertical_id::uuid` but receives string names from frontend dropdowns.

**Additionally found:** Massive name mismatch between `mapCategory()` output strings and actual DB `Tier2Category` row names. Only 2 of 8 categories matched (`Snacks & Munchies`, `Beverages`).

**Fixes applied (Tasks 1.1–1.4, all in `apps/api/src/index.ts`):**

| Task | What |
|---|---|
| 1.1 | `processScraperDataset()` pre-fetches Vertical + Tier2Category tables, resolves `mapCategory()` strings to UUIDs, writes `vertical_id` + `category_id` to SyncQueue upsert |
| 1.2 | `GET /catalog/sync/queue` includes Vertical + Tier2Category relations, flattens to `vertical` + `category` string fields for frontend |
| 1.3 | `POST /catalog/sync/approve` resolves string names → UUIDs server-side (handles both pre-resolved UUIDs and user-edited dropdown strings) |
| 1.4 | Removed dead `validCategories` array. Created `scripts/seed_missing_tier2categories.ts` to add 10 missing Tier2Category rows across 4 Verticals |

**TypeScript:** Clean compile after every change.

**Files modified:**
- `apps/api/src/index.ts` — Tasks 1.1, 1.2, 1.3, dead code removal
- `apps/api/scripts/seed_missing_tier2categories.ts` — NEW, one-time seed script

### ⚠️ BLOCKED: Deploy gated on Supabase billing restoration

**When user confirms Supabase is back, execute in order:**
1. `cd /Users/pranavaditya/projects/pas-admin/apps/api && npx ts-node scripts/seed_missing_tier2categories.ts`
2. `cd /Users/pranavaditya/projects/pas-admin/apps/api && npm run build && eb deploy`
3. Test: trigger a scrape from admin dashboard LiveImportModal → verify Sync Queue shows correct vertical/category names → approve items → verify Product table has correct `vertical_id`/`category_id`

### Also blocked: Android AAB upload + smoke testing (same Supabase gate)
- Both AABs built and signing-verified: Merchant (vc27) + Consumer (vc13) at ~/Desktop/
- Friend uploads to Play Console (Quantum Works Pvt Ltd) once Supabase is back for smoke testing

### Open Threads

- [ ] **Supabase billing restoration** — user paid, processing pending
- [ ] **Deploy scraper category fix** — seed script + API build + eb deploy (gated on Supabase)
- [ ] **Android AAB upload** — hand AABs to friend for Play Console Internal Testing (gated on Supabase for smoke test)
- [ ] **Map merchant + consumer app wiring to relational taxonomy** — audit in progress (current task)
- [ ] **Remove verbose-error from API /auth/send-otp** — temporary diagnostic, revert after Supabase restored

---

## Session: May 25–26, 2026

### Theme
Android order realtime stability → merchant branch-state sync → structural RLS bug on `orders` table that was hiding every paid order from every merchant. Plus rule changes to harden how we work (no Haiku, scope discipline, plain-English alongside technical, deferred work queue).

### Timeline

#### May 25 — Android order realtime fix (consumer OTA `a7ea5ab9-…`)
- **Bug:** Android customer app stuck on "waiting for merchant approval" after merchant accepts. iOS unaffected. Root cause: Android aggressively kills Supabase Realtime WebSockets in background, no fallback existed.
- **Fix:** `apps/consumer-app/src/hooks/useOrderRequests.ts` — added 5s polling on `order_requests` non-PENDING status + `AppState.addEventListener('change', …)` that re-subscribes the channel + restarts polling when app foregrounds. `applyUpdate()` extracted as shared handler for WebSocket and polling paths. Cleanup handles all three.
- **Verification:** User confirmed Android pickup order works end-to-end after OTA.
- **File now `// @lock`** with rationale comment.

#### May 25–26 — Duplicate "Freshly Vadapalli" branch investigation (no code change)
- Two `merchant_branches` rows named "Freshly Vadapalli" — branch A `c20b9f8f-…` (owner Pranav `9143278d-…`, 6 product rows / 3 visible), branch B `3eb3939c-…` (owner Aditya `57f2aa5a-…`, 15 product rows / 14 visible).
- Initially assumed duplicate → briefly set Branch B `is_active=false` for cleanup. User clarified both are legitimate separate branches → reversed the deactivation.
- Branch A had `latitude=null, longitude=null` on `merchant_branches` row → invisible to customer `get_nearby_stores` RPC (which filters `latitude IS NOT NULL`). Fixed by `UPDATE merchant_branches SET latitude=16.8165, longitude=81.812 WHERE id='c20b9f8f-…';`. User confirmed both branches now visible to customers in Vadapalli.
- Legacy data debt flagged: merchant signup flow allowed saving branch without coords. Captured in `forlater.md` indirectly (related to `is_active` overload + signup flow notes).

#### May 26 — Merchant branch state sync (merchant OTA `ede26024-…`)
- **Bug:** Merchant app's offline toggle and operating state didn't sync with DB changes. After we externally set `is_active` via SQL editor, the merchant app held stale state until force-close. System-wide concern: any DB mutation outside the merchant's own toggle was invisible.
- **Audit findings (in `apps/merchant-app/src/context/StoreContext.tsx`):**
  - `toggleStoreStatus()` itself was correctly written (awaits, checks `error`, checks `data.length===0`).
  - No realtime subscription on `merchant_branches` existed in StoreContext.
  - `AppState` and `AppStateStatus` imported but never used. `heartbeatInterval` ref declared but never assigned. Scaffolded and abandoned.
- **Fix:** Added one `useEffect` block after the existing mount-effect (~line 411). Three behaviors:
  1. AppState `'change'` listener → on `'active'`, call `fetchStore()`
  2. Supabase Realtime subscription on `merchant_branches` UPDATE filtered by `merchant_id=eq.${merchantId}` → on event, call `fetchStore()`
  3. 60s polling fallback via `heartbeatInterval` ref (Android WebSocket safety net)
  All three cleaned up on unmount or `merchantId` change.
- **DB-side requirement:** `merchant_branches` was NOT in the `supabase_realtime` publication. Without that, no `postgres_changes` events fire. Confirmed via `pg_publication_tables` query. Fixed with `ALTER PUBLICATION supabase_realtime ADD TABLE merchant_branches;`.
- **Verification:** User ran SQL UPDATEs from Supabase editor — banner flipped color in <5 seconds in both directions. Polling fallback verified at ~60s when realtime was disabled. AppState foreground refetch verified by backgrounding the app and changing DB.

#### May 26 — Orders RLS structural bug (DB-only fix, no code/OTA)
- **Bug discovery path:** User reported dining orders disappearing from merchant Processing tab after customer payment. Initial hypothesis (Main Store filter in `useOrders.ts`) was wrong — confirmed by user testing Madhapur branch view + zero rows. RLS hypothesis surfaced after pulling policies on `orders`.
- **Structural cause:** `orders.store_id` is `uuid` and holds the **merchant_id**. `store_staff.store_id` is `uuid` but holds a **branch_id** (the merchant app's Staff Management screen explicitly filters `branchIdSet.has(item.store_id)` — `apps/merchant-app/app/(main)/settings/staff.tsx:64`). The RLS policy compared these directly: `store_id IN (SELECT store_id FROM store_staff WHERE user_id = auth.uid())`. They never match for any merchant in the system. Every paid order was invisible to every merchant via RLS. Historical orders moved to COMPLETED only because backend code using service_role (bypassing RLS) wrote those updates.
- **Discovery sequence (worth remembering for similar bugs):**
  1. Customer placed dining order against Classic Cafe — Madhapur (test merchant `9c35148d-…`).
  2. Order successfully written to `orders` table with `status='CONFIRMED'`, `branch_id='a39cbfb3-…'` (Madhapur). Confirmed via SQL.
  3. Merchant app couldn't see it in any tab. Switching active branch to Madhapur didn't help.
  4. RLS on `orders` SELECT requires `store_id IN (store_staff records for auth.uid())`. Looked empty for the Classic Cafe merchant_id.
  5. Realized `store_staff.store_id` stores branch UUIDs, not merchant UUIDs. The RLS comparison was structurally wrong.
- **Fix:** DB-only. Rewrote two policies on `orders`:
  ```sql
  CREATE POLICY "Merchants can view their store orders" ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM store_staff ss
      JOIN merchant_branches mb ON mb.id::text = ss.store_id::text
      WHERE ss.user_id::text = auth.uid()::text
        AND ss.is_active = true
        AND mb.merchant_id::text = orders.store_id::text
    )
  );
  ```
  Same shape for UPDATE with WITH CHECK. Casts to `text` required because `merchant_branches.id` and `merchant_id` are `text` while `orders.store_id`, `store_staff.store_id`, `store_staff.user_id` are `uuid`.
- **Verification:** User force-closed merchant app, reopened, switched to Madhapur branch — both previously-invisible orders (PAS-20260525-7908 + PAS-20260525-5352) appeared in Processing. Marked complete via OTP. End-to-end working.

#### May 26 — Observations during post-fix testing
1. **Realtime gap on merchant Pending/Processing tabs.** New orders don't appear on Pending/Processing in realtime — only on screen refresh / pull-to-refresh. Ready tab appears instant because it's local optimistic update from the merchant's own button press, not realtime. Audit on `useOrders.ts` deferred to `forlater.md` item #2.
2. **Request ID → Order ID UX confusion.** Pre-payment: customer + merchant see `order_requests.id` (UUID). Post-payment: instantly flips to `orders.order_number` (PAS-YYYYMMDD-NNNN). Original UUID never shown again. Three solution options presented (A: generate order_number at request creation and persist through, B: show both post-payment, C: short shared suffix). User chose Option A but deferred to `forlater.md` item #1 — too much scope for end-of-session.

#### May 26 — Rules + memory updates
- **`CLAUDE.md` (project):**
  - Added **Workflow Protocol rule #7**: "Stay inside the feature. If touching adjacent code is necessary, STOP and explain WHY + risk + get approval before touching."
  - Added **Model Policy**: "Never use Haiku. Only Opus 4.6 / 4.7." Applies to primary assistant, sub-agents, spawned tasks.
  - Added **Communication Style**: "Always plain-English alongside technical. Lead with user-visible effect when that's the point."
  - Added **Deferred Work Queue**: "Read `forlater.md` at session start. Re-surface at phase breaks. Move items between Active/In-progress/Done sections. Never silently delete."
  - Added lock for `apps/consumer-app/src/hooks/useOrderRequests.ts`.
- **`~/.claude/CLAUDE.md` (global memory, newly created earlier in session):**
  - Model Policy (no Haiku)
  - Scope Discipline (don't touch unrelated code)
  - Locked Files convention
  - Audit-Before-Edit ("do not touch code" = read-only)
  - Communication Style (plain English alongside technical)
  - Deferred Work Queue (read forlater on start, re-surface at phase breaks)
- **`forlater.md` (NEW):** 8 deferred items with structure: title, what+why, scope, status, date, originated-from. Sections: Active queue / In progress / Done — archived / Strikethroughs.

#### Lessons from this session worth not repeating
1. **Don't assume premises.** I twice assumed which store Pranav was testing (Freshly vs Classic Cafe). Both were wrong. Cost time and credits. Rule now: when a new test is described, FIRST ask "which store/branch/user/device?" before writing diagnostic SQL. Captured in `CLAUDE.md` Workflow Protocol thinking.
2. **Verify the schema before writing policies.** The first version of the orders RLS rewrite failed with `text = uuid` error because I didn't confirm column types upfront. Always run an `information_schema.columns` check before writing cross-table policies.
3. **`store_id` is dangerously overloaded** — in `orders` it's merchant_id; in `store_staff` it's branch_id. Almost certainly the same pattern exists on other tables (`notifications`, `StoreProduct`?). Captured in `forlater.md` item #8 (broader RLS sweep).
4. **Don't bundle.** Multiple times I wanted to merge the offline-toggle fix with the realtime fix with the RLS fix. They stayed separate; each got its own diff + approval + verification. That's why we could pinpoint what worked and what didn't.

### Files modified this session

| File | Change |
|---|---|
| `apps/consumer-app/src/hooks/useOrderRequests.ts` | Polling + AppState reconnect + `@lock` header |
| `apps/merchant-app/src/context/StoreContext.tsx` | New `useEffect` for realtime + AppState + 60s polling on `merchant_branches` |
| `CLAUDE.md` | +Workflow rule 7, +Model Policy, +Communication Style, +Deferred Work Queue, +lock entry |
| `~/.claude/CLAUDE.md` | NEW. Global rules: model, scope, locks, audit-before-edit, plain English, forlater queue |
| `forlater.md` | NEW. Deferred work queue with 8 items |
| `OTA_Updates.md` | +May 25 consumer entry + May 26 merchant entry + status header refresh |
| `SESSION_LOG.md` | This entry |

### DB changes this session
1. `UPDATE merchant_branches SET latitude=16.8165, longitude=81.812 WHERE id='c20b9f8f-…';` — Branch A coords (Pranav's Freshly Vadapalli)
2. (Briefly) `UPDATE merchant_branches SET is_active=false WHERE id='3eb3939c-…';` + `UPDATE merchants SET status='inactive' WHERE id='57f2aa5a-…';` — duplicate-cleanup experiment, then reversed
3. `ALTER PUBLICATION supabase_realtime ADD TABLE merchant_branches;` — realtime enable
4. `DROP POLICY` + `CREATE POLICY` on `orders` for both SELECT and UPDATE — JOIN through merchant_branches to translate branch_id ↔ merchant_id, with text casts

### OTAs pushed
- Consumer `a7ea5ab9-b9b1-4223-8f22-b532c5ee7a35` (May 25) — Android order realtime fix
- Merchant `ede26024-36f0-4e9d-b53a-e6b628253e97` (May 26) — Branch state sync

### Spawned follow-up tasks (live chips)
- Position 1: Diagnose & fix offline-toggle persistence — **mostly obsolete** after today's fixes. User to manually dismiss. Remaining concerns (RLS overpermissive on `merchant_branches`, `is_active` overload) captured separately in `forlater.md`.
- Position 2: Audit timings save bug + propagate timings to customer app
- Position 3: Tighten RLS on `merchant_branches` to prevent cross-merchant writes

### Open threads (active)
- [ ] **Test dining flow end-to-end on Android** after Option A lands (deferred — `forlater.md` #1)
- [ ] **Realtime for merchant Pending/Processing tabs** (deferred — `forlater.md` #2)
- [ ] **Frequent signout investigation** (deferred — `forlater.md` #6, user's original ask #5 from earlier today)
- [ ] **Operating hours coverage check** SQL (3 queries, deferred — `forlater.md` #7)
- [ ] **User to manually dismiss position-1 chip** (no API to dismiss programmatically)
- [ ] **Decide whether to schedule the broader RLS sweep** (deferred — `forlater.md` #8)

---

## Session: May 26, 2026 (continued — late evening)

### Theme
Frequent signouts investigation Phase 1 + Phase 2A shipped. Major data integrity work: discovered and fixed an `orders.store_id → Store.id` FK violation that was silently failing all Varsha bangles payments. Backfilled `store_staff` for 9 merchants. Installed two DB triggers that permanently prevent the bug class from recurring at signup.

### Timeline

#### Signout investigation — Phase 1 (consumer 401 interceptor)
- **Audit findings:** `apps/consumer-app/src/lib/api.ts:45-89` 401 interceptor calls `purgeAuthSession()` → `supabase.auth.signOut({ scope: 'local' })` → resets nav to Main, on ANY 401 response. Single point of failure. Customer-side audit on `apps/merchant-app/src/lib/supabase.ts` revealed: (a) `ExpoSecureStoreAdapter` swallows all keychain errors silently, (b) no AppState gating of `startAutoRefresh`, (c) uses `setSession()` instead of `refreshSession()` (consumer-app deliberately avoids the former due to GoTrue hang).
- **Plan staged:** Phase 1 → 2A → 2B → 2C → optional 3. One diff + tsc + approval per phase.
- **Phase 1 shipped:** Soft-recovery 401 interceptor. On 401: skip recovery if no token sent (anon endpoint), try `refreshSession()`, retry original request once with new token, purge only on permanent failure (`invalid_grant`, `refresh_token_not_found`, etc.). Consumer OTA `b30507b4-3918-4e0b-a4af-29607669aeba`.
- **Phase 2A shipped:** SecureStore failures observable. Replaced silent `catch {}` blocks in `ExpoSecureStoreAdapter` (`apps/merchant-app/src/lib/supabase.ts`) with `catch (e) { console.warn('[SecureStore] …', e?.message) }`. Pure diagnostic; preserves original return values. Merchant OTA `19d7086a-6deb-4767-87e0-97742a4d40cd`. Waiting for in-the-wild logs via iOS Console.app / `adb logcat` before deciding Phase 2B + 2C scope.

#### Krishna's bug → orders RLS structural fix
- **Reproduction:** dining order `PAS-20260525-7500` against Classic Cafe Madhapur — paid, CONFIRMED in `orders`, but invisible to merchant.
- **Root cause:** RLS on `orders` SELECT/UPDATE compared `orders.store_id` (which is `uuid`, holds merchant_id) against `store_staff.store_id` (which is `uuid`, holds branch_id). Different semantics, never match. Every paid order was invisible to every merchant via RLS. Historical orders went COMPLETED only because backend code using service_role wrote those updates, bypassing RLS.
- **Fix:** DB-only. Rewrote both policies on `orders` to JOIN through `merchant_branches` with text casts:
  ```sql
  USING (
      EXISTS (
          SELECT 1
          FROM store_staff ss
          JOIN merchant_branches mb ON mb.id::text = ss.store_id::text
          WHERE ss.user_id::text = auth.uid()::text
            AND ss.is_active = true
            AND mb.merchant_id::text = orders.store_id::text
      )
  );
  ```
- **Verified end-to-end:** Krishna's previously invisible orders reappeared after force-close + branch switch; he marked them complete via OTP successfully.

#### Systemic store_staff backfill — 9 merchants unblocked
- After fixing the RLS structurally, realized the policy works only if `store_staff` data is populated. Krishna's case showed Classic Cafe had `store_staff` entries from prior session work, but most other merchants had **zero `store_staff` rows** — locking out the owner of every other merchant in the system from their own orders.
- **Diagnostic queries:** 10 of 11 active merchants had a matching `auth.users` row via phone match. Only "Security Test Store" (a test entity with no real user) couldn't be matched.
- **Backfill:** Single SQL with `DISTINCT ON (m.phone)` to avoid within-batch phone-uniqueness collisions. 9 rows inserted (one already existed for Pranav at Freshly). One row per merchant pointing to their oldest branch (sufficient for RLS to cascade across all branches via JOIN).
- **Phone UNIQUE on `store_staff`** discovered mid-investigation — meant we couldn't insert multiple rows per merchant naively. Used SELECT DISTINCT to pick one branch per merchant.

#### Varsha's bug → `orders.store_id → Store.id` FK violation
- **Reproduction:** Pickup order at Varsha bangles — payment succeeds at Razorpay (`pay_StrS3Vuy4GpJ5X`, `pay_StrZufyn0mdw1d`, plus multiple others going back to May 14), but `orders.create()` fails with `Foreign key constraint violated: fk_orders_store (index)`.
- **Schema discovery:** `fk_orders_store` references **`Store(id)`** (Prisma-cased table), NOT `merchants(id)`. The whole session had been assuming the wrong target table. Pattern same as the orders RLS bug — different tables, similar-sounding names, different semantics.
- **Root cause:** Varsha bangles had a `Store` row with `id = 63c32d5a-…` (a fresh UUID), not aligned to her merchant_id (`e49016c2-…`). Customer app correctly sends `store_id = merchant_id`, FK lookup against Store fails. Created 2026-04-08, predates the current `trg_auto_link_store_merchant` trigger that enforces alignment.
- **Scope check:** Only Varsha bangles among 11 active merchants was misaligned. NOT systemic in current data — historical one-off.
- **Fix:** Two UPDATEs in one transaction:
  1. `UPDATE "StoreProduct" SET "storeId" = 'e49016c2-…' WHERE "storeId" = '63c32d5a-…'` (23 rows)
  2. `UPDATE "Store" SET id = 'e49016c2-…' WHERE id = '63c32d5a-…'` (1 row)
- Verified zero orphans post-COMMIT. Next Varsha bangles order will pass FK.

#### Phase 3 (signup-fix) — DB triggers installed
- **Audit findings:** Merchant signup goes through `PATCH /auth/merchant/draft` (`apps/api/src/index.ts:3589`). Confirmed:
  - `merchants` insert with `id = auth.uid()` ✓
  - `Store` insert with `id = merchant_id` ✓ (via pre-existing `trg_auto_link_store_merchant` trigger)
  - `merchant_branches` insert ONLY if `payload.hasBranches === true` ✗ (single-store merchants get no branch)
  - `store_staff` insert NEVER ✗
- **Pre-existing triggers discovered:** `trg_auto_link_store_merchant` (BEFORE INSERT on Store, enforces id alignment), `trg_sync_merchant_data_robust` (creates User row from merchant).
- **Auth context note:** Inserts run via Prisma using DATABASE_URL (effectively service_role). `auth.uid()` returns NULL inside triggers fired from these inserts. So new triggers must derive user_id from `NEW.merchant_id`, not `auth.uid()`.
- **Trigger 1 installed (`auto_create_default_branch`):** AFTER INSERT ON `merchants` → if no branch exists, creates a default one with `id = merchant_id`. SECURITY DEFINER. Verified via live-fire test.
- **Trigger 2 installed (`auto_create_owner_store_staff`):** AFTER INSERT ON `merchant_branches` → if owner has no store_staff at any branch of this merchant AND phone not already used, creates an owner row. SECURITY DEFINER. Verified via chain test — merchants INSERT → Trigger 1 → branch INSERT → Trigger 2 → store_staff INSERT, all in one transaction, then ROLLBACK.

#### CLAUDE.md / global memory updates (additional)
- Added the OTP cache bug to `forlater.md` as item #11
- Added the "manager adds branch = owner" decision as item #12 (intentional behavior, not a bug)
- Moved item #6 (signout) to In Progress with detailed phase breakdown

### Files modified this session (additional)

| File | Change |
|---|---|
| `apps/consumer-app/src/lib/api.ts` | Phase 1 soft-recovery 401 interceptor |
| `apps/merchant-app/src/lib/supabase.ts` | Phase 2A: SecureStore catch blocks now log errors |
| `forlater.md` | Updated: item 6 → In Progress, added items 9 (Varsha — done by end of session), 10 (Krishna — done), 11 (OTP cache), 12 (manager-adds-branch decision); moved completed items to Done section |
| `OTA_Updates.md` | +Consumer OTA `b30507b4` + Merchant OTA `19d7086a` |
| `SESSION_LOG.md` | This entry |

### DB changes this session (additional)
1. `DROP POLICY` + `CREATE POLICY` on `orders` (SELECT + UPDATE) — JOIN through `merchant_branches` to translate branch_id → merchant_id, with text casts
2. Backfilled 9 `store_staff` rows for active merchants whose owners had matching auth users
3. `UPDATE "StoreProduct" SET "storeId" = 'e49016c2-…' WHERE "storeId" = '63c32d5a-…'` (23 rows) — Varsha bangles realignment
4. `UPDATE "Store" SET id = 'e49016c2-…' WHERE id = '63c32d5a-…'` — Varsha bangles Store row id realigned to merchant_id
5. `CREATE TRIGGER trigger_auto_create_default_branch` AFTER INSERT ON `merchants` — auto-creates default branch
6. `CREATE TRIGGER trigger_auto_create_owner_store_staff` AFTER INSERT ON `merchant_branches` — auto-creates owner store_staff row

### OTAs pushed (additional)
- Consumer `b30507b4-3918-4e0b-a4af-29607669aeba` (May 26) — Phase 1 401 soft-recovery interceptor
- Merchant `19d7086a-6deb-4767-87e0-97742a4d40cd` (May 26) — Phase 2A SecureStore observability

### Lessons from this session (additional)
1. **Schema overload is everywhere.** Found three instances of the same anti-pattern in one session: `store_staff.store_id` (branch_id) vs `orders.store_id` (merchant_id); `orders.store_id` FK targets `Store.id` not `merchants.id`; `merchant_branches.id` vs `merchants.id` overlap for single-store merchants. Lesson: when chasing FK / RLS bugs, ALWAYS confirm the target table and the semantic meaning of the column, never assume.
2. **Audit triggers EXPLICITLY.** The audit agent skipped pg_trigger inspection ("out of scope"). We hit a pre-existing trigger (`sync_merchant_data_robust`) only by accident during live-fire test. Lesson: when designing new triggers, always enumerate existing triggers on related tables first.
3. **Service-role context kills `auth.uid()` in triggers.** Triggers fired from Prisma/server-side inserts CANNOT use `auth.uid()` — it returns NULL. Must derive user identity from `NEW.*` columns. This is a non-obvious gotcha.
4. **Don't bundle even tightly-coupled changes.** Trigger 1 + Trigger 2 work together but were installed and verified separately. Made it possible to confirm each step worked before proceeding.
5. **"This is urgent" doesn't mean skip the workflow protocol.** Even under urgency, ran each step (preview, schema verify, apply, verify) per the rules. Caught the phone UNIQUE constraint, caught the pre-existing trigger, caught the FK target mismatch — each would have blocked or caused regression if rushed.

### Open threads at session end (snapshot — see `forlater.md` for full queue)
- [ ] **New "Order Sync Failed: Network request failed" report** (`pay_Stt2klnzcwRdw0`, 11:34 IST today, Android) — different error class from Varsha's FK violation. Details requested from team. Likely client-side network or API endpoint reachability issue. Don't conflate with Varsha's bug.
- [ ] **Phase 2B + 2C (signout fix)** waiting on in-the-wild SecureStore logs
- [ ] **OTP cache bug in Ready tab** (forlater #11)
- [ ] **Refund decision** for stranded Varsha bangles payments (`pay_StrS3Vuy4GpJ5X`, `pay_StrZufyn0mdw1d`, plus older — business call)
- [ ] **Realtime gap on merchant Pending/Processing tabs** (forlater #2)
- [ ] **Cosmetic data cleanup:** 6 merchants with null `Store.merchant_id`, "Security Test Store" leftover, "Test City" / "Test City 1774176523" entries in City table
- [ ] **Phone format inconsistency in `merchants`** — most are 10-digit (`9182369196`), one is with-prefix (`919959777027` for Freshly). Worth normalizing.
- [ ] **Test fresh signup end-to-end** to confirm Trigger 1 + Trigger 2 fire correctly in real life (not just simulation)

---

# Session 2026-06-09 → 2026-06-10 — Coupon Foolproof Phases 1-5 + hot-fixes (marathon)

## Headline
Coupon-foolproof Phases 1-5 are code-complete and audited. Phases 1-3 + four hot-fix waves are LIVE on EB. Phase 4 (consumer checkout integration) and Phase 5 (multi-store allocation) are committed on PR #2, audited three+two times respectively, all blockers closed — **Phase 5 EB deploy is pending Pranav's go**.

## Deploy timeline (EB `pas-api-prod-v2`)
| Version | Contents |
|---|---|
| `app-260609_112931383837` | Phases 1+2+3A backend (+ COUPON_VALIDATION_SECRET set) |
| `app-260609_143434212572` | Phase 2J soft-auth hot-fix (+ REQUIRE_ORDERS_AUTH=false) |
| `app-260609_145802394098` | Phase 2K — 5 hot-fixes from PR #1 adversarial review |
| `app-260609_160632632075` | Phase 2L — server-side price reconciliation (bleed #11) |
| (pending Pranav go) | Phase 5 + audit fixes (`7b07df82` working tree) |

## DB migrations applied to prod Supabase
- `20260608120000_coupon_extensions`, `…130000_audit_log`, `…140000_order_coupon_fields` (FK TEXT fix), `…150000_redemption_ledger_fields` (Phase 1)
- 9 historical drift migrations resolved via `migrate resolve --applied` after read-only verification (`scripts/verify_migration_drift.ts`)
- `20260609170000_cart_items_store_product_id` (Phase 4 fix C1)
- `20260609220000_phase5_coupon_redemption_cart_fingerprint` (Phase 5A — cart_fingerprint + partial unique)

## Git/PR state
- **PR #1 MERGED to main** (`00d36579`): Phases 1+2+3, mobile catch-up, 2J, 2K. Vercel auto-deployed admin-web.
- **PR #2 OPEN** (`coupon-foolproof-phase4-2026-06-09`): `342b78a9` 2L → `e4cf981c` Phase 4 → `ae51a2fb` 9 audit blockers → `4f099622` D2-pickup + 5 → `3e2a484d` finalTotal cleanup → `66ef7708` Phase 5 → `7a3611c9` 5 audit blockers → `7b07df82` R1/R2/R3 hardening.

## Live incident (resolved)
Phase 2's `requireUser` hard-cut on POST /orders + PATCH /order-requests 401'd every pre-OTA consumer install (main's app sends no Authorization header). Caught by sanity-check after PR #1 review; fixed same hour with Phase 2J soft-auth (`softRequireUser` + REQUIRE_ORDERS_AUTH flag + Sentry rollout counter). Verified by prod curl before/after.

## Adversarial audit trail (Workflow tool, 5-reviewer panels)
1. **PR #1 pre-merge**: 23 findings, 6 high → Phase 2K fixed 5 + soft-auth; mediums queued.
2. **Phase 4 audit**: 9 blockers (incl. dead pipeline — no Apply Coupon entry point; dining charge mismatch) → all fixed in `ae51a2fb`.
3. **Phase 4 re-audit**: D2-pickup still open (acceptedRequests strip storeProductId) + D1 rapid-tap regression → fixed in `4f099622`.
4. **Phase 4 third audit**: clean (approve-with-caveats, 0 blockers) after `3e2a484d`.
5. **Phase 5 audit**: 5 money blockers (fingerprint replay; rejected-store full discount; negative slice; client/server split drift; concurrent-cancel ledger corruption) → fixed in `7a3611c9`.
6. **Phase 5 re-audit**: approve-with-caveats, 0 blockers, "safe to deploy yes". Residuals R1/R2/R3 hardened in `7b07df82`; R4/R5/R6 queued in forlater.md.

## Key decisions (Pranav)
- Option A (fix-everything-before-Phase-5) over revert; "no temporary patches / no bleeds" is the standing standard.
- Phase 5 Q1-Q5: per-store minOrder REJECT; store-scoped coupons reject multi-store; single-store keeps legacy ledger path; one discount line in UI; proportional partial reversal on cancel.
- Lock overrides granted: CartContext (L2), CheckoutScreen (L6, L7), DiningCheckoutScreen (L6), CartScreen (L2).
- CLAUDE.md updated: Vercel = git auto-deploy (never local CLI); EB = chained setenv;deploy.

## Errors/learnings (≥2 attempts — ERRORS.md candidates)
- `git add apps/api/dist/index.js` always prints the gitignore warning and exits 1, but the tracked file DOES stage. Pattern: stage, ignore exit code, verify `git diff --cached --stat`, commit separately.
- Prisma interactive transactions: a caught P2002 still poisons the Postgres tx — use raw `INSERT … ON CONFLICT DO NOTHING RETURNING` instead of catch-and-continue.
- Workflow agents audit ONLY the commit diff unless told to read surrounding files — the "dead pipeline" Phase 4 blocker came from me not checking whether the new flow was reachable.

## Open threads at session end
- **Phase 5 EB deploy** — awaiting Pranav's explicit go (code at `7b07df82`, tsc clean, dist built).
- **Consumer-app EAS OTA** from PR #2 branch — Pranav's call after deploy.
- **Flag flips** (REQUIRE_ORDERS_AUTH, REQUIRE_COUPON_TOKEN) — gated on OTA propagation + Sentry counters (see forlater.md).
- **Phase 6** (merchant surfacing), **Phase 7** (settlement — Pranav wants discussion first), **Phase 8** (verification/rollout).
- forlater.md gained a consolidated "Coupon Foolproof — deferred audit findings" section (2026-06-10).

---

## Session: June 10-11, 2026 (night) — Phase 6 close-out → Phase 7 build + deploy

### Timeline

#### Phase 7 design locked (Pranav Q1-Q7 + FQ answers)
Weekly IST cycles · commission per category/tier from Commissions.pdf (rates = admin-editable data, `provisional` flags for FQ-1 5%-vs-7% conflict + FQ-2 blank F&B tiers) · eligibility COMPLETED+RETURN_REJECTED · same-cycle PLATFORM-coupon reimbursement · manual mark-paid w/ UTR until payout vendor (7b) · next-cycle clawback line items · anomaly hold + server-side Razorpay payment verification as settlement prerequisite. Founder-shareable doc: `docs/phase7-settlement-architecture.html` (opened for Pranav via `open`).

#### Built + applied (prod DB): 2 migrations
- `20260610170000_phase7_settlement_schema` — commission_rules (37 seed rows, 23 provisional), merchant_settlement_profiles, settlement_cycles (unique merchant+period), settlement_lines (partial unique SALE-per-order = settle-once invariant).
- `20260610180000_phase7_payment_verification` — orders.payment_verified/payment_verification_note + partial index.

#### Backend (commit 79233db7, +1451 lines)
- `settlement.service.ts` (NEW): IST week math, resolveRule (most-specific category/orderType/tier), closeSettlementCycles (roll-forward from PHASE7_EPOCH 2026-06-01, holds for unverified/no-profile/no-rule, per-merchant tx, totals recomputed from actual lines), detectClawback.
- `scheduled-jobs.ts`: verifyPendingPayments (Razorpay captured + amount coherence), sweepOrphanedPayments (strict attribution, CRON_DRY_RUN), Mon 02:00 IST close cron.
- `index.ts`: 7B payment-verification block in POST /orders (PAYMENT_NOT_VERIFIED 400 / HELD on overrun), consumer payment notes, 3 detectClawback hooks, 9 settlement endpoints (admin close/list/detail/mark-paid/commission-rules/profiles + GET /merchant/settlements).

#### Deploy + incident-fix (commit c5649c2f)
First EB deploy smoke caught settlement endpoints returning 404 — block was registered AFTER the Express 404 catch-all (dead routes). Moved above the catch-all, rebuilt, redeployed. Verified: /health 200, settlement routes 401 (auth-gated), POST /orders soft-auth intact, EB Ok/100% 2xx. `CRON_DRY_RUN=true` set for orphan-sweep's first 24h.

#### 7E admin UI (commit 98a13178)
`settlementService.ts` (NEW) + full `SettlementsManager.tsx` rewrite (was placeholder): cycle table w/ status filter + KPI strip, line-level drill-down, mark-paid dialog (UTR required), "Close last week" button, commission-rules editor (saving clears provisional). vite build clean; 0 new tsc errors (34 pre-existing).

#### 7F merchant UI (commit cddf441f)
`useSettlements.ts` (NEW hook, authHeaders pattern) + Weekly Settlements section on Earnings: per-week cards, PAID/PROCESSING chips, tap-to-expand breakdown, paid date. tsc 0 errors. Rides next merchant OTA.

#### 7G in progress
Adversarial audit workflow `wf_b259e841-f0e` running (5 lenses: money-math, concurrency/SQL, business rules, cross-file, end-to-end + hostile edges; blocker/high findings adversarially verified before synthesis). Next: fix round → dry-run cycle close vs prod (nothing marked paid).

### Open threads
- 7G results + fixes + prod dry-run close.
- CRON_DRY_RUN flip back to live after 24h clean observation (set 2026-06-10 ~22:00 UTC).
- PR #2 still open; Vercel admin UI ships on merge to main; merchant 7F + consumer Phase 4/5 ride OTAs (Pranav's call).
- Founder/CA: FQ-1, FQ-2 (provisional rates), FQ-6 (GST/TCS — share HTML with CA).

#### 7G complete (2026-06-11 ~04:30 IST)
Audit workflow `wf_b259e841-f0e` (27 agents): 49 confirmed findings (3 blockers, 16 high, 14 med, 16 low), 2 refuted. All blockers + highs fixed in commit `04734624` + migration `20260611010000_phase7_hardening` (applied + verified on prod): seed rules backdated to IST epoch; verification window now epoch-wide + close-time drain + admin override endpoint; eligibility extended to EXCHANGE_APPROVED/REJECTED + RETURN_APPROVED partial returns (SALE + same-cycle offset, symmetric with post-settlement refunds); atomic clawback claim (UPDATE..WHERE cycle_id IS NULL RETURNING) for ALL merchants incl. zero-sale weeks; coupon-reimbursement partial unique + landed-SALE gating; per-merchant failure isolation; in-tx revalidation; commission-base coherence guard; heldOrderCount real; legacy-refund clawback hook; Merchants profile tab in admin. EB deploy + smoke clean. **Prod dry-run**: 12 epoch orders all payment-verified; close held 11 no-profile, created 0 cycles 0 lines (fail-closed as designed). Deferred mediums/lows → forlater.md. NEXT HUMAN STEP: assign commission categories (Merchants tab) before the Mon 2026-06-15 02:00 IST close; decide CRON_DRY_RUN flip-back after 24h.

#### 2026-06-11 post-7G — PR #2 merge + FQ-1 resolution
- **PR #2 squash-merged to main** (`43abec8f`) — branch deleted. Vercel rebuilding pas-admin-web from main; 7E Settlements UI (incl. Merchants tab) goes live on next build.
- **FQ-1 resolved (founder decision 2026-06-11)**: 6 categories backed by `commission_rules` flipped 5% → 7% non-provisional via `scripts/resolve_fq1.ts` (audit-logged): Beauty & personal care, Electronics and accessories, Fashion and apparel, Home and lifestyle, Pet care and supplies, Sports and fitness. Verified: 17 provisional rows remain (1 Stationery sub-category split, 16 F&B tier-3-5/NULL — FQ-2, separate decision).
- Next: founder assigns commission categories in Finance → Settlements → Merchants tab before Mon 2026-06-15 02:00 IST cron close.

#### 2026-06-13 — Phase 8 security hardening (items 1 + 2)
- Verified the June-6 "verify-before-complete" items against prod (read-only sweep): #4 timings save = already FIXED; #14b/#14d test merchants/Teja = clean; SURFACED a bigger issue — RLS DISABLED on User + order_items + 5 sensitive tables.
- **Item 1 (DONE, applied to prod, PR #3)**: RLS lockdown — User (dropped "Allow public read for debug", self_read/self_update, column-locked role/isAdmin/status), order_items (select_own), + 5 defense-in-depth tables. First migration's column REVOKE was a no-op (Postgres column-grant subtlety); corrective migration 030000 fixed it (REVOKE table-level + GRANT name/email/notification_preferences/updatedAt). All 7 verify checks pass.
- **Item 2 (backend + app routing DONE; DB lockdown GATED)**: merchant_branches writes can't be RLS-tightened (merchant auth is phone+store_staff based, can't express in RLS; app writes directly). Pranav chose "route via API." Built POST/PUT/DELETE /merchant/branches (userCanManageMerchant/userCanManageBranchFull/isPlatformAdmin), deployed. Routed ALL writes off direct supabase-js: merchant-app (services/branches.ts, branches.tsx, settings/index.tsx, StoreContext toggleStoreStatus+updateStoreDetails) + admin-web (useMerchants). Exhaustive grep: 0 direct writes remain. Lockdown SQL staged at scripts/phase8_branch_lockdown.STAGED.sql — GATED on merchant OTA propagation.
- Branch PR #3 (phase8-rls-lockdown-2026-06-11): commits through a1cac38d. API redeployed to EB. tsc clean across all 3 apps.

#### 2026-06-13 — item #11 OTP modal reset (PR #4)
Merchant OTPVerificationModal stays mounted in orders.tsx (toggled via `visible`), so otp/error state leaked across orders — the previous order's PIN pre-filled the next, a safety risk (Verify against wrong order). Fixed with a useEffect keyed on (visible, orderId) that clears otp/error/loading on each open. Self-contained, tsc 0. Branch fix/merchant-otp-modal-reset → PR #4 (off main). Rides next merchant OTA (batched with pending bills/OTAs). bookings.tsx OTP input already resets correctly (not affected).

#### 2026-06-14 — Merchant e-Sign V1 (drawn signature) — BUILT + ROLLED OUT
Replaced the stubbed Aadhaar/Digio eSign with a free on-screen **drawn signature** + personalized signed PDF + server-side consent record. Phases 0.4/0.2/0.3/1/2/3/4 built; merchant-app + api tsc clean, admin-web vite build clean.
- **merchant-app:** new `src/screens/signup/agreements/` (content types + standardBody + restaurantBody [verbatim from founder PDFs via pdftotext] + registry/`verticalToAgreement` + `buildAgreementHtml` + RN `AgreementDocumentView` + `SignaturePad` [PanResponder→react-native-svg] + `services/signAgreement`). Rebuilt `steps/StepAgreements.tsx`: scroll-to-end gate → 3 checkboxes → draw signature → expo-print PDF → upload to `merchant-docs` → POST consent. Added `react-native-svg@15.12.1` (native → build). Version 1.2.4→1.2.5.
- **api:** `MerchantConsent` model + `POST /merchant-signup/consent` (requireUser, stamps IP+SHA-256) + `GET /admin/merchants/:id/consent` (requireAdmin).
- **admin-web:** `KYCQueue.tsx` "Legal & Signature" panel (fetches consent via API; signed-PDF link via createSignedUrl on merchant-docs).
- **Routing (locked w/ Pranav):** Restaurants & Cafes + Bakeries → restaurant; Grocery → grocery; Meat & Seafood + retail → other-stores. **Bakery → premium (₹2,999)** so the Restaurant agreement fee matches.
- **ROLLOUT (all 2026-06-14):** (1) DB — applied `merchant_consents` + `Vertical.isPremium=true` (Bakeries) to PROD via `prisma db execute` (verified: table exists, 0 rows, anon SELECT=false, bakery premium live). (2) API — `npm run build` + `eb deploy` → `app-260614_143955354510`, Ready/Green; `https://api.pickatstore.io/health`=200, both endpoints 401-gated, `/verticals` bakery isPremium=true. (3) Native — merchant 1.2.5 queued on EAS (Android c3c10c0e, iOS 8dde3396). (4) Admin-web — committed `196e425e`, pushed to **PR #5** (preview auto-builds; **prod deploy on merging PR #5**).
- **Notes:** signup.tsx (@locked) NOT touched — consent persists at sign-time via the dedicated endpoint. IP+docHash server-authoritative (consent record + admin, not client PDF). Privacy/Terms remain external links. Re-sign creates a new consent row. Deferred (forlater): agreement-vs-admin commission alignment ("leave independent"); Aadhaar eSign = future upgrade (#33). Step order confirmed Identity→Stores→KYC→**Agreements**→Subscription→Review (KYC before signing ✓).

#### 2026-06-14 (cont.) — Admin login 500 fix + KYC display fixes (Bucket 1 LIVE)
- **Login 500 ("Send Code") — ROOT CAUSE was the LOCAL dev proxy, not prod.** Systematic debug ruled out prod: /auth/send-otp fine (adminAllowlist→403, otpVerification.create works, Wati failures →502 not 500). User was on localhost:3001 dev server whose `/api` proxy targets `http://localhost:3000` (no API running there) → Vite proxy ECONNREFUSED → 500. Fix: made vite.config.mts proxy target env-overridable (`VITE_API_PROXY`); restarted dev server with `VITE_API_PROXY=https://api.pickatstore.io`. Verified localhost:3001/api/health=200. **Production login was never broken.** (vite.config.mts change is LOCAL/uncommitted.)
- **Bucket 1 — merchant-signup display fixes — BUILT + DEPLOYED + LIVE:**
  - API `GET /admin/merchants/:id` (Prisma + Vertical join) → verticalName, designation, bankAccounts, branches, operatingHours/hasBranches. Deployed `app-260614_153739609407`. (First `eb deploy` hit "Must be Ready" — env was mid managed-platform-update; auto-recovered via a wait-then-redeploy background job per ERRORS.md.) Verified: endpoint 401-gated, /health 200.
  - admin-web KYCQueue: phantom `category` → real vertical name; new "Signup Details" panel (designation, store hours, branches, bank accounts); needs_info merchants surfaced in queue + added to TS type. **PR #6 merged → main** → Vercel prod.
- **Bucket 2 (partial):** coupon brand fonts (Hanken Grotesk + Space Mono) added to admin index.html — UNCOMMITTED, ships in next admin merge.
- **Bucket 4 scoped:** `docs/admin-founder-gated-features-2026-06-14.html` (payout vendor+formula, Global Config, dispute queue, Wati inbox, wallet/tags, analytics depth) — decisions needed.
- **PAUSED by Pranav (to review):** Bucket 2 rest (?phone= filter, customers load-more, audit-log coverage) + Bucket 3 (home KPI endpoints `/admin/stats/*`). Tasks #64, #65 pending. Changelog: `docs/admin-dashboard-changes-and-pending-2026-06-14.html`. Dev server still running at localhost:3001 → prod API.
- **HOTFIX — admin login "infinite recursion detected in policy for relation User" (42P17).** Two `public."User"` RLS policies ("Super Admins can read all profiles" SELECT + "Super Admins manage all" ALL) ran `EXISTS (SELECT 1 FROM "User" WHERE id=auth.uid() AND role='SUPER_ADMIN')` — a self-subquery inside a User policy → recursion on every User read (admin login profile fetch). Was present since Phase-8 RLS lockdown, masked until the dev-proxy 500 was fixed. **Fix (applied to PROD via `prisma db execute`):** added `SECURITY DEFINER` `public.is_super_admin()` (bypasses RLS), recreated both policies to `USING (is_super_admin())`. Verified: policies now reference `is_super_admin()`; an authenticated-role self-read of `User` returns a row with no recursion error. Pure DB change, live immediately, no deploy. SQL: `docs/migrations-pending-2026-06-14-user-rls-recursion-fix.sql`.

#### 2026-06-14 (cont.) — Founder-gated admin features (4) — BUILT + DEPLOYED LIVE
One feature at a time, commit + deploy each (Pranav: "deploy each feature as we go"). All API endpoints verified 401-gated / public JSON ok; all admin PRs merged → Vercel.
1. **Analytics depth** — PR #7, api `app-260614_170922101267`. Compare-vs-previous ▲/▼ delta tiles + Top Products + Sales by Category + Sales by City. `GET /admin/analytics/breakdowns` (Prisma raw aggregations, tested on prod). Branch feat/admin-analytics-depth (f455f616).
2. **Refund/dispute queue** — PR #8, api `app-260614_205956475319`. `GET /admin/disputes` (stranded payment_verified=false + cancelled+paid not-yet-refunded) + `POST /admin/orders/:id/refund` (REAL Razorpay refund; only marks REFUNDED on confirm; idempotent on metadata.razorpayRefundId; audited). Refund state in order metadata (Order has NO refund cols — those are on OrderIssue). admin RefundsDisputes built out. Branch feat/admin-refund-dispute-queue (639592e9).
3. **Two-way Wati inbox** — PR #9, api `app-260614_210510253958`. `wati.service.sendSessionMessage` (free-text 24h window) + `GET /admin/wati/threads` + `GET /admin/wati/thread` + `POST /admin/wati/reply`. admin CustomerSupportInbox rebuilt → threaded two-pane + reply box. Branch feat/admin-wati-two-way-inbox (31c2554f).
4. **Global Config** — PR #10, api `app-260614_212353752072`. `platform_settings` table APPLIED to prod (service_radius_km=10, min_order_value=0, RLS-locked) + `GET/PATCH /admin/config` (PATCH=SUPER_ADMIN, audited) + `GET /config/public` → {serviceRadiusKm,minOrderValue}. admin GlobalConfig rebuilt from mock + Config tab un-hidden in AnalyticsHub. Branch feat/admin-global-config (7901e41c). Migration: docs/migrations-pending-2026-06-14-platform-settings.sql.
- **EB note:** every API deploy used the wait-for-Ready→deploy background pattern (the env keeps entering managed-platform-update windows). One deploy was classifier-blocked until Pranav explicitly authorized "deploy each feature."
- **FOLLOW-UPS:** (a) **Consumer wiring for Global Config — DONE** (PR #11, d62e7805). New `src/lib/platformConfig.ts` (fetches /config/public, cache + defaults); `useNearbyStores` radius now from serviceRadiusKm (was hardcoded 10km); `CartScreen` (LOCK OVERRIDE approved — layer 3, lock header refreshed) min-order gate (greys button + Alert + note), gating pickup AND dining (cart is the single funnel — the two @locked checkout screens were NOT touched). Behaviour-neutral today (radius 10km, min 0). consumer tsc 0. **Remaining: a consumer OTA to push it to devices** (can ride the next consumer release). Wati env confirmed SET on EB (WATI_API_ENDPOINT/TOKEN/AUTH_TEMPLATE) — two-way reply works live within the 24h window. Optional hardening: server-side min-order check in POST /orders (client gate is bypassable). (b) **Wati live replies** need WATI_API_ENDPOINT/TOKEN on EB + the customer inside the 24h window. (c) **Coupon fonts** (index.html) + **vite.config.mts** dev-proxy override remain LOCAL/uncommitted. (d) Still pending from before: Bucket 2 rest (?phone= filter, customers load-more, audit-log coverage), Bucket 3 (home KPI /admin/stats/*), payout/settlement surface (founder decision). See docs/admin-founder-gated-features + admin-dashboard-changes docs.
