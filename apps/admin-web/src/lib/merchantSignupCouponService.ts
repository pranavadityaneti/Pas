import api from './api';

// 2026-06-04 (Phase 2.E2): Merchant signup coupon admin service. Mirrors the
// pattern from couponService.ts (consumer coupons) — calls the Express API,
// not Supabase directly. Field names are Prisma camelCase from the server.

export type CouponTier = 'standard' | 'premium' | null;

export interface MerchantSignupCoupon {
    id: string;
    code: string;
    /** Flat ₹ discount applied to the per-store total. */
    discountInr: number;
    /** null = unlimited uses. */
    maxUses: number | null;
    /** Bumped atomically inside the PATCH /auth/merchant/draft finalize transaction. */
    usedCount: number;
    /** null = applies to both Standard and Premium tiers. */
    appliesToTier: CouponTier;
    /** ISO timestamp; null = never expires. */
    expiresAt: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    /** Distinct merchants who have redeemed this coupon. */
    redemptionCount: number;
}

export interface MerchantSignupCouponRedemption {
    id: string;
    merchantId: string;
    codeSnapshot: string;
    amountInr: number;
    appliedAt: string;
    merchant: {
        id: string;
        storeName: string | null;
        ownerName: string | null;
        phone: string | null;
        email: string | null;
        status: string | null;
        createdAt: string | null;
    } | null;
}

export interface CreateMerchantSignupCouponInput {
    code: string;
    discountInr: number;
    maxUses?: number | null;
    appliesToTier?: CouponTier;
    expiresAt?: string | null;
    isActive?: boolean;
}

export interface UpdateMerchantSignupCouponInput {
    isActive?: boolean;
    maxUses?: number | null;
    expiresAt?: string | null;
    appliesToTier?: CouponTier;
}

const BASE = '/admin/merchant-signup-coupons';

export async function listMerchantSignupCoupons(): Promise<MerchantSignupCoupon[]> {
    const res = await api.get(BASE);
    return res.data as MerchantSignupCoupon[];
}

export async function createMerchantSignupCoupon(
    input: CreateMerchantSignupCouponInput,
): Promise<MerchantSignupCoupon> {
    const res = await api.post(BASE, input);
    return res.data as MerchantSignupCoupon;
}

export async function updateMerchantSignupCoupon(
    id: string,
    input: UpdateMerchantSignupCouponInput,
): Promise<MerchantSignupCoupon> {
    const res = await api.patch(`${BASE}/${id}`, input);
    return res.data as MerchantSignupCoupon;
}

export async function listMerchantSignupCouponRedemptions(
    couponId: string,
): Promise<MerchantSignupCouponRedemption[]> {
    const res = await api.get(`${BASE}/${couponId}/redemptions`);
    return res.data as MerchantSignupCouponRedemption[];
}
