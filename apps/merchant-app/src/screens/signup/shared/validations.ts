/**
 * Per-step validators + regex constants for merchant signup.
 *
 * 2026-06-04 (Phase 1.3b): Extracted from validateStep() in
 * app/(auth)/signup.tsx. The orchestrator in signup.tsx now calls these
 * pure functions and presents `Alert.alert(title, message)` on failure —
 * preserving the EXACT same error titles and messages as before.
 *
 * Behavior preservation rules applied:
 *   - Same fail-fast order within each step
 *   - Same Alert titles ("Error" / "Verification Required" / "Invalid Phone" /
 *     "Invalid Email" / "Invalid PAN" / "Invalid Aadhaar" / "Invalid GSTIN" /
 *     "Invalid FSSAI" / "Required" / "Invalid MSME" / "Invalid Account" /
 *     "Invalid IFSC" / "Location Required" / "Payment Required")
 *   - Same Alert messages (verbatim)
 *   - Same conditional gates (selectedVertical?.requiresFssai, kyc.msmeNumber
 *     optional, hasBranches && branches.length > 0, etc.)
 *
 * Reference: docs/merchant-signup-v2-spec.md (Phase 1 — File restructure).
 */

import type { IdentityState, StoreState, KycState, Branch, Store, Vertical } from './types';

/* ───────────────────────────── Result type ───────────────────────────── */

export type ValidationResult =
    | { ok: true }
    | { ok: false; title: string; message: string };

/* ────────────────────────── Regex constants ──────────────────────────── */

/** Indian 10-digit mobile, must start with 6-9. */
export const PHONE_REGEX = /^[6-9]\d{9}$/;

/** Standard email format check. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Permanent Account Number (PAN), e.g. ABCDE1234F. */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Aadhaar number — exactly 12 digits. */
export const AADHAAR_REGEX = /^\d{12}$/;

/** GSTIN, e.g. 22AAAAA0000A1Z5. */
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** FSSAI license — exactly 14 digits. */
export const FSSAI_REGEX = /^\d{14}$/;

/** MSME / Udyam registration, e.g. UDYAM-XX-00-0000000. */
export const MSME_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

/** Bank account number — 9 to 18 digits. */
export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;

/** IFSC code, e.g. SBIN0001234. */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/* ───────────────────────── Per-step validators ───────────────────────── */

export function validateIdentity(
    identity: IdentityState,
    otpVerified: boolean,
): ValidationResult {
    if (!identity.ownerName || !identity.email || !identity.phone || !identity.designation) {
        return { ok: false, title: 'Error', message: 'Please fill all required fields' };
    }
    if (!otpVerified) {
        return {
            ok: false,
            title: 'Verification Required',
            message: 'Please verify your phone number using the OTP before continuing.',
        };
    }
    if (!PHONE_REGEX.test(identity.phone)) {
        return {
            ok: false,
            title: 'Invalid Phone',
            message: 'Please enter a valid 10-digit Indian mobile number.',
        };
    }
    if (!EMAIL_REGEX.test(identity.email)) {
        return { ok: false, title: 'Invalid Email', message: 'Please enter a valid email address.' };
    }
    return { ok: true };
}

export function validateStore(store: StoreState): ValidationResult {
    if (!store.storeName || !store.categoryId || !store.address) {
        return {
            ok: false,
            title: 'Error',
            message: 'Please enter store name, category and full address',
        };
    }
    return { ok: true };
}

export function validatePhotos(storePhotos: string[]): ValidationResult {
    if (storePhotos.length < 2) {
        return { ok: false, title: 'Error', message: 'Please upload at least 2 store photos' };
    }
    return { ok: true };
}

/**
 * 2026-06-04 (Phase 2.C.1): validateStores — v2 consolidated stores validation.
 * Replaces validateStore + validatePhotos + validateBranches in the v2 flow.
 * Requirements (per spec Step 3):
 *  - At least 1 store
 *  - Each store: name, address, managerName, managerPhone non-empty
 *  - Each store: latitude AND longitude non-null (Google Places must have set them)
 *  - Each store: minimum 2 photos
 */
export function validateStores(
    verticalId: string,
    stores: Store[],
): ValidationResult {
    if (!verticalId) {
        return {
            ok: false,
            title: 'Category Required',
            message: 'Please pick the business category that describes your stores.',
        };
    }
    if (!stores || stores.length === 0) {
        return {
            ok: false,
            title: 'Required',
            message: 'Please add at least one store to continue.',
        };
    }
    for (let i = 0; i < stores.length; i++) {
        const s = stores[i];
        const storeLabel = `Store ${i + 1}`;
        if (!s.name || !s.managerName || !s.managerPhone) {
            return {
                ok: false,
                title: 'Error',
                message: `Please fill name, manager and phone for ${storeLabel}.`,
            };
        }
        if (!s.address) {
            return {
                ok: false,
                title: 'Address Required',
                message: `Please search and select an address for ${storeLabel}.`,
            };
        }
        if (s.latitude === null || s.longitude === null) {
            return {
                ok: false,
                title: 'Location Required',
                message: `Please pick ${storeLabel}'s address from the Google suggestions so we can place it on the map.`,
            };
        }
        if (!s.photos || s.photos.length < 2) {
            return {
                ok: false,
                title: 'Photos Required',
                message: `Please upload at least 2 photos for ${storeLabel}.`,
            };
        }
    }
    return { ok: true };
}

