import { supabase } from './supabaseClient';

// Types matching the Prisma schema
export interface Coupon {
    id: string;
    code: string;
    discount_type: 'PERCENTAGE' | 'FLAT';
    discount_value: number;
    max_discount_cap: number | null;
    funding_source: 'PLATFORM' | 'MERCHANT';
    target_audience: 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS';
    store_id: string | null;
    is_active: boolean;
    usage_limit: number | null;
    used_count: number;
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateCouponInput {
    code: string;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    maxDiscountCap: number | null;
    fundingSource: 'PLATFORM' | 'MERCHANT';
    targetAudience: 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS';
    storeId: string | null;
    usageLimit: number | null;
    startDate: string;
    endDate: string | null;
}

// Fetch all coupons (with optional filters)
export async function fetchCoupons(filters?: { storeId?: string; isActive?: boolean }) {
    let query = supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.storeId) {
        query = query.eq('store_id', filters.storeId);
    }
    if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Fetch coupons error:', error);
        throw error;
    }

    return data as Coupon[];
}

// Create a new coupon
export async function createCoupon(input: CreateCouponInput) {
    const { data, error } = await supabase
        .from('coupons')
        .insert({
            code: input.code.toUpperCase(),
            discount_type: input.discountType,
            discount_value: input.discountValue,
            max_discount_cap: input.maxDiscountCap,
            funding_source: input.fundingSource,
            target_audience: input.targetAudience,
            store_id: input.storeId,
            usage_limit: input.usageLimit,
            start_date: input.startDate || new Date().toISOString(),
            end_date: input.endDate,
        })
        .select()
        .single();

    if (error) {
        console.error('Create coupon error:', error);
        throw error;
    }

    return data as Coupon;
}

// Update an existing coupon
export async function updateCoupon(id: string, updates: Partial<Record<string, any>>) {
    const { data, error } = await supabase
        .from('coupons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Update coupon error:', error);
        throw error;
    }

    return data as Coupon;
}

// Delete a coupon
export async function deleteCoupon(id: string) {
    const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Delete coupon error:', error);
        throw error;
    }
}

// Toggle coupon active status
export async function toggleCouponStatus(id: string, isActive: boolean) {
    return updateCoupon(id, { is_active: isActive });
}
