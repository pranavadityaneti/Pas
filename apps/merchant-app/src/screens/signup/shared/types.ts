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

export interface Branch {
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    city: string;
    manager_name: string;
    phone: string;
    cuisines: string[];
    isVeg: boolean;
    restaurantType: string;
    photos: string[];
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
