# PAS — Session Log

> **Rule:** This file is updated every ~30 minutes during active work, and always before a session ends. It captures conversations, decisions, changes, and open threads so the next context window can pick up seamlessly.

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
