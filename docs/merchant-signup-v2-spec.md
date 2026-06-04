# Merchant Signup v2 — Locked Spec

> **Status:** LOCKED 2026-06-04. Any deviation requires explicit chat-confirmed update from Pranav.
> **Authors:** Pranav (decisions), Claude (synthesis + technical detail).
> **Implementation:** Tracked in phased execution; see Part C of this doc.

---

## Part 0 — Open blockers (must close before launch)

These are open items found in vendor-agreement review (2026-06-04). The signup code can begin without them, but the **eSign + go-live cannot complete without resolution**.

| # | Blocker | Owner | Notes |
|---|---|---|---|
| B1 | "Lifetime Access" wording in UI vs agreement's "one-time onboarding fee" + revision clause | Pranav | Decided 2026-06-04: KEEP "Lifetime Access" UI wording. Pranav is redrafting all 3 vendor agreements to include an explicit "Lifetime Listing Right" clause that aligns the agreement text with the UI promise (suggested draft language in gap-analysis notes). |
| B2 | `designation` field needs to be captured at Step 1 to populate agreement signatory block | Spec | Added below to Step 1 |
| B3 | Agreements don't explicitly say onboarding fee is non-refundable | Pranav + lawyer | Need clause added before going live |
| B4 | Agreements don't recognize Aadhaar eSign / Section 3A of IT Act 2000 | Pranav + lawyer | Need clause added before going live |
| B5 | Agreements don't disclose Aadhaar collection per Aadhaar Act § 8 | Pranav + lawyer | Need clause added before going live |
| B6 | Privacy Policy missing Grievance Officer (DPDP Act 2023 mandate) | Pranav | Person + email to be designated |
| B7 | Digio credentials not yet available | Pranav | Code can stub env-var-driven config; we wire when received |
| B8 | T&C / Privacy minor gaps (see audit notes — Pranav opted to use what's there for now) | Pranav | Deferred |

---

## Step 1 — Identity

**Captured:**
- Owner Name (required)
- **Designation** (required — populates agreement signatory block; e.g., "Proprietor", "Director", "Partner")
- Phone (required, 10-digit Indian, `/^[6-9]\d{9}$/`)
- Email (required, valid format)
- Phone OTP (Wati WhatsApp, 6-digit, must verify before Next)

**Persistence:** Local AsyncStorage only at this step. Server persist happens at Step 5 sync boundary (existing pattern preserved).

**Auth:** Existing `/auth/send-otp` and `/auth/verify-otp` endpoints. No change.

---

## Step 2 — KYC

**Captured:**
- PAN Number (regex `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/`) + PAN image (required)
- Aadhaar Number (12 digits) + Aadhaar Front image + Aadhaar Back image (all required)
- **GST Number — MANDATORY for ALL merchants** (full GSTIN regex) + GST Certificate image (required)
- FSSAI Number (14 digits) + FSSAI License image (required ONLY if `vertical.requiresFssai`)
- MSME / Udyam Number (optional; format `UDYAM-XX-00-0000000` if provided)
- Bank Account Number (9-18 digits, required)
- IFSC Code (full IFSC regex, required)
- Beneficiary Name (required)
- **Turnover Range** — NO DEFAULT. Must be explicitly selected.

**DigiLocker integration:** Deferred to post-launch v1.1.

**Validation:** Existing client-side regexes preserved.

**Persistence:** Local AsyncStorage only.

---

## Step 3 — Stores (consolidated, replaces old Photos + Branches)

**Decisions locked:**
- Terminology: **"Stores"** (no "Branches")
- No `has_branches` toggle. Step opens with one empty store card. "Save & Add Another Store" button after each save.
- Per-store min 2 photos (strict)
- **No cap** on number of stores at signup
- **No `is_primary`** flag — all stores treated equally

**Per-store fields:**
- Name (required)
- Address (Google Places autocomplete, required)
- Latitude + Longitude (auto-populated from Places, **mandatory non-null** — no default coords)
- City (auto-extracted from Places `locality` component)
- Manager Name (required)
- Manager Phone (required)
- Photos (min 2, max no UI cap)
- **Food-vertical only** (when `vertical.requiresFssai` or `vertical.isDining`):
  - Cuisines (multi-select)
  - isVeg (toggle)
  - Restaurant Type

**Backend model change (Phase 3):**
- Drop the `id == merchant_id` main-branch convention.
- All stores become UUID-keyed `merchant_branches` rows under the same `merchantId`.
- Migration converts existing merchants' main branches to UUID-keyed rows.
- Update `get_nearby_stores` RPC if it has main-branch assumptions.

**Persistence:** Local AsyncStorage. Server sync at Step 5 boundary.

---

## Step 4 — Agreements

**Three documents** to be displayed:
1. **Privacy Policy** — version from `https://www.pickatstore.io/privacypolicy/merchant-app` (or per-merchant PDF when generated server-side)
2. **Terms & Conditions** — version from `https://www.pickatstore.io/terms/merchant-app`
3. **Partner Agreement** — selected based on merchant's `vertical`:
   - Restaurant verticals → "For Restaurants" PDF
   - Grocery verticals → "For Groceries" PDF
   - Other verticals → "For Other Stores" PDF

**UI flow:**
1. Each document rendered in a scrollable WebView or PDF viewer.
2. "I have read [doc name]" checkbox below each.
3. Checkbox is **DISABLED until user scrolls to bottom** (strict — no skipping).
4. Visual progress indicator while scrolling (hint, not blocker).
5. After all 3 checkboxes are checked → **"Sign all 3 documents"** button enables.
6. Tap → Digio Aadhaar eSign batch flow signs all 3 PDFs in one OTP.

**Per-merchant PDF generation (server-side):**
- Template PDFs stored in `apps/api/agreements/` (or Supabase bucket `merchant-agreements`).
- At Step 4 trigger, server fills in:
  - Business Name → `store.storeName`
  - Authorized Signatory → `identity.ownerName`
  - **Designation → `identity.designation`** (new field per B2)
  - Date → eSign completion timestamp
- Generated PDFs uploaded to `merchant-agreements/{merchant_id}/{doc_type}-{version}.pdf` bucket.

**eSign vendor:** Digio (Aadhaar OTP eSign).

**Failure handling:** **Block until eSign succeeds.** No manual signature fallback. If Digio API returns failure, show "Retry" + support contact.

**Persistence:** `merchant_consents` table records every successful signature event with: merchant_id, document_id, document_version, signed_at, esign_txn_id, signed_pdf_url, ip_address, user_agent.

---

## Step 5 — Subscription

**Pricing:**
- **Standard tier**: ₹999 × number-of-stores (LINEAR, no discount)
- **Premium tier**: ₹2,999 × number-of-stores (LINEAR, no discount)
- Vertical's `isPremium` boolean determines tier.

**UI wording (resolved 2026-06-04):**
- **KEEP existing "Lifetime Access" UI strings.**
- Pranav is redrafting all 3 vendor agreements to include an explicit "Lifetime Listing Right" clause so the agreement text aligns with the UI promise.
- The strikethrough "₹4999 / ₹2499" remains as discount-vs-list-price framing.

**Coupon input:**
- Text field "Have a partner coupon code?"
- Validates against new `merchant_signup_coupons` table (separate from consumer coupons).
- Discount type: **flat ₹ off only** (for now).
- Single-use per merchant (idempotency lock).
- Server-side re-validation at PATCH-finalize.

**Razorpay flow:**
- Order create amount = (stores × tier_price) − coupon_discount
- Order metadata includes plan_type + store_count + coupon_id
- Existing signature-verify endpoint preserved
- On success → `syncDraftState(finalize: true)` with payment details

**Persistence:** Razorpay order persisted server-side via existing `subscriptions` table (extended with `store_count` + `coupon_id` columns).

---

## Step 6 — Review

**Display every captured field** grouped by step:
- Identity: Name, Designation, Phone, Email
- KYC: PAN (masked), Aadhaar (last 4), GST, FSSAI (if), Bank A/C (masked), Turnover
- Stores: each with address, manager, photos thumbnail count
- Agreements: all 3 confirmed signed with eSign txn IDs
- Subscription: per-store breakdown, total, coupon (if applied)

**"Edit" button** per section jumps back to that step.

**"Confirm everything is correct"** checkbox required before Submit enables.

**On Submit:**
- Final `syncDraftState(finalize: true)` if payment already done (idempotent)
- Generate `merchant_summary.pdf` server-side, store in bucket
- Email PDF copy to merchant + admin queue
- `merchants.status = 'inactive'`, `kyc_status = 'pending'`
- Route to dynamic pending screen
- Clear AsyncStorage draft

---

## Step 7 — Pending Screen (dynamic)

**Persistent route — escape hatches removed:**
- ❌ Remove "Back to login" / "Sign out" buttons (per Pranav's Q16 clarification)
- ❌ Remove any path back to signup
- ✅ Persistent across app restarts — if user closes + reopens, this is the only screen visible until status changes
- ✅ Status auto-refreshed: realtime via Supabase channel + foreground polling fallback every 30s

**Status-driven UI:**

| `merchants.kyc_status` | What user sees |
|---|---|
| `pending` | "Under review. We'll respond within 24-48 hours." + ETA indicator |
| `needs_info` | "More information needed: <admin reason>." + "Update <field>" button → routes to specific step. **Only that field is editable; everything else read-only.** |
| `approved` | 🎉 Celebratory animation + "Welcome to PickAtStore!" + "Enter App" button → routes to main |
| `rejected` | "Application not approved. Reason: <reason>." + "Contact support" CTA |

**Push notifications:** Fire on every status change. (Already have Expo notifications wired.)

**SLA promise:** "24-48 hour review time" shown explicitly. If 48h+ elapsed in `pending` → show "Sorry for the wait — escalating." + chat-support button.

---

## Cross-cutting hardening

### Default coordinates (no more Hyderabad sentinel)

- Initial state: `latitude: null, longitude: null`.
- Validation: Google Places must return non-null lat/lng — disabled "Save Store" until coords received.
- **Server-side validation (defense in depth):**
  - Reject the exact sentinel `latitude: 17.385, longitude: 78.4867`.
  - Reject coords outside India bounds: `lat 6-37, lon 68-97`.
  - Sentry alert on detected default sentinel (signals client bypass).

### Phone re-verification on resume

- App reopen → silent `supabase.auth.refreshSession()` in background.
- If refresh succeeds → user continues at saved step (no UI interruption).
- If refresh fails → modal at current step: "Session expired. Please verify your phone to continue." Phone pre-filled from draft. OTP → modal closes → continue at same step. **Never return to Step 1.**
- Phone change detection: if user enters different phone in modal → force restart signup (different user_id).

### turnoverRange — no default

- Initial value: `null`.
- Dropdown placeholder: "Select range".
- Validation: must be non-null before Next.

### Edit after submission

- Admin-gated only.
- Admin sets `kyc_status = 'needs_info'` + specifies `needs_info_field` + `needs_info_reason`.
- Pending screen shows reason + "Update" button → routes to that step.
- **Only the flagged field is editable**; all others are read-only.
- On resubmit, status flips back to `pending` for re-review.

### Image compression

- Client-side via `expo-image-manipulator`: resize max-width 1280px, JPEG quality 0.7.
- Server-side fallback via Sharp if file > 1MB.
- Both store + display in compressed form. Original NOT retained.

### File restructure (Phase 2)

```
apps/merchant-app/app/(auth)/signup.tsx                  (orchestrator, ~250 lines)
apps/merchant-app/src/screens/signup/
├── IdentityStep.tsx
├── KycStep.tsx
├── StoresStep.tsx
├── AgreementsStep.tsx
├── SubscriptionStep.tsx
├── ReviewStep.tsx
└── shared/
    ├── SignupContext.tsx
    ├── useOtpVerify.ts
    ├── useImageUpload.ts
    ├── usePlacesAutocomplete.ts
    ├── validations.ts
    ├── coupon.ts
    └── types.ts
```

---

## Document versioning architecture

### Tables

```sql
CREATE TABLE merchant_consent_documents (
  id              uuid          PRIMARY KEY,
  doc_type        text          NOT NULL,    -- 'privacy' | 'terms' | 'agreement_restaurant' | 'agreement_grocery' | 'agreement_other'
  version         text          NOT NULL,    -- 'v1.0.0' etc.
  template_url    text          NOT NULL,    -- bucket path or public URL
  effective_at    timestamptz   NOT NULL DEFAULT now(),
  retired_at      timestamptz,                -- null = current
  created_by      uuid REFERENCES "User"(id),
  UNIQUE(doc_type, version)
);

CREATE TABLE merchant_consents (
  id                uuid          PRIMARY KEY,
  merchant_id       uuid          NOT NULL REFERENCES merchants(id),
  document_id       uuid          NOT NULL REFERENCES merchant_consent_documents(id),
  document_version  text          NOT NULL,  -- denormalized; survives doc retirement
  signed_at         timestamptz   NOT NULL,
  esign_txn_id      text          NOT NULL,  -- Digio transaction ref
  signed_pdf_url    text          NOT NULL,
  ip_address        text,
  user_agent        text
);
```

### Workflow
- Document edits → bump `version`, insert new row in `merchant_consent_documents` with new template_url, mark old as retired.
- New signups consent to current (non-retired) version.
- Existing merchants' consents remain valid for their version.
- "Force re-consent on version bump" is a future feature (not in v1).

---

## Coupon system (`merchant_signup_coupons`)

### Separate from consumer coupons

Rationale: different audience, different lifecycle, different redemption mechanics. Mixing risks accidental cross-redemption.

### Table

```sql
CREATE TABLE merchant_signup_coupons (
  id              uuid          PRIMARY KEY,
  code            text          UNIQUE NOT NULL,
  discount_inr    integer       NOT NULL CHECK (discount_inr > 0),
  max_uses        integer,                       -- null = unlimited
  used_count      integer       NOT NULL DEFAULT 0,
  applies_to_tier text,                          -- 'standard' | 'premium' | null (both)
  expires_at      timestamptz,
  is_active       boolean       NOT NULL DEFAULT true,
  created_by      uuid REFERENCES "User"(id),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE merchant_signup_coupon_redemptions (
  id          uuid          PRIMARY KEY,
  coupon_id   uuid          NOT NULL REFERENCES merchant_signup_coupons(id),
  merchant_id uuid          NOT NULL REFERENCES merchants(id),
  applied_at  timestamptz   NOT NULL DEFAULT now(),
  amount_inr  integer       NOT NULL,
  UNIQUE(merchant_id)  -- one coupon per merchant signup
);
```

### Admin UI

Simple CRUD section under Admin → Marketing → "Merchant Signup Coupons" (or under Settings). No fancy preview — just code + amount + max_uses + tier + expiry.

### API endpoints

- `POST /merchant-signup/validate-coupon` (consumer-side from signup app) — returns `{valid, discount_inr, error}`
- `POST /admin/merchant-signup-coupons` (admin CRUD)

---

## Phased execution plan

| Phase | What | Effort | Status |
|---|---|---|---|
| **0** | This spec doc — committed 2026-06-04 | 15 min | ✅ This commit |
| **1** | Refactor locked `signup.tsx` — split into orchestrator + 6 step components + shared/. **Behavior unchanged.** Sub-phased 1.1 → 1.7. | ~2.5 hrs | Next |
| **2** | New Step 2 (KYC moved earlier) + new Step 3 (consolidated Stores) + Step 4 (Agreements UI shell) + Step 5 (per-store + coupon) + Step 6 (detailed review) | ~3 hrs | After Phase 1 |
| **3** | Backend: drop main-branch convention + migration + new `/auth/merchant/draft` shape + `merchant_signup_coupons` tables | ~1.5 hrs | After Phase 2 |
| **4** | Cross-cutting: default coord removal + India bounds + phone re-verify modal + turnoverRange default removal + image compression | ~2 hrs | Parallel-able with Phase 3 |
| **5** | Dynamic pending screen + Supabase realtime + needs_info gated edit flow + push notification on status change | ~1.5 hrs | After Phase 3 |
| **6** | Digio integration: server endpoint, per-merchant PDF generation, eSign webhook, `merchant_consents` table | ~3 hrs IF Digio credentials available. Blocked otherwise. | Parallel with Phase 5 |
| **7** | T&C/Privacy/Agreement legal clauses (Blockers B3-B6) — drafted by Claude OR lawyer, applied by Pranav | Your call | Independent track |
