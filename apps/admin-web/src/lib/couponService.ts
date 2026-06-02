import api from './api';

// Coupons go through the Express API (apps/api) — the coupon engine — NOT Supabase directly.
// The API validates input, dedupes codes, and (consumer-side) handles validate/redeem.
// Field names mirror the API response, which is Prisma camelCase.

export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'BOGO';
export type FundingSource = 'PLATFORM' | 'MERCHANT';
export type TargetAudience = 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS';
// Mirror of CouponTheme in CouponCard.tsx (single source of truth for theme ids).
// The API persists this as a single string column on `coupons.theme`.
export type CouponTheme = 'classic' | 'bold' | 'modern' | 'festive';

export interface Coupon {
    id: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    maxDiscountCap: number | null;
    fundingSource: FundingSource;
    targetAudience: TargetAudience;
    storeId: string | null;
    isActive: boolean;
    usageLimit: number | null;
    usedCount: number;
    startDate: string;
    endDate: string | null;
    // Coupon-engine fields (design: docs/coupon-feature-spec.md)
    minOrder: number | null;
    perCustomerLimit: number | null;
    bogoBuy: number | null;
    bogoGet: number | null;
    title: string | null;
    brandName: string | null;
    description: string | null;
    showLogo: boolean;
    logoUrl: string | null;
    autoCode: boolean;
    theme: CouponTheme;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCouponInput {
    code: string;
    discountType: DiscountType;
    discountValue?: number;
    maxDiscountCap?: number | null;
    fundingSource: FundingSource;
    targetAudience: TargetAudience;
    storeId?: string | null;
    usageLimit?: number | null;
    startDate?: string;
    endDate?: string | null;
    minOrder?: number | null;
    perCustomerLimit?: number | null;
    bogoBuy?: number | null;
    bogoGet?: number | null;
    title?: string | null;
    brandName?: string | null;
    description?: string | null;
    showLogo?: boolean;
    logoUrl?: string | null;
    autoCode?: boolean;
    theme?: CouponTheme;
}

// Fetch coupons (optional filters: storeId, isActive, fundingSource, search)
export async function fetchCoupons(filters?: {
    storeId?: string; isActive?: boolean; fundingSource?: string; search?: string;
}): Promise<Coupon[]> {
    const { data } = await api.get('/coupons', { params: filters });
    return (data?.data ?? []) as Coupon[];
}

// Create a coupon (API enforces code uniqueness + BOGO/discountValue rules)
export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
    const { data } = await api.post('/coupon', { ...input, code: input.code.toUpperCase() });
    return data as Coupon;
}

// Update a coupon (partial; the API whitelists editable fields)
export async function updateCoupon(
    id: string,
    updates: Partial<CreateCouponInput> & { isActive?: boolean }
): Promise<Coupon> {
    const { data } = await api.patch(`/coupon/${id}`, updates);
    return data as Coupon;
}

// Delete a coupon
export async function deleteCoupon(id: string): Promise<void> {
    await api.delete(`/coupon/${id}`);
}

// Toggle active status
export async function toggleCouponStatus(id: string, isActive: boolean): Promise<Coupon> {
    return updateCoupon(id, { isActive });
}
