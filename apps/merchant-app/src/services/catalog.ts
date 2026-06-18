import { supabase } from '../lib/supabase';
import axios from 'axios';

// Phase 9b (2026-06-13) — catalog/inventory writes go through the API
// (POST /merchant/products/save, /merchant/store-products/*), NOT direct
// supabase-js. Lets the StoreProduct/Product/ProductImage write-lockdown revoke
// anon/authenticated writes without breaking product management. Storage uploads
// stay client-side — the caller uploads images first, then passes the URLs here.
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

export interface SaveProductPayload {
    branchId: string;
    product: Record<string, any>;        // Product columns incl. id
    images?: string[];                    // if provided, REPLACES ProductImage for product.id
    storeProducts: Array<{ id?: string; price: number; stock?: number; active?: boolean; variant?: string; is_best_seller?: boolean }>;
    replaceVariants?: boolean;            // delete existing StoreProduct for (productId, branch) first (menu edit)
}

/** Composite save (create or edit) — Product + ProductImage + StoreProduct(s). */
export async function saveProduct(payload: SaveProductPayload): Promise<{ ok: boolean; productId: string }> {
    try {
        const res = await axios.post(`${API_URL}/merchant/products/save`, payload, { headers: await authHeaders() });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to save product. Please check your connection.');
    }
}

/** Update a single StoreProduct (inventory: price/stock/active/...). */
export async function updateStoreProduct(id: string, updates: Record<string, any>): Promise<void> {
    try {
        await axios.patch(`${API_URL}/merchant/store-products/${id}`, updates, { headers: await authHeaders() });
    } catch (e: any) {
        surface(e, 'Failed to update product. Please check your connection.');
    }
}

/** Soft-delete a StoreProduct. */
export async function deleteStoreProduct(id: string): Promise<void> {
    try {
        await axios.delete(`${API_URL}/merchant/store-products/${id}`, { headers: await authHeaders() });
    } catch (e: any) {
        surface(e, 'Failed to delete product. Please check your connection.');
    }
}

/** Bulk-configure existing catalog products for a branch. */
export async function configureStoreProducts(
    branchId: string,
    items: any[],
): Promise<{ ok: boolean; count: number; rehosted?: number; rehostFailed?: number }> {
    try {
        const res = await axios.post(`${API_URL}/merchant/store-products/configure`, { branchId, items }, { headers: await authHeaders() });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to configure products. Please check your connection.');
    }
}

// Phase 4 sub-2 (2026-06-18) — server-paginated master catalog picker.
// GET /merchant/catalog (keyset pagination + server-side filters).

/** A single product row from GET /merchant/catalog. */
export interface CatalogProduct {
    id: string;
    name: string;
    brand: string | null;
    mrp: number;
    image: string | null;
    uom: string | null;
    isVeg: boolean | null;
    vertical: { id: string; name: string; requiresFssai: boolean } | null;
    category: { id: string; name: string } | null;
}

export interface CatalogPage {
    data: CatalogProduct[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface FetchCatalogParams {
    branchId: string;
    cursor?: string | null;
    q?: string;
    verticalId?: string;
    categoryId?: string;
    brand?: string;
    isVeg?: 'true' | 'false';
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
}

/** Fetch a page of the master catalog (server-side filtered + keyset paginated). */
export async function fetchCatalog(params: FetchCatalogParams): Promise<CatalogPage> {
    try {
        // Build query params, omitting empty/undefined ones.
        const query: Record<string, string> = {};
        const add = (key: string, value: unknown) => {
            if (value === undefined || value === null) return;
            const str = String(value).trim();
            if (str === '') return;
            query[key] = str;
        };
        add('branchId', params.branchId);
        add('cursor', params.cursor);
        add('q', params.q);
        add('verticalId', params.verticalId);
        add('categoryId', params.categoryId);
        add('brand', params.brand);
        add('isVeg', params.isVeg);
        add('minPrice', params.minPrice);
        add('maxPrice', params.maxPrice);
        add('limit', params.limit);

        const res = await axios.get(`${API_URL}/merchant/catalog`, {
            headers: await authHeaders(),
            params: query,
        });
        return res.data;
    } catch (e: any) {
        surface(e, 'Failed to load catalog');
    }
}
