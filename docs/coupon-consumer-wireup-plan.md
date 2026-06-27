# Coupon — Consumer-Side Wire-up Plan

**Drafted:** 2026-05-30 (late evening; for tonight's main session)
**Status:** Ready to execute. Lock overrides required (called out per phase).

## Why this exists

The admin coupon builder is fully live (UI + API + DB + theme persistence + admin auth).
When an admin publishes a coupon today:
- ✅ It writes to `public.coupons` and is visible in the admin list.
- ❌ It is **not** visible to customers — `apps/consumer-app/src/screens/OffersScreen.tsx:12` ships a hardcoded `AVAILABLE_COUPONS` array.
- ❌ Customers cannot apply it — manual code entry (`OffersScreen.tsx:208`) searches that same hardcoded array.
- ❌ Even a matching code wouldn't be redeemed — `POST /coupons/redeem` is deployed but no consumer-app code calls it, so `usedCount` stays at zero and per-customer limits never fire.

The control plane works; the cable to the data plane is unplugged. This plan plugs it in.

## Outcome we're shipping

After this plan:
- Admin publishes a coupon → it appears in the customer app's Offers screen within seconds (or on refresh).
- Customer types a code at checkout → real-time validation against actual rules (min order, per-customer limit, audience, BOGO eligibility, expiry).
- Customer pays → redemption recorded, `usedCount++`, per-customer limit enforces on the next attempt.
- All this protected by consumer auth (the validate/redeem routes stop being open).

Explicitly NOT in scope for tonight:
- Rendering the admin's ticket-style `CouponCard` on the customer side. The web component uses `color-mix` + `WebkitMaskImage` which don't exist in React Native; porting is a chunk. Customers continue to see the existing `OfferCard` styling but with **real** data + theme color mapping (Phase 5).

---

## Phase 1 — `OffersScreen` reads from the API (UNLOCKED — straightforward)

**File:** `apps/consumer-app/src/screens/OffersScreen.tsx`
**Lock status:** not in lock list.

- Replace `const AVAILABLE_COUPONS = [ ... ]` with a `fetchCoupons()` call (new util on the consumer side that mirrors the admin's couponService — uses `apiClient.fetch` so it gets the consumer JWT + Phase-1 401-soft-recovery).
- Endpoint: `GET /coupons?audience=ALL|user-eligible&active=true&storeId=…(if relevant)`. The current admin route returns all rows; we'll either (a) extend it to accept consumer auth + filter, or (b) add a parallel `GET /consumer/coupons` that returns only the rows safe to show.
- Map each API coupon to the existing `OfferCard` shape (code, discountType, discountValue, minOrder, description, theme→color).
- Loading skeleton + empty state.
- Manual-code-entry path: change `AVAILABLE_COUPONS.find(c => c.code === manualCode)` to `POST /checkout/validate-coupon { code, subtotal }`. On success → apply. On fail → surface the API's error message (today the existing code just `alert('Invalid coupon code')` — keep similar UX).

## Phase 2 — `CartScreen` aligns with the validate-coupon response shape (🔒 LOCKED — needs override)

**File:** `apps/consumer-app/src/screens/CartScreen.tsx`
**Lock status:** locked per CLAUDE.md line 161 ("Plus pre-existing locks on: AuthContext, LocationContext, ..., CartScreen, ...").
**Lock override needed:** **YES** — scope the override to the coupon-application math only. Cart-merge logic, KAV, layout are out of scope.

- Today's `CartScreen` does its own discount math from `coupon.discount + coupon.maxDiscount + coupon.isPercentage`. Those shapes were invented for the hardcoded array — they don't match the API.
- New math: trust the validate-coupon response. The API returns `{ valid: true, discount: <amount>, bogo?: {...} }` (already implemented per session memory). Cart just displays the discount the API computed; doesn't recompute.
- Remove the local `if (subtotal < coupon.minOrder) → setCoupon(null)` shortcut. Keep it as a UX guard, but the truth is the API.

## Phase 3 — `CheckoutScreen` + `DiningCheckoutScreen` redemption hook (🔒 HARD-LOCKED May 19 demo — needs override)

**Files:**
- `apps/consumer-app/src/screens/CheckoutScreen.tsx`
- `apps/consumer-app/src/screens/DiningCheckoutScreen.tsx`

**Lock status:** **hard-locked** May 19 demo — includes `handlePaymentSuccess` session-recovery, sticky CTA layout, errorDiagnostic UI.
**Lock override needed:** **YES** — scope tightly to "after successful order creation, call `POST /coupons/redeem`". Do NOT touch the locked logic (handlePaymentSuccess, effectiveUser, errorDiagnostic). Insert a single async call inside the post-order success branch.

```ts
// pseudo — after order successfully created
if (appliedCoupon?.id && createdOrder?.id) {
  try {
    await apiClient.fetch('/coupons/redeem', {
      method: 'POST',
      body: JSON.stringify({ couponId: appliedCoupon.id, orderId: createdOrder.id }),
    });
  } catch (e) {
    // best-effort — don't block the user; log for ops triage
    console.warn('[Coupon] redeem failed', e);
  }
}
```

The `/coupons/redeem` route is idempotent on `orderId` (per session memory), so a retry won't double-decrement. Server-side already increments `usedCount` atomically.

## Phase 4 — Consumer auth on `validate-coupon` + `redeem` (API)

**File:** `apps/api/src/index.ts`
**Lock status:** not locked.

- Add a `requireUser(req, res)` helper next to `requireAdmin` (verifies the Supabase JWT, returns the user; rejects 401 if absent/invalid).
- Apply it to `POST /checkout/validate-coupon` and `POST /coupons/redeem`.
- Inside the handlers, derive `userId` from the verified token (`u.id`), not from the request body. This closes the spoofing hole that's currently noted in `forlater.md`.
- Per-customer limit check inside validate-coupon now uses the verified `userId`.

After this: redeploy API to EB. Same drill (`npm run build → eb deploy pas-api-prod-v2 --timeout 60`).

## Phase 5 — Theme rendering on the customer side (THIN cut tonight; full ticket post-launch)

**Tonight (thin):** read `coupon.theme` from the API in `OffersScreen` and map it to the `OfferCard`'s existing accent color via a small `themeAccent(theme)` helper. Coupons published with `bold` show a deeper red, `festive` shows saffron, `modern` shows the brand red on a lighter card body, etc. — but the **shape** stays the existing `OfferCard` (rounded rectangle), not the ticket.

**Post-launch (full):** port `CouponCard.tsx` to React Native (`react-native-svg` or `react-native-masked-view` for the perforation; manual font-size scaling for ValueBlock). 2-3 hour task. Track as separate `forlater.md` item.

---

## Execution sequence (recommended order)

1. Phase 4 (API auth) FIRST — small, isolated, gives us a verified `userId` to use in 2-3.
2. Phase 1 (OffersScreen) — unlocks the customer's view.
3. Phase 2 (CartScreen lock override) — coupon math aligns with API.
4. Phase 3 (CheckoutScreen + DiningCheckoutScreen lock overrides) — redemption fires.
5. Phase 5 (theme color mapping, no ticket port) — visual finishing touch.
6. Verify end-to-end (see below).
7. Single OTA push of consumer-app (after a clean stash of any unrelated WT changes — same pattern as tonight's logout-fix OTA).

## Verification — end-to-end script

1. Admin builder (localhost:5173/marketing) → publish a `FESTIVE` themed BOGO coupon for `ALL` users, min order ₹100, per-customer limit 1.
2. Consumer app (TestFlight build with new OTA) → open Offers screen → the new coupon appears at the top with saffron accent.
3. Tap the coupon → applies to cart.
4. Try with subtotal < ₹100 → cart auto-removes with the "below minimum" alert (server-driven this time).
5. Bring subtotal above ₹100 → coupon re-applies, BOGO freebie reflects in summary.
6. Complete payment → order placed → admin coupon list shows `usedCount: 1`.
7. Same consumer tries the same coupon again → validate-coupon returns "you've already used this" (per-customer limit enforces server-side).
8. Different consumer tries → it works.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Lock overrides on CheckoutScreen could break May 19 demo flow | Scope override to inserting one async call in success branch; do not touch handlePaymentSuccess, errorDiagnostic, effectiveUser. Verify with the existing repro paths after the change. |
| OTA carries other uncommitted consumer changes (Sentry, etc.) | Use the same git-stash pattern from tonight's logout fix. Stash all non-coupon uncommitted files, OTA, pop. |
| `requireUser` change affects validate-coupon callers downstream | Today no app code calls validate-coupon (we just confirmed). So adding auth doesn't break anything currently in production. |
| `GET /coupons` for consumer might leak admin-only data (e.g., merchant-funded coupons not yet marketed) | Either add a `?audience=ALL` filter on the existing route or stand up `GET /consumer/coupons` with a hardcoded server-side filter (active + not expired + non-merchant or whatever the founder decides). Recommend the latter — easier to reason about, no risk of leaking admin filter knobs. |

## Rollback plan

If anything goes sideways in the night session:
- Phase 1 (OffersScreen): revert to `AVAILABLE_COUPONS` hardcoded array. One file revert.
- Phase 2-3 (locked files): never replace the locked logic; only add new code. Revert = delete the added blocks. Locked sections untouched.
- Phase 4 (API): redeploy the previous EB application version (`eb appversion --list` → `eb deploy --version <prev>`).
- Phase 5 (theme map): trivial; delete the helper.
- No DB schema changes in this plan. No migration to roll back.
