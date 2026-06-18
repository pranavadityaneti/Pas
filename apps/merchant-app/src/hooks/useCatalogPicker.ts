// Phase 4 sub-2 (2026-06-18) — keyset-paginated master catalog picker.
// Manages cursor pagination + server-side filters for GET /merchant/catalog.
// A monotonically-increasing reqId guards against stale responses clobbering
// state when filters change mid-flight.
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCatalog, CatalogProduct, FetchCatalogParams } from '../services/catalog';

export interface CatalogFilters {
    q?: string;
    verticalId?: string;
    categoryId?: string;
    brand?: string;
    isVeg?: 'true' | 'false';
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
}

interface CatalogPickerState {
    rows: CatalogProduct[];
    hasMore: boolean;
    isLoading: boolean;
    error: string | null;
}

export function useCatalogPicker(branchId: string | null) {
    const [rows, setRows] = useState<CatalogProduct[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cursorRef = useRef<string | null>(null);
    const filtersRef = useRef<CatalogFilters>({});
    const reqIdRef = useRef(0);
    const loadingRef = useRef(false);

    const fetchPage = useCallback(async (reset: boolean) => {
        if (!branchId) {
            // No active branch — clear everything, no-op fetch.
            setRows([]);
            setHasMore(false);
            setIsLoading(false);
            setError(null);
            cursorRef.current = null;
            return;
        }

        // A newer request supersedes older in-flight ones.
        const reqId = ++reqIdRef.current;
        if (reset) cursorRef.current = null;

        loadingRef.current = true;
        setIsLoading(true);
        setError(null);

        const f = filtersRef.current;
        const params: FetchCatalogParams = {
            branchId,
            cursor: reset ? null : cursorRef.current,
            q: f.q,
            verticalId: f.verticalId,
            categoryId: f.categoryId,
            brand: f.brand,
            isVeg: f.isVeg,
            minPrice: f.minPrice,
            maxPrice: f.maxPrice,
            limit: f.limit,
        };

        try {
            const page = await fetchCatalog(params);
            // Ignore stale responses (a newer request started after this one).
            if (reqId !== reqIdRef.current) return;
            setRows(prev => (reset ? page.data : [...prev, ...page.data]));
            cursorRef.current = page.nextCursor;
            setHasMore(page.hasMore);
        } catch (e: any) {
            if (reqId !== reqIdRef.current) return;
            setError(e?.message || 'Failed to load catalog');
            if (reset) {
                setRows([]);
                setHasMore(false);
            }
        } finally {
            if (reqId === reqIdRef.current) {
                loadingRef.current = false;
                setIsLoading(false);
            }
        }
    }, [branchId]);

    const setFilters = useCallback((next: CatalogFilters) => {
        filtersRef.current = next;
        cursorRef.current = null;
        fetchPage(true);
    }, [fetchPage]);

    const loadMore = useCallback(() => {
        if (loadingRef.current) return;
        if (!hasMore) return;
        fetchPage(false);
    }, [fetchPage, hasMore]);

    const reload = useCallback(() => {
        fetchPage(true);
    }, [fetchPage]);

    // Reset + load whenever the active branch changes.
    useEffect(() => {
        fetchPage(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const state: CatalogPickerState = { rows, hasMore, isLoading, error };
    return { ...state, loadMore, setFilters, reload };
}
