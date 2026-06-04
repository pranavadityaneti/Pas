/**
 * Shared type definitions extracted from app/(auth)/signup.tsx (Phase 1.1).
 *
 * 2026-06-04: created as part of the merchant-signup v2 refactor.
 * Definitions are extracted VERBATIM from the locked signup.tsx — no field
 * names, types, or shapes changed. Behavior is preserved.
 *
 * Reference: docs/merchant-signup-v2-spec.md (Phase 1 — File restructure)
 */

export interface Vertical {
    id: string;
    name: string;
    requiresFssai: boolean;
    isPremium: boolean;
    isDining?: boolean;
}

// 2026-06-04 (Phase 2.G): Branch type removed — the v1 main-store + branches
// model was retired in favor of the consolidated Store[] in Phase 2.C.1.
// Other files (StoreContext, settings/branches.tsx) define their own Branch
// types for their own use cases.

/**
 * State shape for Step 3 — Stores (v2 consolidated). Each merchant has one or
 * more Store entries; the v1 distinction between "main store" and "branches"
 * is collapsed per docs/merchant-signup-v2-spec.md (Step 3).
 *
 * 2026-06-04 (Phase 2.C.1): introduced alongside the legacy StoreState +
 * Branch types — they coexist until Phase 2.C.2 wires the new component and
 * 2.G retires the old types.
 *
 * Key differences vs v1 Branch:
 *  - Client-generated `id` for stable React keys (uuid.v4()).
 *  - `managerName` + `managerPhone` (camelCase, per v2 convention).
 *  - `latitude` / `longitude` mandatory non-null at validation (no Hyderabad
 *    sentinel) — set by Google Places autocomplete selection only.
 *  - No `categoryId` — the vertical is chosen once at signup, shared across
 *    all stores.
 */
export interface Store {
    /** Client-side UUID. Stable React key + future cross-step references. */
    id: string;
    name: string;
    address: string;
    /** Mandatory non-null after Google Places selection (validateStores enforces). */
    latitude: number | null;
    longitude: number | null;
    city: string;
    managerName: string;
    managerPhone: string;
    /** Min 2 photos enforced by validateStores. */
    photos: string[];
    /** Food-vertical fields — used only when selectedVertical?.requiresFssai or isDining. */
    cuisines: string[];
    isVeg: boolean;
    restaurantType: string;
}

/**
 * State shape for Step 1 — Identity.
 * Extracted from inline useState({...}) call in signup.tsx (Phase 1.2, 2026-06-04).
 *
 * 2026-06-04 (Phase 2.A, spec blocker B2): `designation` added — required
 * free text capturing the owner's role/title (e.g. "Proprietor", "Director",
 * "Partner"). Populates the signatory block on the partner-agreement PDF
 * generated at Step 4 (Agreements + Digio eSign).
 */
export interface IdentityState {
    ownerName: string;
    designation: string;
    phone: string;
    email: string;
}

/**
 * State shape for Step 2 — Store.
 * Note: latitude/longitude are `number` (not `number | null`) because the
 * current signup.tsx initializes them to Hyderabad defaults (17.385, 78.4867).
 * That sentinel handling is being addressed in Phase 4, not Phase 1.
 */
export interface StoreState {
    storeName: string;
    categoryId: string;
    categoryName: string;
    city: string;
    address: string;
    latitude: number;
    longitude: number;
    cuisines: string[];
    isVeg: boolean;
    restaurantType: string;
}

/**
 * State shape for Step 4 — Agreements (v2 NEW).
 * 2026-06-04 (Phase 2.D): Captures per-document consent + the overall
 * Aadhaar eSign result.
 *  - privacyAccepted / termsAccepted / partnerAccepted: post-read checkboxes
 *  - signed: true once Digio eSign returns success (or simulated success
 *    while Digio credentials are pending — spec blocker B7)
 *  - txnIds: Digio transaction references for audit trail; one per doc
 *    when batched, empty when stubbed
 */
export interface AgreementsState {
    privacyAccepted: boolean;
    termsAccepted: boolean;
    partnerAccepted: boolean;
    signed: boolean;
    txnIds: string[];
}

/**
 * State shape for Step 5 — KYC.
 * Extracted from inline useState({...}) call in signup.tsx (Phase 1.2, 2026-06-04).
 *
 * 2026-06-04 (Phase 2.B): `turnoverRange` is now `string | null`. The prior
 * default `'<20L'` silently biased every merchant into the lowest band; spec
 * requires explicit selection. Initial value is null (see SignupContext).
 * validateKyc rejects a null turnoverRange before Step → 6 navigation.
 */
export interface KycState {
    panNumber: string;
    aadharNumber: string;
    msmeNumber: string;
    bankAccount: string;
    ifsc: string;
    turnoverRange: string | null;
    gstNumber: string;
    fssaiNumber: string;
    beneficiaryName: string;
}
