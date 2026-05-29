# PAS — OTA Update Tracker

> **Rule:** Every JS/TS change that can be shipped via OTA (no native module / app.json / permission changes) is logged here. After every **6 accumulated changes**, Claude MUST remind Pranav to push an OTA update before continuing new work.
>
> **OTA Limitation:** OTA covers JS/TS/asset changes ONLY. NOT: new native packages, app.json changes, permission changes, SDK upgrades. Those require a full EAS build + TestFlight/Play Store submission.

---

## OTA Commands

```bash
# Consumer app
cd apps/consumer-app && npx eas-cli update --branch production --message "description"

# Merchant app
cd apps/merchant-app && npx eas-cli update --branch production --message "description"
```

---

## Current OTA Queue — Consumer App

> **Status: ✅ CLEAN** — OTA pushed May 25 (Android order realtime fix), queue empty

*(No pending changes)*

---

## Current OTA Queue — Merchant App

> **Status: ✅ CLEAN** — OTA pushed May 26 (branch state sync), queue empty

---

## NOT OTA-Eligible (Require Full Build)

| Change | Reason | App |
|--------|--------|-----|
| Android package name change (`io.pickatstore.consumer` → `com.pas.consumerapp`) | app.json change | Consumer |
| Android versionCode bump | app.json change | Consumer |
| ~~New merchant app build with expo-updates~~ | ~~DONE — Build 14 on TestFlight since May 16~~ | Merchant |

---

## OTA History

