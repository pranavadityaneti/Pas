import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { navigationRef } from '../navigation/navigationRef';
import { Alert } from 'react-native';

import Constants from 'expo-constants';

export const getApiUrl = () => {
    return process.env.EXPO_PUBLIC_API_URL as string;
};

export const API_URL = getApiUrl();

/**
 * Hardened API Client with Global 401 Interceptor
 */
export const apiClient = {
    fetch: async (endpoint: string, options: any = {}) => {
        const { timeout = 10000, ...fetchOptions } = options;
        
        // 1. Get Auth Token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...fetchOptions.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // 2. Global 401 Interceptor — soft-recovery first; purge only on confirmed permanent failure
            if (response.status === 401) {
                // If we never sent a token, this is server-side auth rejection of an anon request —
                // not our session's problem. Return as-is.
                if (!token) {
                    console.warn('[API] 401 on unauthenticated request — returning as-is');
                    return response;
                }

                console.warn('[API] 401 detected — attempting session refresh before any purge');
                const { data: refreshData, error: refreshError } =
                    await supabase.auth.refreshSession();

                if (!refreshError && refreshData?.session?.access_token) {
                    // Refresh succeeded — retry the original request once with the new token
                    const newToken = refreshData.session.access_token;
                    console.log('[API] Refresh succeeded — retrying original request once');

                    const retryController = new AbortController();
                    const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);
                    try {
                        const retryResponse = await fetch(url, {
                            ...fetchOptions,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${newToken}`,
                                ...fetchOptions.headers,
                            },
                            signal: retryController.signal,
                        });
                        clearTimeout(retryTimeoutId);

                        if (retryResponse.status === 401) {
                            // Refresh worked but server still rejects → session is genuinely dead
                            console.warn('[API] Retry after refresh still 401 — purging session');
                            await purgeAuthSession();
                        }
                        return retryResponse;
                    } catch (retryError: any) {
                        clearTimeout(retryTimeoutId);
                        // Network/timeout on retry — preserve session, return original 401
                        console.warn('[API] Retry after refresh failed transiently — preserving session:', retryError.message);
                        return response;
                    }
                }

                // Refresh itself failed — purge only if it's a permanent auth failure
                const errorMsg = (refreshError?.message || '').toLowerCase();
                const isPermanentFailure =
                    errorMsg.includes('invalid_grant') ||
                    errorMsg.includes('refresh_token_not_found') ||
                    errorMsg.includes('invalid refresh token') ||
                    errorMsg.includes('user_not_found');

                if (isPermanentFailure) {
                    console.warn('[API] Refresh permanently failed — purging session:', errorMsg);
                    await purgeAuthSession();
                } else {
                    // Transient (network, server hiccup) — keep the session, just surface the 401
                    console.warn('[API] Refresh failed transiently — preserving session:', errorMsg || 'unknown');
                }

                return response;
            }

            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Network timeout');
            throw error;
        }
    }
};

/**
 * Purges all cached PII and forces navigation to Auth
 */
export const purgeAuthSession = async () => {
    // Safety wrapper to prevent keychain wipe from freezing the app
    const withTimeout = (promise: Promise<any>, ms = 2000) => 
        Promise.race([
            promise, 
            new Promise((_, ref) => setTimeout(() => ref(new Error('SecureStore Timeout')), ms))
        ]);

    try {
        console.log('[Auth] Global session purge initiated.');
        
        // Purge Secure Cache
        try {
            await withTimeout(SecureStore.deleteItemAsync('last_known_profile'));
        } catch (e: any) {
            console.warn('[Auth] Cache deletion bypassed due to lock:', e.message);
        }

        // Purge Location Cache — prevents stale address from persisting after logout
        try {
            await AsyncStorage.removeItem('pas_last_active_location');
        } catch (e: any) {
            console.warn('[Auth] Location cache purge failed:', e.message);
        }
        
        // Force Supabase SignOut (local)
        await supabase.auth.signOut({ scope: 'local' });

        // Force UI Redirect — land on Main feed (not Auth) since Auth is no longer the root
        if (navigationRef.isReady()) {
            navigationRef.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        }
        
    } catch (err) {
        console.error('[Auth] Error during session purge:', err);
    }
};

// ============================================================================
// Phase 4 (2026-06-09) — typed helper for POST /checkout/validate-coupon.
//
// Centralizes the request/response contract so CouponsScreen + CouponsSection
// use identical shapes. Pairs with Phase 2L's strict server policy: every
// cart item MUST include storeProductId; the server reconciles unit prices
// against StoreProduct.price and signs the resulting discount into a 10-min
// HMAC validationToken. POST /orders verifies the token at order placement.
// ============================================================================

/** Phase 2L strict shape — every cart item MUST have storeProductId. */
export interface ValidateCouponCartItem {
    storeProductId: string;
    quantity: number;
    /** Optional client-side hint, ignored server-side (StoreProduct.price wins). */
    price?: number;
    /** Optional informational fields, ignored server-side. */
    id?: string;
    name?: string;
}

// ============================================================================
// Phase 4 fixes D2 + A2 (2026-06-09) — eligibility helper used by both checkout
// screens at confirmAccepted entry. Centralizes two invariants the adversarial
// audit found missing:
//   D2 — every item in the actual order being placed must have storeProductId
//        (otherwise the server's cartHash recompute will reject after payment
//        once REQUIRE_COUPON_TOKEN=true is flipped);
//   A2 — coupon orders must be single-store until Phase 5 (multi-store discount
//        allocation) is built. Phase 4's per-store POST /orders loop in
//        CheckoutScreen sends the SAME full-cart validationToken to every
//        per-store order; that's the bleed Phase 5 will address. Until then we
//        explicitly reject multi-store coupon orders with a clear user message.
// ============================================================================

export interface CouponOrderEligibility {
    ok: boolean;
    reason?: string;
}

/**
 * Verifies an order being placed is eligible to carry the user's currently
 * applied coupon. Pass the FLAT list of items actually going into POST /orders
 * (per-store flatmap is fine — caller controls scope), plus the current
 * appliedCoupon. If `ok===false`, caller MUST drop the coupon and either
 * abort or re-derive total before charging.
 */
export function checkCouponOrderEligibility(
    orderItems: Array<{ storeProductId?: string | null; storeId?: string | null }>,
    appliedCoupon: { code: string } | null,
): CouponOrderEligibility {
    if (!appliedCoupon) return { ok: true };
    // D2 — strict storeProductId presence on every item in the order.
    const missingId = orderItems.some((it) => !it?.storeProductId);
    if (missingId) {
        return {
            ok: false,
            reason: 'Some items in your cart need to be refreshed before this coupon can be applied. Please refresh your cart and try again.',
        };
    }
    // A2 — multi-store coupon scope-limit until Phase 5 ships allocation.
    // Phase 4 audit re-fix (2026-06-09 evening): use ?? (not ||) for null/undefined
    // detection so a future numeric-zero storeId doesn't collapse silently. Treat
    // missing storeId as a violation, not a silent drop (fail-closed).
    const missingStore = orderItems.some((it) => {
        const s = it?.storeId ?? null;
        return s === null || s === '' || s === undefined;
    });
    if (missingStore) {
        return {
            ok: false,
            reason: 'One or more items in your order are missing store information. Please refresh your cart and try again.',
        };
    }
    const storeIds = new Set(orderItems.map((it) => String(it?.storeId ?? '')));
    if (storeIds.size > 1) {
        return {
            ok: false,
            reason: 'Coupons can only be applied to one store at a time right now. Please remove items from other stores or remove the coupon to continue.',
        };
    }
    return { ok: true };
}

export interface ValidateCouponRequest {
    code: string;
    cartItems: ValidateCouponCartItem[];
    storeIds?: string[];
    orderType?: 'pickup' | 'dining';
    /** Legacy single-store hint — still accepted server-side. */
    storeId?: string;
}

export interface ValidateCouponSuccess {
    valid: true;
    couponId: string;
    code: string;
    discount: number;
    discountType: 'PERCENTAGE' | 'FLAT' | 'BOGO';
    fundingSource: 'PLATFORM' | 'MERCHANT' | null;
    /** Server-signed HMAC — pass back to POST /orders. */
    validationToken: string;
    /** Unix seconds — client-computed: now + 10 min (matches server token.exp). */
    expiresAt: number;
    bogo?: { buy: number; get: number } | null;
}

export interface ValidateCouponFailure {
    valid: false;
    error: string;
    /** HTTP status — useful for distinguishing expired / not-found / limit-hit. */
    status: number;
}

export type ValidateCouponResult = ValidateCouponSuccess | ValidateCouponFailure;

/**
 * Apply a coupon code to the current cart. Caller passes the FULL cartItems[]
 * (every item with storeProductId — Phase 2L strict policy) and the server
 * returns a signed validationToken to use at POST /orders.
 *
 * On any failure (network, 4xx, server-side reject) returns a discriminated
 * { valid: false, error, status } — callers should NOT throw on this; surface
 * the error string to the user.
 */
export async function validateCoupon(req: ValidateCouponRequest): Promise<ValidateCouponResult> {
    try {
        const r = await apiClient.fetch('/checkout/validate-coupon', {
            method: 'POST',
            body: JSON.stringify({
                code: String(req.code || '').toUpperCase(),
                cartItems: req.cartItems,
                storeIds: req.storeIds,
                orderType: req.orderType,
                storeId: req.storeId,
            }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok || !j?.valid) {
            return {
                valid: false,
                error: j?.error || 'This coupon could not be applied.',
                status: r.status,
            };
        }
        // Phase 4 fix C3 (2026-06-09): fail-closed if the server returned a
        // non-string / empty validationToken. The previous String(j.validationToken)
        // coerced null to the string 'null' and let the customer believe the coupon
        // was applied; the POST /orders would then 400 with 'Malformed coupon token'
        // AFTER Razorpay charged. This happens when COUPON_VALIDATION_SECRET is
        // unset on EB (a real interim state during the secret rollout).
        if (typeof j.validationToken !== 'string' || j.validationToken.length === 0) {
            return {
                valid: false,
                error: 'Coupon temporarily unavailable. Please try again shortly.',
                status: r.status,
            };
        }
        // Phase 4 fix C3 (2026-06-09): also defend against unexpected discountType /
        // fundingSource values (e.g. server-side case drift). If either is bogus,
        // refuse the coupon rather than persisting a type-broken AppliedCoupon
        // into CartContext where it would corrupt POST /orders' snapshot columns.
        const VALID_DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT', 'BOGO'] as const;
        const VALID_FUNDING_SOURCES = ['PLATFORM', 'MERCHANT'] as const;
        if (!VALID_DISCOUNT_TYPES.includes(j.discountType)) {
            return {
                valid: false,
                error: 'Coupon response was malformed. Please try again.',
                status: r.status,
            };
        }
        if (j.fundingSource != null && !VALID_FUNDING_SOURCES.includes(j.fundingSource)) {
            return {
                valid: false,
                error: 'Coupon response was malformed. Please try again.',
                status: r.status,
            };
        }
        // Server's token has exp = now + 600s; mirror that client-side so the
        // checkout countdown UX doesn't need to decode the token.
        const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
        return {
            valid: true,
            couponId: String(j.couponId),
            code: String(j.code),
            discount: Number(j.discount) || 0,
            discountType: j.discountType,
            fundingSource: j.fundingSource ?? null,
            validationToken: j.validationToken,
            expiresAt,
            bogo: j.bogo ?? null,
        };
    } catch (err) {
        // Phase 4 fix C3 (2026-06-09): log the real error to console so Sentry
        // (when wired) surfaces actual failure modes during rollout. Previously
        // the bare `catch {}` swallowed everything and reported "Network hiccup"
        // for auth failures, JSON parse failures, etc.
        console.warn('[validateCoupon] request failed:', (err as any)?.message || err);
        return {
            valid: false,
            error: 'Network hiccup. Please try again in a moment.',
            status: 0,
        };
    }
}
