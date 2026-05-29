// @lock — Do NOT overwrite.
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useCategories } from '../context/CategoryContext';
import { transformStoreData, TransformedStore } from '../utils/dataTransformer';

/**
 * useStores Hook
 * Fetches and transforms live store data from Supabase.
 * Resolves vertical_id to verticalName using CategoryContext.
 * Re-evaluates isOpen every 60s so time-based transitions are live.
 */
export const useStores = () => {
    const channelId = useRef(`store-updates-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
    const rawDataRef = useRef<any[]>([]);
    const [stores, setStores] = useState<TransformedStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { verticals, verticalsLoading } = useCategories();

    const fetchStores = useCallback(async () => {
        try {
            setLoading(true);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Supabase Timeout (8s)')), 8000)
            );

            const { data, error: fetchError } = await Promise.race([
                supabase
                    .from('merchant_branches')
                    .select('id, branch_name, address, merchant_id, latitude, longitude, is_active, operating_hours, prep_time_minutes, cuisines, is_veg, restaurant_type, branch_photos, service_table_booking, service_pickup, service_dinein, merchant:merchants(store_photos, cuisines, is_veg, restaurant_type, rating, vertical:Vertical(name))'),
                timeoutPromise
            ]) as any;

            if (fetchError) throw fetchError;

            if (data) {
                rawDataRef.current = data;
                const transformed = data.map((row: any) => transformStoreData(row));
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

        const channel = supabase.channel(channelId)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchant_branches' }, (payload) => {
                console.log('Realtime branch update received:', payload);
                fetchStores();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [verticalsLoading, fetchStores]);

    // Re-evaluate isOpen every 60s using cached raw data.
    // This handles time-based transitions (store opens/closes) without re-fetching.
    // Also re-evaluates when app returns from background.
    useEffect(() => {
        const recomputeOpenStatus = () => {
            if (rawDataRef.current.length === 0) return;
            setStores(rawDataRef.current.map((row: any) => transformStoreData(row)));
        };

        const interval = setInterval(recomputeOpenStatus, 60000);

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                recomputeOpenStatus();
            }
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);

    return {
        stores,
        loading: loading || verticalsLoading,
        error,
        refresh: fetchStores,
        // Vertical gates the category; service mode allows opt-in/out within it.
        // Dining: must be a dining vertical AND have serviceDinein enabled.
        // Pickup: non-dining stores always show; dining stores only if servicePickup enabled.
        diningStores: stores.filter(s => s.isDining && s.serviceDinein),
        pickupStores: stores.filter(s => !s.isDining || s.servicePickup),
    };
};