| Date | App | Update Group ID | Message | Changes included |
|------|-----|-----------------|---------|-----------------|
| May 18 | Consumer | `e02eaebe-2021-4d10-a4f4-71e7186af443` | Better checkout error messages + DiningCheckout TS fixes | 2 changes: context-aware error alerts (store offline / session expired), DiningCheckoutScreen async/await + non-null fix |
| May 18 | Consumer | `aac52ac3-72b8-46b9-82ef-ed033f4f325b` | Fix cart auto-increment: use Math.max for merge, filter auth events, break sync-back loop | 3 fixes: Math.max instead of sum for merge, only merge on SIGNED_IN, isLoadingFromCloud guard on sync effect |
| May 18 | Consumer | `21a88fbc-c4e0-4aeb-affc-cad628bf28a3` | Fix dining tab showing retail stores: combine vertical + service mode filtering | 1 fix: diningStores filter requires isDining AND serviceDinein; pickupStores shows non-dining OR servicePickup |
| May 18 | Merchant | `4e5dcaa7-0028-4650-84be-9be5be317efb` | Remove debug logging from save timings flow | Cleanup: removed DEBUG console.log from StoreContext, timings, dashboard |
| May 18 | Merchant | `fc0f2ee2-3a5b-4d64-bc61-483ae882a44b` | Fix crash on save timings: move React hooks above conditional early return (Rules of Hooks violation) | 1 fix: useState/useCallback/useEffect moved above loading guard early return |
| May 18 | Merchant | `fd44fb3c-1c48-4215-a193-161fc9c750f6` | Dashboard auto-refreshes on focus + 30s timer for time-based transitions | useFocusEffect refreshStore + checkStatus as useCallback + 30s interval |
| May 18 | Consumer | `957dbc58-3701-45ec-8fa6-b36d9a5f3d6c` | Live store open/close transitions: re-evaluate isOpen every 60s + on app foreground | rawDataRef + 60s re-transform interval + AppState listener |
| May 18 | Merchant | `5518c044-d9d7-47ec-847e-2d07b6a1a41b` | Dashboard enforces operating hours: auto-offline outside open/close window, amber banner with schedule info, switch disabled until hours begin | 1 change: isOutsideHours check + banner + switch disabled + alert on toggle attempt |
| May 18 | Merchant | `15f2b944-55e4-48d8-9f49-f9eca99347e6` | Fix store offline false-positive: dashboard loading guard, validate DB writes, eliminate phantom branches | 3 fixes: dashboard loading guard, row count validation on updateStoreDetails/toggleStoreStatus, phantom branch cleanup |
| May 18 | Merchant | `31bb3a0c-2832-485c-aea2-c06885e6939e` | Service modes isDirty fix, branch context, dining fields, slot booking, staff, dashboard, earnings, upsert, profile refresh | 11 changes (waiting for build 14 install on testers) |
| May 18 | Consumer | `6d9d5112-9b77-4640-8bad-f6afd15b1b66` | Service modes fix, offline store visibility, navigation restructure, slot booking, filters, keyboard fixes, auth improvements | 20 changes: nav restructure, universal search, storefront enhancements, booking modal, dining/pickup filters, dataTransformer fixes, cart persistence, location improvements, text alignment audit, keyboard fix, store status alerts, auth session fix, search clear button, order request improvements, service mode filtering, orderMode nav param |
| May 15 | Consumer | `53820845-433b-44a7-af77-b6fab7fe9212` | First OTA update | Auth refresh fix, RLS migration, profile cleanup |
| May 25 | Consumer | `a7ea5ab9-b9b1-4223-8f22-b532c5ee7a35` | Android order realtime fix: polling fallback + AppState reconnect | 1 fix in `useOrderRequests.ts` — added 5s polling on `order_requests` non-PENDING status + AppState 'active' listener that re-subscribes the WebSocket channel. Resolves Android customer app getting stuck on "waiting for merchant approval" after merchant accepts. Verified on Android pickup order. File now locked. |
| May 26 | Merchant | `ede26024-36f0-4e9d-b53a-e6b628253e97` | Merchant branch state sync: AppState foreground + Realtime UPDATE + 60s polling fallback | 1 additive `useEffect` in `StoreContext.tsx` — subscribes to AppState 'change' (foreground refetch), Supabase Realtime UPDATE on `merchant_branches` filtered by merchant_id, and 60s polling. Plus DB-side: `ALTER PUBLICATION supabase_realtime ADD TABLE merchant_branches` (required for realtime to fire). Verified: SQL UPDATE → banner flips in <5s. Resolves stale `is_active` state from external mutations (admin, multi-device, scripts). |
| May 26 | Consumer | `b30507b4-3918-4e0b-a4af-29607669aeba` | Soft-recovery 401 interceptor: refresh + retry once before purging session | Phase 1 of signout-fix plan. `apps/consumer-app/src/lib/api.ts` 401 interceptor rewritten — on 401: (1) skip recovery if no token was sent (anon endpoint rejection isn't our session problem); (2) attempt `refreshSession()`; (3) on success, retry original request once with new token — purge only if retry also returns 401; (4) on permanent refresh failure (`invalid_grant`, `refresh_token_not_found`, etc.) purge; (5) on transient refresh failure (network/timeout) preserve session and return original 401. Also bundles the previously un-shipped `// @lock` header on `useOrderRequests.ts` (comment-only). Expected impact: eliminates "stale session, actions fail" and "dumped to home" patterns from transient backend 401s. |
| May 26 | Merchant | `19d7086a-6deb-4767-87e0-97742a4d40cd` | Phase 2A: SecureStore failures now logged (diagnostic only) | `apps/merchant-app/src/lib/supabase.ts` — replaced silent `catch {}` blocks in `ExpoSecureStoreAdapter` (getItem/setItem/removeItem) with `catch (e) { console.warn('[SecureStore] …', e?.message) }`. Pure diagnostic — preserves original return values (getItem still returns null on failure; set/remove still swallow). Goal: surface silent keychain failures in real-world use to determine if Phase 2B (AppState gating) + Phase 2C (refreshSession swap) are sufficient or if a deeper fix (e.g. AsyncStorage migration) is needed. |
| May 26 | Merchant | `e313a43f-2254-4c52-9045-4d9a09df8276` | Merchant notifications Phase A: tap-to-navigate + type taxonomy normalized | 4 files: (1) `src/hooks/usePushNotifications.ts` — registered `addNotificationResponseReceivedListener` for foreground/background taps + `getLastNotificationResponseAsync` for cold-start launches. Routes via shared `routeForNotification` helper. (2) `app/(main)/notifications.tsx` — refactored tap handler to use shared helper; preserves mark-read + wrong-branch guard. (3) `src/hooks/useNotifications.ts` — replaced lowercase 4-type union with UPPERCASE 9-type canonical `NotificationType`. (4) `src/components/NotificationToast.tsx` — added `NEW_ORDER_REQUEST` and `ORDER_CANCELLED` to TYPE_CONFIG so they get correct icons instead of falling to DEFAULT. Eliminates the "tap notification, nothing happens" UX dead-end. |
| May 27 | Merchant | `99e5500e-cdc8-4456-92ba-290684554aca` | Notifications cleanup: B2 + C1 + C2 | Three small fixes bundled. **B2:** `src/hooks/useNotifications.ts` — `orderCancelled` preference toggle now gates both `CANCELLED` AND `ORDER_CANCELLED` types (was missing the customer-cancellation case). **C1:** deleted dead `src/components/NotificationCenter.tsx` — defined but never mounted. **C2:** `src/hooks/usePushNotifications.ts` — push token registration now sends `deviceId` (Device.osBuildId with fallback) to backend for multi-device dedupe; field was already plumbed end-to-end in API + DB but never sent from client. |

---

## Rules

1. Every JS/TS change logged here immediately after implementation
2. After **6 new changes accumulate**, Claude MUST remind: "⚠️ 6+ OTA changes queued. Should we push an OTA update before continuing?"
3. Changes that touch `app.json`, native modules, or permissions are marked NOT OTA-eligible
4. After pushing OTA, move queued items to OTA History and reset the queue
