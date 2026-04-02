// @lock — Do NOT overwrite.
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCategories } from '../context/CategoryContext';
import { transformStoreData, TransformedStore } from '../utils/dataTransformer';

/**
 * useStores Hook
 * Fetches and transforms live store data from Supabase.
 * Resolves vertical_id to verticalName using CategoryContext.
 */
export const useStores = () => {
    const [stores, setStores] = useState<TransformedStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { verticals, verticalsLoading } = useCategories();

    const fetchStores = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('Store')
                .select('*, vertical:Vertical(name)')
                .eq('active', true);

            if (fetchError) throw fetchError;

            if (data) {
                const transformed = data.map(row => transformStoreData(row));
                setStores(transformed);
            }
        } catch (err: any) {
            console.error('Error fetching live stores:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [verticals]);

    useEffect(() => {
        // Guard: Wait for CategoryContext to finish loading
        if (verticalsLoading) return;

        // Once categories are ready (either from cache or DB), fetch stores
        fetchStores();
    }, [verticalsLoading, fetchStores]);

    return {
        stores,
        loading: loading || verticalsLoading,
        error,
        refresh: fetchStores,
        diningStores: stores.filter(s => s.isDining),
        pickupStores: stores.filter(s => !s.isDining),
    };
};
