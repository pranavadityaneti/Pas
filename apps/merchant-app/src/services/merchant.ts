import { supabase } from '../lib/supabase';
import axios from 'axios';

// Phase 9a (2026-06-13) — merchant profile + payout writes go through the API
// (PATCH /merchant/profile, PUT /merchant/payout), NOT direct supabase-js.
// This is what lets the merchants/Store write-lockdown revoke anon/authenticated
// write grants without breaking these screens. Matches the services/branches.ts
// idiom (axios + Bearer from the session). Bodies are snake_case to match the
// API's whitelist (these tables have snake_case columns).
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No valid session found. Please log in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

function surface(error: any, fallback: string): never {
    if (error?.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(fallback);
}

export interface StoreProfilePayload {
    name?: string;
    address?: string | null;
    cuisines?: string[];
    is_veg?: boolean;
    restaurant_type?: string | null;
}

/** Update store profile (Settings → Store Details): Store name/address + dining fields. */
export async function updateStoreProfile(merchantId: string, payload: StoreProfilePayload): Promise<void> {
    try {
        await axios.patch(`${API_URL}/merchant/profile/${merchantId}`, payload, { headers: await authHeaders() });
    } catch (e: any) {
        surface(e, 'Failed to update store details. Please check your connection.');
    }
}

export interface PayoutPayload {
    bank_account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    bank_beneficiary_name?: string;
    bank_accounts?: any;
}

/** Update payout/bank details (Settings → Payouts). Returns the updated merchant row. */
export async function updatePayout(merchantId: string, payload: PayoutPayload): Promise<any> {
    try {
        const res = await axios.put(`${API_URL}/merchant/payout/${merchantId}`, payload, { headers: await authHeaders() });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to update payout details. Please check your connection.');
    }
}
