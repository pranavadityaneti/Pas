import api from './api';

// Coupons go through the Express API (apps/api) — the coupon engine — NOT Supabase directly.
// The API validates input, dedupes codes, and (consumer-side) handles validate/redeem.
// Field names mirror the API response, which is Prisma camelCase.

export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'BOGO';
export type FundingSource = 'PLATFORM' | 'MERCHANT';
export type TargetAudience = 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS';
// Mirror of CouponTheme in CouponCard.tsx (single source of truth for theme ids).
export type CouponTheme = 'classic' | 'bold' | 'modern' | 'festive';
export type BogoMode = 'CHEAPEST' | 'SAME_PRODUCT';
export type EligibleOrderType = 'pickup' | 'dine-in';
export type CouponStatusFilter = 'active' | 'inactive' | 'archived';

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
    // Phase 1 — schema extensions
    deletedAt: string | null;
    dailyUsageLimit: number | null;
    dailyUsageCount: number;
    dailyUsageResetAt: string | null;
    eligibleVerticals: string[];
    eligibleOrderTypes: string[];
    bogoMode: BogoMode | null;
    inactiveSinceDays: number | null;
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
    // Phase 1 — schema extensions
    dailyUsageLimit?: number | null;
    eligibleVerticals?: string[];
    eligibleOrderTypes?: string[];
    bogoMode?: BogoMode | null;
    inactiveSinceDays?: number | null;
}

// ============================================================================
// Coupon CRUD
// ============================================================================

export async function fetchCoupons(filters?: {
    storeId?: string; isActive?: boolean; fundingSource?: string; search?: string;
    includeArchived?: boolean;
}): Promise<Coupon[]> {
    const { data } = await api.get('/coupons', { params: filters });
    return (data?.data ?? []) as Coupon[];
}

export async function createCoupon(
    input: CreateCouponInput,
    opts?: { idempotencyKey?: string },
): Promise<Coupon> {
    const headers = opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined;
    const { data } = await api.post('/coupon', { ...input, code: input.code.toUpperCase() }, { headers });
    return data as Coupon;
}

export async function updateCoupon(
    id: string,
    updates: Partial<CreateCouponInput> & { isActive?: boolean },
): Promise<Coupon> {
    const { data } = await api.patch(`/coupon/${id}`, updates);
    return data as Coupon;
}

// Phase 2 (2D) — DELETE is now a soft delete. The label in the admin UI is "Archive".
export async function archiveCoupon(id: string): Promise<void> {
    await api.delete(`/coupon/${id}`);
}

// Legacy alias preserved so existing code calling deleteCoupon() keeps working — same behaviour.
export const deleteCoupon = archiveCoupon;

export async function toggleCouponStatus(id: string, isActive: boolean): Promise<Coupon> {
    return updateCoupon(id, { isActive });
}

// ============================================================================
// Phase 3 (3A) — code uniqueness check (debounced from CouponBuilder)
// ============================================================================

export async function checkCodeAvailability(code: string): Promise<{ available: boolean }> {
    const { data } = await api.get('/coupons/check-code', { params: { code } });
    return data as { available: boolean };
}

// ============================================================================
// Phase 3 (3A) — analytics + redemptions ledger + audit log
// ============================================================================

export interface CouponAnalytics {
    coupon: Partial<Coupon> & { id: string; code: string };
    kpis: {
        totalRedemptions: number;
        totalDiscountValue: number;
        platformFundedTotal: number;
        merchantFundedTotal: number;
        uniqueCustomers: number;
        avgDiscountPerOrder: number;
    };
    timeSeries: { date: string; redemptions: number; discount: number }[];
    topStores: { storeId: string; storeName: string | null; count: number }[];
    topUsers: { userId: string; name: string | null; phone: string | null; count: number }[];
    orderTypeBreakdown: Record<string, number>;
}

export interface RedemptionLedgerEntry {
    id: string;
    userId: string;
    orderId: string | null;
    discountAmount: number | null;
    fundingSource: string | null;
    createdAt: string;
    user: { id: string; name: string | null; phone: string | null } | null;
    order: { id: string; orderNumber: string; totalAmount: number; store_name: string | null } | null;
}

export interface Paginated<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function fetchCouponAnalytics(id: string): Promise<CouponAnalytics> {
    const { data } = await api.get(`/admin/coupons/${id}/analytics`);
    return data as CouponAnalytics;
}

export async function fetchCouponRedemptions(
    id: string,
    page = 1,
    limit = 50,
): Promise<Paginated<RedemptionLedgerEntry>> {
    const { data } = await api.get(`/admin/coupons/${id}/redemptions`, { params: { page, limit } });
    return data as Paginated<RedemptionLedgerEntry>;
}

export interface AuditLogEntry {
    id: string;
    actorUserId: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    beforeJson: any;
    afterJson: any;
    createdAt: string;
}

export async function fetchAuditLog(opts?: {
    actionPrefix?: string; page?: number; limit?: number;
}): Promise<Paginated<AuditLogEntry>> {
    const { data } = await api.get('/admin/audit-log', { params: opts });
    return data as Paginated<AuditLogEntry>;
}

// ============================================================================
// Phase 3 (3A) — logo upload to Supabase Storage 'coupons' bucket
// ============================================================================

export async function uploadCouponLogo(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/coupons/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as { url: string };
}
