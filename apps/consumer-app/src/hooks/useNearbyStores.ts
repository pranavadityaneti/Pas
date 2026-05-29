import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useLocation } from '../context/LocationContext';

export const useNearbyStores = () => {
    const channelId = useRef(`nearby-stores-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
    const { activeLocation, isLoadingLocation } = useLocation();
    const [nearbyStoreIds, setNearbyStoreIds] = useState<string[]>([]);
    const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchNearby = async () => {
            // Guard 1: GPS still resolving — stay in loading state, don't fire RPC
            if (isLoadingLocation) return;

            // Guard 2: Location resolved but no coordinates (denied/failed)
            // → terminate loading with empty results
            if (!activeLocation?.latitude || !activeLocation?.longitude) {
                if (isMounted) {
                    setNearbyStoreIds([]);
                    setDistanceMap({});
                    setLoading(false);
                }
                return;
            }

            try {
                if (isMounted) {
                    setLoading(true);
                    setError(null);
                }

                // CRITICAL EXECUTE: Native PostGIS geospatial query against live GPS
                const { data, error: rpcError } = await supabase.rpc('get_nearby_stores', {
                    user_lat: activeLocation.latitude,
                    user_lon: activeLocation.longitude,
                    radius_meters: 10000
                });

                console.log('POSTGIS_RAW_PAYLOAD:', data, rpcError);

                if (rpcError) {
                    console.error("RPC FAILED WITH:", JSON.stringify(rpcError, null, 2));
                    throw rpcError;
                }

                if (isMounted) {
                    const ids: string[] = [];
                    const dMap: Record<string, number> = {};
                    (data as any[] || []).forEach(store => {
                        const id = store.id || store.store_id;
                        if (id) {
                            ids.push(id);
                            dMap[id] = store.distance_meters;
                        }
                    });
                    setNearbyStoreIds(ids);
                    setDistanceMap(dMap);
                }
            } catch (err: any) {
                console.error('Error fetching nearby stores:', err);
                if (isMounted) {
                     setError(err.message || 'Failed to fetch proximity data');
                     setNearbyStoreIds([]);
                     setDistanceMap({});
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchNearby();

        const channel = supabase.channel(channelId)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchant_branches' }, (payload) => {
                console.log('Realtime branch update received:', payload);
                if (isMounted) fetchNearby();
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [activeLocation, activeLocation?.latitude, activeLocation?.longitude, isLoadingLocation]);

    return { nearbyStoreIds, distanceMap, loading: loading || isLoadingLocation, error };
};
