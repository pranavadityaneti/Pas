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
