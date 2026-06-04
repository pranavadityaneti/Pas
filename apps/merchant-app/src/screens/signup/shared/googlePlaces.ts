/**
 * googlePlaces — shared Google Maps / Places constants and helpers for the
 * merchant signup flow.
 *
 * 2026-06-04 (Phase 1.7.H): Hoisted from the inline duplicates that lived
 * in StepStore.tsx (Step 2 address autocomplete) and StepBranches.tsx
 * (Step 4 per-branch address autocomplete) — both copies were identical.
 *
 * The API key is read from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY with a
 * fallback to the same hard-coded value that has lived in signup.tsx for
 * months. NOT recommended to ship a different key on prod — manage it
 * via the env var, not by editing this file.
 */

/** Google Maps + Places API key used for autocomplete + map tiles. */
export const GOOGLE_MAPS_API_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyAQAg7zpYvmd2BJGCGmf1opDLDC4KXbKUg';

/** Pull `locality` (city) out of Google's address_components shape. */
export function extractCity(details: any): string {
    const component = details?.address_components?.find((c: any) =>
        c.types.includes('locality'),
    );
    return component?.long_name || '';
}
