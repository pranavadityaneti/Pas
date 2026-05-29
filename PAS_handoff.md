# PAS App — Handoff Document
## Session Continuation: May 11–18, 2026

---

## WHO IS PRANAV

Pranav builds with **LLM coding agents** (previously Antigravity AI with Google Flash, now **Claude Code**). He is NOT a coder — he describes what he wants, the agent writes code, Claude reviews/directs.

**Critical workflow rule:** One issue at a time. Claude writes the exact task. Pranav runs it via the coding agent. Claude reviews before approving. The agent must NEVER ship code without explicit approval.

**Agent history:**
- **Antigravity AI (Google Flash 3)** — used through May 14. Requires extra-prescriptive prompts.
- **Claude Code** — primary agent as of May 15. Superpowers plugin installed.

---

## PROJECT OVERVIEW

**PAS (Pick At Store)** — monorepo with 3 apps:
- `apps/consumer-app` — Expo/React Native (customer-facing)
- `apps/merchant-app` — Expo/React Native (merchant tablet)
- `apps/api` — Express + Prisma + Supabase (backend)

**Stack:** Expo Go, Supabase (Postgres + Realtime + Auth), Prisma ORM, Razorpay payments.

**Two dining flows exist (both real, both needed):**
1. **BookingModal** = "Reserve a table" — slot-based booking with real-time availability, Razorpay deposit, OTP generated
2. **DiningCheckoutScreen** = "Pre-order food for dine-in" (full meal, goes through `order_requests` → merchant approval → payment → `orders` table)

Pickup flow also uses `order_requests` → approval → payment → `orders`.

---

## PRODUCTION DEPLOYMENT STATUS

