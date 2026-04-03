import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLocation } from '../context/LocationContext';

export const useNearbyStores = () => {
    const { activeLocation, isLoadingLocation } = useLocation();
    const [nearbyStoreIds, setNearbyStoreIds] = useState<string[]>([]);
    const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchNearby = async () => {
            if (!activeLocation || !activeLocation.latitude || !activeLocation.longitude) return;
            
            // Wait for GPS to finish polling
            if (isLoadingLocation) return;
            
            // If GPS completely fails, return empty array
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
                    radius_meters: 500000
                });

                console.log('POSTGIS_RAW_PAYLOAD:', data, rpcError);

                if (rpcError) throw rpcError;

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

        return () => {
            isMounted = false;
        };
    }, [activeLocation, activeLocation?.latitude, activeLocation?.longitude, isLoadingLocation]);

    return { nearbyStoreIds, distanceMap, loading: loading || isLoadingLocation, error };
};
