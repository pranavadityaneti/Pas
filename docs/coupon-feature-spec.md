# Coupon Feature — Design Analysis & Implementation Spec

**Status:** Design captured — **NOT yet implemented.** Eventual scope = **UI + backend coupon engine.**
**Date:** 2026-05-29
**Design source:** Claude Design handoff bundle, saved at `docs/design/pas-coupons/` (HTML/React prototype + chat transcript + screenshots). The prototype is reference only — recreate the visual output in our stacks; don't port the prototype's internal structure.

> This document is the saved understanding of the coupon design. When we build it, this is the brief.

---

## 1. Overview

A coupon system with **two surfaces sharing one coupon card**:

1. **Admin coupon builder** → target: **`admin-web`** (React + Tailwind). A form with a **live preview** that renders the coupon exactly as customers see it.
2. **Customer coupon view** → target: **`consumer-app`** (React Native/Expo). Web + mobile "your coupon is ready" wallet with a **claim / Apply / copy-code** flow. *(The prototype is web HTML/CSS; the RN build is a faithful re-creation — perforation via SVG, not CSS masks.)*

The visual centerpiece is a **ticket-style coupon** (vertical "COUPON" tab, big value block, dotted dividers, perforated edge, validity pill, redeem code) in **brand red on cream**.

---

## 2. Visual system

| Token | Value |
|---|---|
| Brand red (accent) | `#b42926` (canonical) |
| Coupon body (cream) | `#f8efd8` (classic style) |
| App/canvas bg | `#f0e9da` / `#faf6ec` |
| Body text on cream | muted: `color-mix(in oklab, accent 62%, #8a6a55)` |
| Display/body font | **Hanken Grotesk** (400–800) |
| Mono (code/value) | **Space Mono** (400/700) |

**Coupon card anatomy** (`coupon-card.jsx` — the shared component):
- Scales off a single `w` (width px) prop — every dimension is `value * (w/540)`, so one component renders crisply at 320 (mobile) → 560 (admin preview).
- **Vertical tab** (left): rotated `COUPON`/tab-label, dashed inner border.
- **Value block** by type: Fixed `₹{amount}` (78px), Percent `{n}% OFF`, BOGO `BOGO / Buy n, get n free`.
- **Logo** (optional): uploaded image, or a dot + brand name.
- **Dotted dividers** between rows; description row (centered).
- **Validity pill** (italic): `Valid thru {date}` or `Valid until cancelled`.
- **Redeem code** (Space Mono) with "REDEEM CODE" label — **hidden entirely when no code**.
- **Shape silhouette** via CSS mask: `ticket` (perforated right edge), `notched` (side notches), `plain`.
- **Perforation/notches in React Native** will need an **SVG mask or overlay** — CSS `mask-image` radial-gradient tricks don't exist in RN.

---

## 3. Coupon data model (basis for the backend schema)

From the prototype's coupon object (`app.jsx` `TWEAK_DEFAULTS`). The **production-relevant** fields (drop the look/tweak fields below — they're design-exploration):

| Field | Type | Notes |
|---|---|---|
| `type` | enum `fixed` \| `percent` \| `bogo` | discount type |
| `value` | number | ₹ amount (fixed) or % (percent) |
| `bogoBuy`, `bogoGet` | int | BOGO quantities |
| `title` | string (≤14) | tab label (e.g. "COUPON", "SAVE") |
| `brandName` | string (≤18) | shown on card if logo off |
| `description` | string (≤160) | promo copy |
| `validFrom` | date | start |
| `validThrough` | date | end (ignored if `noExpiry`) |
| `noExpiry` | bool | "valid until cancelled" |
| `code` | string | redeem code (manual or generated); **empty ⇒ auto-apply, no code** |
| `autoCode` | bool | auto-generate a **unique one-time code per customer** at claim |
| `usageLimit` | int | total redemptions (0/∞ = unlimited) |
| `perCustomer` | int | per-customer cap |
| `minOrder` | number (₹) | minimum order to qualify |
| `eligibility` | enum `all` \| `new` \| `returning` \| `product` | audience |
| `logo` | image | optional brand logo on card |

**Look/tweak fields (design-exploration only — NOT production data):** `accent`, `cardStyle` (classic/modern/bold), `shape` (ticket/notched/plain), `radius`, `density`, `builderLayout`. Production uses the **Classic Ticket** look in brand red. The Tweaks panel and the 3-style/3-shape variants are **prototype tools — do not build them.**

Money is **₹ with Indian grouping** (`toLocaleString('en-IN')`) everywhere.

