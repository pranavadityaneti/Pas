// useGlobalSearch — Debounced Postgres Full-Text + PostGIS Search Hook
// Interfaces with the `search_nearby_inventory` RPC deployed to Supabase.
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface MatchedProduct {
    product_id: string;
    product_name: string;
    brand: string | null;
    image: string | null;
    mrp: number | null;
    price: number | null;
    stock: number | null;
    subcategory: string | null;
    uom: string | null;
    unit_price: number | null;
}

export interface SearchResultStore {
    branch_id: string;
    branch_name: string;
    address: string;
    latitude: number;
    longitude: number;
    is_active: boolean;
    operating_hours: any;
    prep_time_minutes: number | null;
    merchant_id: string;
    store_photos: string[] | null;
    vertical_name: string | null;
    distance_meters: number;
    matched_products: MatchedProduct[];
    store_name_match: boolean;
    service_table_booking?: boolean;
}

const DEBOUNCE_MS = 500;
const SEARCH_RADIUS_METERS = 10000;

export const useGlobalSearch = (
    searchTerm: string,
    userLat: number | undefined,
    userLon: number | undefined,
    verticalFilter: string | null = null
) => {
    const [results, setResults] = useState<SearchResultStore[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<boolean>(false);

    useEffect(() => {
        // Clear any pending debounce on every keystroke
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // If search term is empty, clear results immediately
        const trimmed = searchTerm.trim();
        if (!trimmed) {
            setResults([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        // If GPS coordinates are missing, don't fire
        if (userLat === undefined || userLon === undefined) {
            setError('Location not available');
            return;
        }

        // Show loading state immediately for responsiveness
        setIsLoading(true);
        setError(null);

        // Debounce: wait 500ms after the last keystroke before firing the RPC
        debounceTimer.current = setTimeout(async () => {
            // Guard against stale closures
            abortRef.current = false;

            try {
                console.log(`[useGlobalSearch] Firing RPC: "${trimmed}" @ ${userLat},${userLon} (${SEARCH_RADIUS_METERS}m, filter: ${verticalFilter})`);

                const { data, error: rpcError } = await supabase.rpc('search_nearby_inventory', {
                    search_term: trimmed,
                    user_lat: userLat,
                    user_lon: userLon,
                    radius_meters: SEARCH_RADIUS_METERS,
                    vertical_filter: verticalFilter,
                });

                // If the component unmounted or a new search was fired, discard
                if (abortRef.current) return;

                if (rpcError) {
                    console.error('[useGlobalSearch] RPC Error:', rpcError);
                    setError(rpcError.message);
                    setResults([]);
                    return;
                }

                // The RPC returns a JSON array directly
                const parsed: SearchResultStore[] = Array.isArray(data) ? data : [];
                console.log(`[useGlobalSearch] Got ${parsed.length} store(s), ${parsed.reduce((sum, s) => sum + (s.matched_products?.length || 0), 0)} product match(es)`);
                setResults(parsed);
                setError(null);
            } catch (err: any) {
                if (!abortRef.current) {
                    console.error('[useGlobalSearch] Exception:', err);
                    setError(err.message || 'Search failed');
                    setResults([]);
                }
            } finally {
                if (!abortRef.current) {
                    setIsLoading(false);
                }
            }
        }, DEBOUNCE_MS);

        // Cleanup: abort on unmount or new keystroke
        return () => {
            abortRef.current = true;
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchTerm, userLat, userLon, verticalFilter]);

    // Convenience: flatten all matched products across stores for product-level views
    const allMatchedProducts = results.flatMap(store =>
        (store.matched_products || []).map(product => ({
            ...product,
            store_branch_id: store.branch_id,
            store_name: store.branch_name,
            store_distance: store.distance_meters,
        }))
    );

    return {
        results,
        allMatchedProducts,
        isLoading,
        error,
        hasResults: results.length > 0,
    };
};
