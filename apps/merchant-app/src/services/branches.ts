import { supabase } from '../lib/supabase';
import axios from 'axios';

// Phase 8 (2026-06-11) — branch writes go through the API (Prisma +
// userCanManageMerchant / userCanManageBranchFull), NOT direct supabase-js.
// This is what lets the merchant_branches lockdown migration revoke
// anon/authenticated write grants without breaking branch management.
// Matches the src/services/staff.ts idiom (axios + Bearer from the session).
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// camelCase body the API expects (it maps to Prisma fields).
export interface BranchWritePayload {
    id?: string;
    merchantId?: string;          // required on create
    branchName?: string;
    address?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    managerName?: string | null;
    phone?: string | null;
    isActive?: boolean;
    cuisines?: string[];
    isVeg?: boolean;
    restaurantType?: string | null;
    branchPhotos?: string[];
    // Operational fields (online/offline toggle, store timings, service modes,
    // slot config) — written by StoreContext.toggleStoreStatus / updateStoreDetails.
    email?: string | null;
    operatingHours?: any;
    prepTimeMinutes?: number;
    servicePickup?: boolean;
    serviceDinein?: boolean;
    serviceTableBooking?: boolean;
    slotConfig?: any;
}

// Maps the snake_case partial that StoreContext.updateStoreDetails receives
// from its callers (timings.tsx, slot-config.tsx) to the camelCase API body.
const SNAKE_TO_CAMEL: Record<string, keyof BranchWritePayload> = {
    operating_hours: 'operatingHours',
    prep_time_minutes: 'prepTimeMinutes',
    service_pickup: 'servicePickup',
    service_dinein: 'serviceDinein',
    service_table_booking: 'serviceTableBooking',
    slot_config: 'slotConfig',
    branch_name: 'branchName',
    is_active: 'isActive',
    manager_name: 'managerName',
    restaurant_type: 'restaurantType',
    is_veg: 'isVeg',
    branch_photos: 'branchPhotos',
};

export function toBranchWritePayload(updates: Record<string, any>): BranchWritePayload {
    const out: BranchWritePayload = {};
    for (const [k, v] of Object.entries(updates)) {
        const camel = SNAKE_TO_CAMEL[k] ?? (k as keyof BranchWritePayload);
        (out as any)[camel] = v;
    }
    return out;
}

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('No valid session found. Please log in again.');
    }
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
    };
}

function surface(error: any, fallback: string): never {
    if (error?.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(fallback);
}

/** Create a branch. Returns the created row (snake_case DB shape from Prisma). */
export async function createBranch(payload: BranchWritePayload): Promise<any> {
    try {
        const res = await axios.post(`${API_URL}/merchant/branches`, payload, { headers: await authHeaders() });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to create branch. Please check your connection.');
    }
}

/** Update a branch by id. Returns the updated row. */
export async function updateBranch(id: string, payload: BranchWritePayload): Promise<any> {
    try {
        const res = await axios.put(`${API_URL}/merchant/branches/${id}`, payload, { headers: await authHeaders() });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to update branch. Please check your connection.');
    }
}

/** Delete a branch by id (server also removes its store_staff rows). */
export async function deleteBranch(id: string): Promise<void> {
    try {
        await axios.delete(`${API_URL}/merchant/branches/${id}`, { headers: await authHeaders() });
    } catch (e: any) {
        surface(e, 'Failed to delete branch. Please check your connection.');
    }
}