**iOS builds (TestFlight — live on testers' devices):**
- Consumer app: v1.1.1 (build 15) — has `expo-updates` baked in, can receive OTA
- Merchant app: v1.2.3 — **Build 14 on TestFlight** (delivered May 16, has `expo-updates`). OTA pushed May 18 (`31bb3a0c`). Testers on build 14 receive OTA automatically. **Android:** Upload key reset approved, new key active May 20 7:01 AM UTC. AAB ready: `t4Sihp7VZBBHxuuoEHNzmt.aab` (versionCode 25).

**API:**
- Deployed to AWS Elastic Beanstalk: `pas-api-prod-v2` in `ap-south-1`
- URL: `https://api.pickatstore.io`
- Status: Healthy, all schema changes live

**OTA (Over-The-Air Updates) — configured and working:**
- First OTA update shipped May 15: update group `53820845-433b-44a7-af77-b6fab7fe9212`
- Consumer app can receive OTA on build 15+
- Merchant app CANNOT receive OTA until new build is installed
- Ship OTA: `cd apps/consumer-app && npx eas-cli update --branch production --message "description"`
- OTA covers: any `.ts`/`.tsx` file changes (JS only)
- OTA does NOT cover: new packages, app.json changes, permissions, SDK upgrades
- `runtimeVersion` policy is `appVersion` — OTA updates only go to matching app version

**Local Dev (Expo Go):**
- Merchant app: `exp://192.168.29.17:8082`
- Consumer app: `exp://192.168.29.17:8083`

---

## TEST DATA IDS

- **Pranav (merchant login):** `ed204d5d-539d-4e50-8b42-9c9de870e9e5`
- **Freshly (main branch):** merchant_id=`9143278d-444e-4ee9-b836-f31d5de62e41`, branch_id=`9143278d-444e-4ee9-b836-f31d5de62e41` (same value — data quirk)
- **Freshly Ravulapalem:** branch_id=`2f25e818-7aff-45c2-baca-31a6322232c4`
- **Freshly Vadapalli:** branch_id=`c20b9f8f-4b98-419d-b7aa-01dac3d4c40e`
- **Freshly Foods:** merchant_id=`57f2aa5a-1210-42b6-ab3d-57ab6c396769`
- **Classic Cafe:** merchant_id=`9c35148d-d9ce-4836-90f8-091b165d1e62`, branch_id=`a39cbfb3-abef-4eed-837f-98ec161a3c86`
- **Restaurants & Cafes vertical:** `4e8633b4-81e0-4ecd-b182-2efdad903987`

**store_staff mapping:**
- Pranav (owner) → `store_id: 9143278d` (Freshly main)
- Satyam (manager) → `store_id: 3eb3939c` (Freshly Vadapalli)

---

## CURRENT STATE — WHERE THE WORK STANDS

### ✅ COMPLETED (May 16–18 sessions)

---

#### 1. Slot-Based Table Booking System (Full Stack)

**New Prisma model: `TableBooking`** (schema.prisma)
- Fields: branchId, userId, slotDate, slotTime, guestsCount, bookingFee, status, paymentId, razorpayOrderId, otp, orderId, customerName, customerPhone
- Indexes: `[branchId, slotDate, slotTime]`, `[userId]`, `[branchId, status, slotDate]`
- Mapped to `table_bookings` table

**New API routes: `apps/api/src/routes/bookings.ts`** (NEW)
- `GET /bookings/availability?branchId=&date=` — returns slot availability (based on `slot_config` JSONB on merchant_branches)
- `POST /bookings/create` — creates a booking with Razorpay order, generates OTP
- `GET /bookings/branch/:branchId` — lists today's bookings for merchant view
- `PATCH /bookings/:id/status` — update booking status (CONFIRMED/COMPLETED/CANCELLED/NO_SHOW)
- Registered on API at `/bookings` prefix

**BookingModal.tsx** (REWRITTEN — consumer app)
- Removed DateTimePicker (native iOS/Android pickers). Replaced with:
  - 7-day horizontal date chips (Today, Tomorrow, Mon, Tue, etc.)
  - Slot grid from `useSlotAvailability` hook showing available/full slots
- Slot selection replaces manual time entry
- Only branches with `service_table_booking: true` are fetched
- Booking fee: ₹25 per 2 guests, capped at ₹100

**useSlotAvailability.ts** (NEW — consumer app hook)
- Calls `GET /bookings/availability` API
- Realtime subscription on `table_bookings` table for live slot updates
- Returns `{ slots, loading, available, refresh }`

**Merchant slot-config.tsx** (NEW — merchant app)
- `apps/merchant-app/app/(main)/settings/slot-config.tsx`
- UI for merchants to configure: time slots, capacity per slot
- Saves to `slot_config` JSONB column on `merchant_branches`

**Merchant bookings.tsx** (NEW — merchant app)
- `apps/merchant-app/app/(main)/settings/bookings.tsx`
- Today's bookings list: shows guest name, time, guests, OTP, status
- Actions: mark as Completed, No Show, Cancel

**Settings index.tsx** — added "Table Booking Slots" and "Today's Bookings" menu items

---

#### 2. Service Modes (Merchant Timings Screen)

**timings.tsx** — added Service Modes card with 3 toggles:
- **Pickup** — `service_pickup` (default: true)
- **Dine-in** — `service_dinein` (default: true)
- **Table Booking** — `service_table_booking` (default: false)
- Persisted to `merchant_branches` via `updateStoreDetails`

**Bug Fix (May 18):** `isDirty` computed boolean was only checking operating hours and prep time — service mode toggles were excluded. If merchant only toggled a service mode, Save button stayed disabled and changes never persisted. Fixed by adding service mode comparisons to `isDirty` (3 lines before `return false`).

**Prisma schema** — added to `MerchantBranch` model:
- `servicePickup`, `serviceDinein`, `serviceTableBooking` (Boolean columns)
- `slotConfig` (JSONB, default `[]`)

**StoreContext.tsx** — major refactor:
- Added `branchDataMap` keyed by branch ID (operating_hours, prep_time, service modes, slot_config)
- `store` derived object now includes `service_pickup`, `service_dinein`, `service_table_booking`, `slot_config`
- `toggleStoreStatus` actually writes to Supabase now (was no-op before)
- Optimistic local state update on `updateStoreDetails`

---

#### 3. Navigation Architecture Restructure

**MainTabNavigator.tsx** — converted flat tabs to nested stacks:
- `HomeStackNavigator`: HomeMain → Storefront → CategoryDetail → SpotlightDetail
- `PickupStackNavigator`: PickupMain → Storefront → CategoryDetail
- `DiningStackNavigator`: DiningMain → Storefront → SpotlightDetail
- `CartStackNavigator`: CartMain → Checkout → DiningCheckout (unchanged)
- Added `backBehavior="history"` to Tab.Navigator
- Storefront/CategoryDetail/SpotlightDetail moved FROM RootNavigator INTO tab stacks

**RootNavigator.tsx** — removed Storefront, CategoryDetail, SpotlightDetail screens (now in tab stacks)

**types.ts** — added `highlightProductId?: string` and `orderMode?: 'pickup' | 'dining'` to Storefront params

**FloatingCartBand.tsx** — navigation changed to `Main > Cart > CartMain` nested path

---

#### 4. Universal Search (HomeScreen)

**HomeScreen.tsx** — added global search:
- When `searchText` is non-empty, shows `SearchResults` component with store cards
- Uses `useGlobalSearch` hook (no vertical filter = cross-category search)
- Store cards with image, name, vertical, distance — tap navigates to Storefront

**SearchResults.tsx** (NEW) — reusable search results component with customizable store card renderer

**useGlobalSearch.ts** — added `service_table_booking` to `SearchResultStore` interface

---

#### 5. StorefrontScreen Major Enhancements

**StorefrontScreen.tsx** — extensive changes:
- **Cached restaurant state**: `cachedRestaurant` prevents flash to "not found" during useStores reload
- **Direct branch fallback**: if useStores doesn't have the branch, fetches directly from Supabase
- **Live status subscription**: Realtime channel `storefront-live-{storeId}` watches for operating_hours/is_active changes
- **Real-time open/closed status**: `isStoreOpen` computed from live data + `checkIsOpen()`
- **Animated offline banner**: Pulsing opacity animation when store is closed
- **Highlight product**: `highlightProductId` from route params scrolls to and highlights a specific product
- **FilterSortModal**: imported and integrated for product-level filtering
- **Store image resolution**: uses `getStoreImageUrl` utility (branch photos → merchant photos → fallback)
- **orderMode-aware cart** (May 18): reads `route.params.orderMode` to determine cart item `isDining`. From Pickup tab → `isDining: false`; from Dining tab → `isDining: true`; from Home/search → falls back to vertical-based classification.

---

#### 6. Dining-Specific Fields (Full Stack)

**Prisma schema** additions to `Merchant` model:
- `cuisines String[]`, `isVeg Boolean`, `restaurantType String?`

**Prisma schema** additions to `MerchantBranch` model:
- `cuisines String[]`, `isVeg Boolean?`, `restaurantType String?`, `branchPhotos String[]`

**dataTransformer.ts** — major updates:
- `TransformedStore` interface: added `storePhotos`, `cuisines`, `serviceTableBooking`, `servicePickup`, `serviceDinein`
- `checkIsOpen()`: fixed field names (`open_time`→`open`, `close_time`→`close`, `has_lunch_break`→`hasLunchBreak`, `lunch_start`→`lunchStart`). Fixed day mapping (JS day 0=Sun → store day 6=Sun using `(jsDay + 6) % 7`). Added `__DEV__` warning when `operating_hours` is null (defaults to open).
- `transformStoreData()`: branch-level photos with merchant fallback. Branch-level cuisines/isVeg/restaurantType with merchant fallback. Uses `getStoreImageUrl` utility. Maps `service_pickup` and `service_dinein` from row (defaults to `true`).

**storageUrl.ts** (NEW) — centralized Supabase storage URL helper:
- `getStoreImageUrl(path)` — handles null, full URLs, and storage paths
- `getStoreImageUrls(paths)` — batch version

**DiningScreen.tsx** — comprehensive updates:
- Cuisine filters expanded: added Continental, Italian, Multi-Cuisine
- Veg filter now 3-way: all / veg / nonveg
- Cuisine filtering now uses `cuisines` array field (was TODO/commented out before)
- `checkIsOpen()` applied to search results (was only checking `is_active` before)
- Offline overlays on restaurant cards (both horizontal and full-width)
- Book button only shows when `restaurant.serviceTableBooking` is true
- Loading state only shows spinner when `diningStores.length === 0` (prevents blank flash on refetch)
- Quick Service added to quickService filter
- Store images use `getStoreImageUrl()`
- **Fix (May 18):** All Storefront navigation calls now pass `orderMode: 'dining'` (4 places)

**useStores.ts** — expanded select query:
- Now fetches `cuisines, is_veg, restaurant_type, branch_photos, service_table_booking, service_pickup, service_dinein` from branches
- Fetches `cuisines, is_veg, restaurant_type, rating` from merchants
- Unique Realtime channel IDs via `useRef`
- **Fix (May 18):** `diningStores`/`pickupStores` filter changed from vertical-based (`s.isDining` / `!s.isDining`) to service-mode-based (`s.serviceDinein` / `s.servicePickup`). A store with both modes enabled now appears on BOTH tabs. Defaults (`true`/`true`) maintain backward compatibility.

**useNearbyStores.ts** — unique Realtime channel ID via `useRef` (fixes conflicts)

---

#### 7. Merchant Multi-Branch & Context Selection

**login.tsx** (merchant app) — branch-level context selection:
- Context selection modal now shows individual branches grouped by merchant
- `handleSelectBranch(context, branchId)` replaces `handleSelectContext(context)`
- Saves `active_branch_id` to AsyncStorage
- Fetches ALL branches for ALL merchants where user is owner (not just matched branches)

**StoreContext.tsx** — exports `merchantId`, per-branch data map

**staff.tsx** (merchant app) — multi-branch staff management:
- Fetches ALL branches for the merchant (not just active branch)
- Staff cards show which branch they belong to (`branchName`)
- Filter staff to only show those assigned to branches under current merchant

**branches.tsx** (merchant app) — dining fields + branch photos:
- Branch form now includes: cuisines (chip picker), isVeg toggle, restaurantType picker
- Branch photo upload (up to 5 per branch) with Supabase storage
- Dining-specific fields only shown when merchant's vertical `isDining` is true
- Uses `merchantId` from StoreContext (not `user.id`)

**store-details.tsx** (merchant app) — dining fields:
- Fetches `cuisines, is_veg, restaurant_type` from merchants table
- Shows Restaurant Type chips, Cuisine multi-select chips, Pure Veg toggle (only when `isDining`)
- Saves to merchants table on update

---

#### 8. Staff Route Authorization Fix

**staff.ts** (API) — create-manager authorization revamped:
- Old: only checked `store_staff` for owner role on exact `storeId`
- New: Two-tier auth: (a) root merchant owner check via `merchant_branches.merchant_id`, (b) fallback: owner-level staff of ANY sibling branch
- Phone normalization for existing user lookup: strips country codes, tries +91/91/raw variants
- Uses `supabaseAdmin.auth.admin.listUsers()` to find existing users by phone
- Idempotent store_staff insert: checks for existing row before inserting

---

#### 9. Server-Side Store Status Gate

**API index.ts** — order rejection for offline/closed stores:
- `POST /orders`: Server-side check of `isActive`, operating hours, lunch break before accepting orders
- `POST /order-requests`: Check `isActive` for each branch in the request array
- Returns structured errors: `STORE_OFFLINE`, `STORE_CLOSED_TODAY`, `STORE_CLOSED_HOURS`, `STORE_LUNCH_BREAK`
- `POST /order-requests`: switched from `supabase.auth.getUser` to `supabaseAdmin.auth.getUser` (service role)

**useOrderRequests.ts** (consumer app):
- Session refresh strategy: always calls `refreshSession()` before API calls (safer than expires_at math)
- Falls back to existing session if refresh fails
- Parses `STORE_OFFLINE` error from API response and shows user-friendly message

---

#### 10. Merchant Signup — Dining Fields & Branch Photos

**signup.tsx** (merchant app):
- Branch interface extended: `cuisines`, `isVeg`, `restaurantType`, `photos`
- Store state extended: `cuisines`, `isVeg`, `restaurantType`
- Branch photo upload during signup (per-branch, uploaded to `{userId}/branch_{idx}/photo_{idx}.jpg`)
- Payload sends cuisines/isVeg/restaurantType at both merchant and branch level

**API draft endpoint** (`/auth/merchant/draft`):
- Accepts `cuisines`, `isVeg`, `restaurantType` in payload → writes to merchants table
- Branch creation passes cuisines, is_veg, restaurant_type, branch_photos

---

#### 11. Smart Dynamic Filter System

**filterConfig.ts** (NEW) — category-aware filter visibility utility. Maps 10 verticals to which filter sections are visible.

**StoreFilterModal.tsx** (REWRITTEN) — visibility props (`showRatings`, `showDietary`, `showPriceRange`, `showSortOptions`), prep_time sort, GestureHandlerRootView fix, RangeSlider integration, distance chips 1/3/5/10 km.

**RangeSlider.tsx** (NEW) — dual-thumb price range slider with PanGesture.

**FilterSortModal.tsx** (NEW) — product-level filter/sort modal with GestureHandlerRootView.

**HomeFeedScreen.tsx**: Brand filtering enabled, dietary/ratings disabled, availableBrands fetch, brand-based filtering + prep_time sort. **Fix (May 18):** Storefront navigation now passes `orderMode: 'pickup'`.

**DiningScreen.tsx**: Filter icon + StoreFilterModal with dining config.

**CategoryDetailScreen.tsx**: Replaced inline modal with configured StoreFilterModal + dynamic filterConfig.

**useCategoryItems.ts**: Added `brand` to query and interface.

---

#### 12. Merchant Dashboard UI Update

**dashboard.tsx** — status toggle redesign:
- Replaced dropdown-style status badge with `Switch` component
- Header layout: greeting + store name on left, switch + notification bell on right
- Switch disabled during lunch break or closed today

---

#### 13. Earnings Branch Scoping

**useEarnings.ts** — scoped to active branch:
- Main store shows orders without branch_id or where branch_id matches merchant_id
- Specific branch shows only its own orders
- Realtime channel includes `activeStoreId` for unique subscription

---

#### 14. Cart Persistence on Login (Stale Closure Fix)

**CartContext.tsx** — `itemsRef = useRef<CartItem[]>(items)` tracks current items. Auth listener uses `itemsRef.current` instead of stale closure. Added continuous cloud sync useEffect.

---

#### 15. RLS CRUD Policies for Merchant Tables

**fix_rls_crud_policies.sql** (NEW) — INSERT/UPDATE/DELETE policies for `authenticated` role on StoreProduct, Product, Store tables. Executed on production.

---

#### 16. Merchant AddMenuProductModal Upsert Fix

**AddMenuProductModal.tsx** — pre-insert Product dedup check + `onConflict: 'branch_id,productId,variant'` on StoreProduct upsert.

---

#### 17. LocationContext Improvements

**LocationContext.tsx**:
- Failsafe timeout increased: 8s → 15s
- Manual selection validates coordinates before persisting
- `refreshLocation` respects `forceRefresh` parameter (clears manual selection)
- GPS accuracy downgraded: `High` → `Balanced` (faster fix)
- Priority 1 restore skips generic "Current Location" entries (only restores named addresses like "Home", "Work")

---

#### 18. TextInput Vertical Alignment Audit

Applied `textAlignVertical: 'center'` + `paddingVertical: 0` across 14 instances in 10 files: SupportScreen, AuthScreen (2), OffersScreen, CheckoutScreen (3), StorefrontScreen (2), GlobalHeader, TransactionalAuthModal (2), AddressModal, CategoryDetailScreen.

---

#### 19. GestureHandlerRootView Fix for Modals

Wrapped Modal children with `<GestureHandlerRootView>` in StoreFilterModal and FilterSortModal. Needed because Modal creates a new native view tree.

---

#### 20. Service Modes & Store Visibility Fix (May 18)

**Three bugs fixed in one coordinated change:**

**Bug 1 — Toggle persistence (Merchant):** `isDirty` in `timings.tsx` didn't include service mode state. Save button stayed disabled when only toggles changed → changes never hit DB. Fixed by adding 3 comparison lines for `servicePickup`, `serviceDinein`, `serviceTableBooking`.

**Bug 2 — Store "always active" (Consumer):** `checkIsOpen()` defaults to `true` when `operating_hours` is null. Root cause: merchant never successfully saved hours because of Bug 1. Added `__DEV__` console warning for visibility.

**Bug 3 — Cross-tab visibility (Consumer):** Store tab filtering was purely vertical-based (`isDining` / `!isDining`). A dining restaurant with Pickup enabled never appeared on Pickup tab. Fix:
- Added `servicePickup` and `serviceDinein` to `TransformedStore` interface + mapping
- Added `service_pickup, service_dinein` to Supabase SELECT query
- Changed filter: `diningStores` = `s.serviceDinein`, `pickupStores` = `s.servicePickup`
- A store with both modes enabled now appears on BOTH tabs

**Cart mode awareness (Consumer):** Added `orderMode` navigation param (`'pickup' | 'dining' | undefined`). HomeFeedScreen passes `'pickup'`, DiningScreen passes `'dining'`. StorefrontScreen reads it to set cart item `isDining` correctly regardless of store vertical.

**Files:** `timings.tsx`, `dataTransformer.ts`, `useStores.ts`, `types.ts`, `HomeFeedScreen.tsx`, `DiningScreen.tsx`, `StorefrontScreen.tsx`

---

#### 21. Offline Store Visibility on Pickup (PostGIS RPC Fix — May 18)

**Problem:** `get_nearby_stores` RPC had `AND mb.is_active = true`, so inactive stores were silently excluded from Pickup tab entirely. Dining tab didn't have this issue (uses `useStores()` directly, no PostGIS gate).

**Fix:** Removed `is_active = true` from the RPC. Inactive stores now returned with distance data. Client already had "Currently Offline" overlay — it just never rendered because the RPC excluded them.

**Files:** `apps/api/rewrite_get_nearby_stores.sql`, `apps/api/apply_new_rpc.js`
**Applied to production DB:** `node apply_new_rpc.js` — SUCCESS

---

#### 22. Store Status Gate — Client-Side Error Handling (Consumer)

**CheckoutScreen.tsx** — catches `STORE_OFFLINE`, `STORE_CLOSED_TODAY`, `STORE_CLOSED_HOURS`, `STORE_LUNCH_BREAK` errors from the server-side store status gate and surfaces them as "Store Unavailable" alerts with refund messaging. (Previously only `useOrderRequests.ts` parsed `STORE_OFFLINE`.)

**DiningCheckoutScreen.tsx** — same store status error handling added. Also: both Razorpay-related `supabase.auth.getUser()` calls replaced with `supabase.auth.getSession()` to avoid a known auth hang (ref: supabase.ts:43–54). Improved error handling/parsing throughout (try/catch around `orderRes.json()`, better error propagation).

---

#### 23. Keyboard & UX Fixes (Undocumented Until Now)

**AuthScreen.tsx** — `KeyboardAvoidingView` changed from hardcoded `behavior="padding"` to `Platform.OS === 'ios' ? 'padding' : 'height'` with `keyboardVerticalOffset` for iOS. Platform-specific keyboard fix.

**GlobalHeader.tsx** — Added X (clear) button on search input. Gray circular X appears when `searchText` is non-empty; tap clears text.

**profile.tsx (merchant)** — After successful profile save, now calls `await refreshUser()` to update UserContext immediately (was "minor cleanup" — actually a functional fix ensuring header reflects updated name without re-navigation).

---

#### 24. Signup Endpoint — Dynamic Vertical ID (API)

**`/auth/merchant/signup`** endpoint in `index.ts` — hardcoded `verticalId` fallback replaced with dynamic `payload.verticalId` lookup via Prisma `vertical.findUnique()` validation. Zod schema updated: `verticalId` is now a required UUID field (replaces old `category` string field). Named `GROCERY_FALLBACK` constant added.

---

### ✅ COMPLETED (May 15 session)

**Auth Token Refresh Fix:** `useOrderRequests.ts` + `BookingModal.tsx` — proactive JWT refresh.

**OTA Configured:** expo-updates installed in both apps. First OTA shipped.

**RLS Policy Migration (orders table):** Migrated to `store_staff.user_id = auth.uid()` pattern.

**Google Maps SDK:** Enabled Maps SDK for iOS and Android in Google Cloud Console.

**Merchant Profile Cleanup:** Removed mock OTP, phone read-only.

**Back-to-Home Cancel Dialog Fix:** `forceNav.current = true` in CheckoutScreen + DiningCheckoutScreen.

**Global Floating Cart Band:** `FloatingCartBand.tsx` renders across all screens.

**App Icon Updated:** Consumer app yellow background.

### ✅ COMPLETED (earlier sessions)

Table Booking API, Merchant Order Card Polish, Order Pipeline fixes, Schema Migrations.

### ⏳ NEEDS TESTING

- FloatingCartBand navigation from dining flow
- Merchant app new build (EAS → Transporter → TestFlight)
- Slot-based booking end-to-end (consumer → merchant view)
- **Service Modes & Store Visibility Fix (May 18):**
  - Toggle persistence: toggle Table Booking ON → Save → nav away → come back → stays ON
  - Dual-mode visibility: dining restaurant with `service_pickup: true` appears on BOTH tabs
  - Book button: dining tab restaurant with `service_table_booking: true` shows "Book"
  - Cart mode: open from Pickup → cart item `isDining: false`; from Dining → `isDining: true`
  - Operating hours: after merchant saves valid hours, store shows closed outside hours

### 🔴 KNOWN BUGS (not yet fixed)

- DiningCheckoutScreen TypeScript errors (3 compile-time)
- Store name duplication (branch_name = restaurant_name)
- Hardcoded `gstRate: 5` in useOrders.ts
- Hardcoded `prep_time_minutes: 15` in AddMenuProductModal
- Razorpay not opening on DiningCheckoutScreen "Pay & Confirm"
- Customer tax display shows ₹0 (YourOrdersScreen)
- API pre-existing TypeScript errors (3, harmless)

---

## DATABASE ARCHITECTURE NOTES

**Legacy vs Modern tables:**
- Legacy `"Store"` table — has `merchant_id` column, used by some Prisma code
- Modern `merchant_branches` — source of truth for branch data (operating_hours, service modes, slot_config)
- Modern `store_staff` — user→branch role mapping

**New table: `table_bookings`**
- Stores slot-based table reservations
- Indexed by `[branchId, slotDate, slotTime]` for availability queries
- Status: CONFIRMED → COMPLETED / CANCELLED / NO_SHOW

**New columns on `merchant_branches`:**
- `cuisines`, `is_veg`, `restaurant_type`, `branch_photos`
- `service_pickup`, `service_dinein`, `service_table_booking`
- `slot_config` (JSONB array of slot definitions)

**New columns on `merchants`:**
- `cuisines`, `is_veg`, `restaurant_type`

**RLS Policies:**
- `orders`: `store_staff.user_id = auth.uid()` (SELECT/UPDATE)
- `StoreProduct`, `Product`, `Store`: full CRUD for `authenticated` (broad — `USING (true)`)
- `order_requests`: unrestricted SELECT
- `table_bookings`: relies on API-level auth (no RLS policies yet)

**Operating Hours JSONB format:**
```json
{
  "days": [0, 1, 2, 3, 4, 5],
  "open": "09:00",
  "close": "21:00",
  "hasLunchBreak": true,
  "lunchStart": "13:00",
  "lunchEnd": "14:00"
}
```
Days: 0=Mon, 1=Tue, ..., 6=Sun (NOT JS day format where 0=Sun)

---

## NEW FILES CREATED (May 16–18)

| File | Purpose |
|------|---------|
| `consumer-app/src/utils/filterConfig.ts` | Category-aware filter visibility config |
| `consumer-app/src/utils/storageUrl.ts` | Supabase storage URL helper (getStoreImageUrl) |
| `consumer-app/src/components/RangeSlider.tsx` | Dual-thumb price range slider |
| `consumer-app/src/components/FilterSortModal.tsx` | Product-level filter/sort modal |
| `consumer-app/src/components/SearchResults.tsx` | Reusable search results renderer |
| `consumer-app/src/hooks/useSlotAvailability.ts` | Slot availability hook with realtime |
| `api/prisma/migrations/fix_rls_crud_policies.sql` | RLS CRUD policies for 3 tables |
| `api/src/routes/bookings.ts` | Table booking API routes |
| `merchant-app/app/(main)/settings/slot-config.tsx` | Slot capacity configuration screen |
| `merchant-app/app/(main)/settings/bookings.tsx` | Today's bookings management screen |

---

## FILES MODIFIED (May 16–18) — Consumer App

| File | What changed |
|------|-------------|
| `components/BookingModal.tsx` | REWRITTEN — slot-based booking with date chips + slot grid |
| `components/StoreFilterModal.tsx` | REWRITTEN — visibility props, conditional sections, RangeSlider |
| `components/FilterSortModal.tsx` | GestureHandlerRootView wrapper |
| `components/FloatingCartBand.tsx` | Nested navigation path |
| `components/GlobalHeader.tsx` | TextInput alignment + search + X clear button on search input |
| `components/AddressModal.tsx` | TextInput alignment |
| `components/TransactionalAuthModal.tsx` | TextInput alignment (2 inputs) |
| `context/CartContext.tsx` | Stale closure fix (itemsRef) + cloud sync |
| `context/LocationContext.tsx` | Failsafe timeout, coordinate validation, GPS accuracy, named-address priority |
| `hooks/useCategoryItems.ts` | Added brand to query/interface |
| `hooks/useGlobalSearch.ts` | Added service_table_booking to interface |
| `hooks/useNearbyStores.ts` | Unique realtime channel ID |
| `hooks/useStores.ts` | Expanded select (cuisines, photos, service flags), unique channel ID, service-mode-based tab filtering |
| `hooks/useOrderRequests.ts` | Always-refresh session strategy, STORE_OFFLINE error handling, JSON error body parsing |
| `navigation/MainTabNavigator.tsx` | Tab stacks (Home/Pickup/Dining each get nested stack), backBehavior="history" |
| `navigation/RootNavigator.tsx` | Removed Storefront/CategoryDetail/SpotlightDetail (moved to tab stacks) |
| `navigation/types.ts` | Added highlightProductId + orderMode to Storefront params |
| `screens/HomeScreen.tsx` | Universal search with SearchResults, cross-category |
| `screens/HomeFeedScreen.tsx` | Brand filtering, dynamic filter props, passes orderMode: 'pickup' |
| `screens/DiningScreen.tsx` | Cuisine filtering, veg 3-way, offline overlays, filter icon, service_table_booking gate, passes orderMode: 'dining' |
| `screens/CategoryDetailScreen.tsx` | StoreFilterModal + dynamic filterConfig, X clear button |
| `screens/StorefrontScreen.tsx` | Cached restaurant, live status, offline banner, FilterSortModal, branch photo fallback, orderMode-aware cart isDining |
| `screens/AuthScreen.tsx` | TextInput alignment + platform-specific KeyboardAvoidingView fix |
| `screens/CheckoutScreen.tsx` | TextInput alignment + STORE_OFFLINE/CLOSED error alerts |
| `screens/DiningCheckoutScreen.tsx` | getUser→getSession auth fix, STORE_OFFLINE/CLOSED error alerts, improved error parsing |
| `screens/OffersScreen.tsx` | TextInput alignment |
| `screens/SupportScreen.tsx` | TextInput alignment |
| `utils/dataTransformer.ts` | checkIsOpen field names fixed, day mapping fixed, branch photos, cuisines, storageUrl, servicePickup/serviceDinein fields, __DEV__ warning for null operating_hours |

## FILES MODIFIED (May 16–18) — Merchant App

| File | What changed |
|------|-------------|
| `app/(auth)/login.tsx` | Branch-level context selection, handleSelectBranch |
| `app/(auth)/signup.tsx` | Dining fields (cuisines, isVeg, restaurantType), branch photos upload |
| `app/(main)/dashboard.tsx` | Switch component for online/offline, header layout |
| `app/(main)/settings/index.tsx` | Added Table Booking Slots + Today's Bookings menu items |
| `app/(main)/settings/branches.tsx` | Dining fields, branch photo upload, isDining vertical check |
| `app/(main)/settings/store-details.tsx` | Dining fields (type, cuisines, veg toggle), isDining gate |
| `app/(main)/settings/staff.tsx` | Multi-branch staff listing with branch names |
| `app/(main)/settings/timings.tsx` | Service Modes card (pickup/dinein/table booking toggles), isDirty fix for service modes |
| `app/(main)/settings/profile.tsx` | refreshUser() after profile save (immediate UI update) |
| `src/components/AddMenuProductModal.tsx` | Product dedup + upsert onConflict |
| `src/context/StoreContext.tsx` | branchDataMap, service modes, toggleStoreStatus impl, owner branch discovery |
| `src/hooks/useEarnings.ts` | Branch-scoped earnings, realtime per-branch |

## FILES MODIFIED (May 16–18) — API

| File | What changed |
|------|-------------|
| `prisma/schema.prisma` | TableBooking model, Merchant cuisines/isVeg/restaurantType, MerchantBranch service modes + slot_config + dining fields |
| `src/index.ts` | Bookings router, server-side store status gate on /orders and /order-requests, supabaseAdmin for auth, draft endpoint dining fields, signup endpoint dynamic verticalId with Prisma validation |
| `src/routes/staff.ts` | Owner auth revamp (root owner + sibling owner), phone normalization, idempotent insert |
| `rewrite_get_nearby_stores.sql` | Removed is_active=true filter — inactive stores now returned (client handles offline overlay) |
| `apply_new_rpc.js` | Same RPC change (inline SQL copy), applied to production DB |

---

## KEY TECHNICAL PATTERNS & GOTCHAS

**Supabase RLS:** Always check INSERT/UPDATE/DELETE policies exist. StoreProduct/Product/Store have broad policies for now.

**React Native Modal + Gesture Handler:** Modal loses GestureHandlerRootView. Wrap children with `<GestureHandlerRootView style={{ flex: 1 }}>`.

**Stale Closures:** useEffect with `[]` deps captures initial values. Use `useRef` + sync effect to track current values.

**Supabase Upsert:** `onConflict` must match a real unique index. For composite: `'branch_id,productId,variant'`.

**Realtime Channel Names:** Must be unique per component instance. Use `useRef` with `Date.now() + Math.random()`.

**Operating Hours Day Mapping:** JS `getDay()` returns 0=Sun. Store format is 0=Mon. Convert: `(jsDay + 6) % 7`.

**checkIsOpen field names:** DB stores `open`/`close` (not `open_time`/`close_time`), `hasLunchBreak` (not `has_lunch_break`), `lunchStart`/`lunchEnd` (not `lunch_start`/`lunch_end`).

**Tab Navigation:** Storefront/CategoryDetail/SpotlightDetail are inside tab stacks, NOT the root stack. Navigate via tab → screen name.

**Store Images:** Use `getStoreImageUrl()` from storageUrl.ts. Branch photos take precedence over merchant photos.

---

## NEXT STEPS (priority order)

### Immediate

1. **Test slot-based booking end-to-end** — configure slots → consumer selects slot → payment → OTP → merchant views booking
2. **Submit merchant app new build** — EAS → Transporter → TestFlight
3. **Push consumer OTA** — lots of changes ready
4. **Fix DiningCheckoutScreen TypeScript errors** — lines 143 and 355
5. **Fix store name duplication** — branch_name = restaurant_name

### Soon

6. **Add RLS policies to table_bookings** — currently relies on API-level auth only
7. **Tighten RLS policies** — StoreProduct/Product/Store currently `USING (true)`
8. **Restore per-item prep time in AddMenuProductModal**
9. **Customer "Not Accepted" order cards**
10. **Debug Razorpay on DiningCheckoutScreen**
11. **Fix customer tax display** — YourOrdersScreen shows ₹0

### Tech Debt

- Migrate timestamps to timestamptz
- Store + merchant_branches consolidation
- Push notifications (requires dev build)
- Console.log __DEV__ wrapping
- Make gstRate from real product data
- Table allotment system (capacity per slot — partially done via slot_config)
- Auth refresh for DiningCheckoutScreen (deferred until Razorpay fixed)
- Delete DiningCheckoutScreen_backup.tsx
- Add rating system (then re-enable showRatings in filterConfig.ts)

---

## GST RULES FOR PAS (reference)

**5% GST without ITC** — correct default for standalone restaurants, cafes, bakeries in India.

Exceptions: Hotels with room tariff >₹7,500/night (18%), GST-exempt (<₹20L turnover, 0%), alcoholic beverages (state VAT).

---

## HOW TO WORK WITH CODING AGENTS (PROTOCOL)

1. One change at a time. Claude writes exact task.
2. Every task ends with "STOP. Wait for approval."
3. Agent makes change, shows diff + tsc output
4. Claude reviews before approving
5. Never let agent bundle multiple changes
6. Always verify `tsc --noEmit` after every change
7. **Known pre-existing errors to ignore:** API (3 at lines 1702, 1833, 1841), Consumer (DiningCheckoutScreen at 143, 355)

---

## RULE: UPDATE THIS FILE

**At the end of every execution session, update this PAS_handoff.md in detail with all changes made.**

---

## PREVIOUS TRANSCRIPTS

- `/mnt/transcripts/2026-05-15-*` (May 15 session)
- `/mnt/transcripts/2026-05-11-*` through `2026-05-04-*` (earlier sessions)
- Claude Code sessions in `~/.claude/` (May 16–18)