export function validateBranches(
    hasBranches: boolean,
    branches: Branch[],
): ValidationResult {
    if (hasBranches && branches.length > 0) {
        for (let i = 0; i < branches.length; i++) {
            const b = branches[i];
            if (!b.name || !b.manager_name || !b.phone) {
                return {
                    ok: false,
                    title: 'Error',
                    message: `Please fill name, manager and phone for Branch ${i + 1}.`,
                };
            }
            if (b.latitude === null || b.longitude === null) {
                return {
                    ok: false,
                    title: 'Location Required',
                    message: `Please search and select an address for Branch ${i + 1} so it can be placed on the map.`,
                };
            }
        }
    }
    return { ok: true };
}

export function validateKyc(
    kyc: KycState,
    docFiles: { [key: string]: string | null },
    selectedVertical: Vertical | undefined,
): ValidationResult {
    // 2026-06-04 (Phase 2.B): Annual turnover must be explicitly selected.
    // Previously defaulted to '<20L' which silently slotted every merchant
    // into the lowest band; spec mandates user choice before Next.
    if (!kyc.turnoverRange) {
        return {
            ok: false,
            title: 'Required',
            message: 'Please select your annual turnover range.',
        };
    }

    // PAN
    if (!kyc.panNumber || !PAN_REGEX.test(kyc.panNumber)) {
        return {
            ok: false,
            title: 'Invalid PAN',
            message: 'Please enter a valid PAN number (e.g., ABCDE1234F).',
        };
    }
    if (!docFiles.pan) {
        return { ok: false, title: 'Error', message: 'Please upload a PAN card image.' };
    }

    // Aadhaar
    if (!kyc.aadharNumber || !AADHAAR_REGEX.test(kyc.aadharNumber)) {
        return {
            ok: false,
            title: 'Invalid Aadhaar',
            message: 'Aadhaar number must be exactly 12 digits.',
        };
    }
    if (!docFiles.aadharFront || !docFiles.aadharBack) {
        return {
            ok: false,
            title: 'Error',
            message: 'Please upload Aadhaar (Front & Back) images',
        };
    }

    // GST (mandatory for everyone)
    if (!kyc.gstNumber || !GST_REGEX.test(kyc.gstNumber)) {
        return {
            ok: false,
            title: 'Invalid GSTIN',
            message: 'Please enter a valid GSTIN format (e.g., 22AAAAA0000A1Z5).',
        };
    }
    if (!docFiles.gst) {
        return { ok: false, title: 'Error', message: 'Please upload your GST Certificate.' };
    }

    // FSSAI (only if vertical requires it)
    if (selectedVertical?.requiresFssai) {
        if (!kyc.fssaiNumber || !FSSAI_REGEX.test(kyc.fssaiNumber)) {
            return {
                ok: false,
                title: 'Invalid FSSAI',
                message: 'FSSAI License Number must be exactly 14 digits.',
            };
        }
        if (!docFiles.fssai) {
            return { ok: false, title: 'Required', message: 'Please upload your FSSAI License.' };
        }
    }

    // MSME (optional; validate only if entered)
    if (kyc.msmeNumber && !MSME_REGEX.test(kyc.msmeNumber)) {
        return {
            ok: false,
            title: 'Invalid MSME',
            message: 'MSME Number must match format UDYAM-XX-00-0000000.',
        };
    }

    // Banking
    if (!kyc.bankAccount || !BANK_ACCOUNT_REGEX.test(kyc.bankAccount)) {
        return {
            ok: false,
            title: 'Invalid Account',
            message: 'Bank Account must be between 9 to 18 digits.',
        };
    }
    if (!kyc.ifsc || !IFSC_REGEX.test(kyc.ifsc)) {
        return {
            ok: false,
            title: 'Invalid IFSC',
            message: 'IFSC Code must be valid (e.g., SBIN0001234).',
        };
    }
    if (!kyc.beneficiaryName) {
        return { ok: false, title: 'Required', message: 'Please enter Beneficiary Name.' };
    }

    return { ok: true };
}

export function validatePayment(
    paymentStatus: 'idle' | 'success' | 'failed',
): ValidationResult {
    if (paymentStatus !== 'success') {
        return {
            ok: false,
            title: 'Payment Required',
            message: 'Please complete the subscription payment to proceed.',
        };
    }
    return { ok: true };
}