---

## 4. Admin builder spec (`admin-builder.jsx` → admin-web)

Two-column **split** layout (form left, sticky live-preview right) or **stacked** (preview on top). Form sections:

1. **Discount** — segmented Type (Fixed / Percentage / BOGO); conditional fields (₹ amount / % / Buy+Get qty).
2. **Details** — Tab label (≤14), Brand name (≤18), Description (≤160, counter).
3. **Validity** — Valid from, Valid through (date pickers), **"No end date — valid until cancelled"** toggle (greys out the end date).
4. **Redeem code** — text input (Space Mono) + **↻ Generate** (10-char A–Z2–9), **"Auto-generate unique codes"** toggle (each customer gets a one-time code at claim).
5. **Limits & eligibility** — Total usage limit, Per customer, Minimum order (₹), Eligibility select.
6. **Branding** — "Show logo" toggle + drag/click logo upload (PNG/SVG; previewed live).

**Preview column:** live `CouponCard`, summary chips (Status: Draft · Limit · Per customer · Min order), and **Publish coupon** / **Save draft** actions (toast feedback).

---

## 5. Customer view spec (`customer-view.jsx` → consumer-app, RN rebuild)

**Web (reference):** nav → hero "Your coupon is ready" → `CouponCard` (w 560) → **Action bar** → terms line → "More offers" rail (sample coupons).
**Mobile:** "Rewards" screen → `CouponCard` (w 330) → compact action bar → terms → "More offers".

**Action bar / claim flow:**
- State **claimable** → "Apply coupon" button.
- On apply, **if code exists** → reveal code in a dashed box + **Copy** button ("✓ Copied").
- On apply, **if no code** → "✓ Applied — discount added automatically at checkout."
- `applied` resets when the coupon code changes.

**Terms line** (auto-built): `Min. order ₹X · {audience} · Limit N per customer · Valid through {date}` (or "No expiry — valid until cancelled").

The chat flagged future **customer states not yet designed**: expired / already-used / locked. Add these when building.

---

## 6. Eventual implementation scope (UI + backend)

### 6.1 Frontend
- **admin-web:** the builder (§4) + a **coupon list / management view** (not designed yet — needed to view/edit/disable/duplicate coupons, see redemptions).
- **consumer-app (RN):** the customer view (§5) — coupon card via SVG for perforation, claim/apply/copy, a "My coupons/Rewards" entry point, plus the missing states (expired/used/locked).

### 6.2 Backend coupon engine (the heavy part — own spec + API deploy)
- **Schema:** `coupons` table (all §3 fields + status draft/active/disabled, created_by, timestamps) and `coupon_redemptions` (coupon_id, user_id, order_id, code_issued, redeemed_at) for usage/per-customer enforcement and analytics.
- **API endpoints:** CRUD for coupons (admin, RBAC-gated); `POST /coupons/validate` (cart context → eligible? discount amount?); `POST /coupons/claim` (issue a unique code when `autoCode`); apply/consume at order creation; redemption analytics.
- **Validation rules:** min-order, eligibility (new/returning/product), total + per-customer caps, validity window / until-cancelled, active status, code match (or auto-apply when codeless).
- **Code generation:** manual, single shared code, or **auto-unique per customer** (one-time).
- **Checkout integration (consumer-app + API):** apply coupon at cart → recompute total → record redemption on successful order; surface in order/invoice.
- **Admin governance:** ties into RBAC (who can create/approve coupons), audit log, and the coupon analytics in the super-analytics dashboard. (See `docs/admin-dashboard-feature-gap.md` — this is the "Coupon management" P4 workstream.)

### 6.3 Open decisions (for the build kickoff)
- Discount stacking rules (can coupons combine with each other / with offers?).
- BOGO mechanics at checkout (cheapest-free? same-product-only?).
- Where coupons surface to customers (push/banner/marketing campaign — ties to those workstreams).
- Per-store vs platform-wide coupons (merchant-funded vs PAS-funded) + settlement impact.

---

## 7. Pointers
- **Design files:** `docs/design/pas-coupons/project/` (read `coupon-card.jsx` first, then `admin-builder.jsx`, `customer-view.jsx`; `app.jsx` has defaults).
- **Screenshots:** `docs/design/pas-coupons/project/screenshots/`.
- **Intent/iteration history:** `docs/design/pas-coupons/chats/chat1.md`.
- **Not for production:** `tweaks-panel.jsx`, `ios-frame.jsx`, `browser-window.jsx` (prototype scaffolding).
