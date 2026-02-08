import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';

export interface Store {
    id: string;
    name: string;
    address: string | null;
    image: string | null;
    active: boolean;
}

// Heartbeat interval: 5 minutes
const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

export function useStore() {
    const [store, setStore] = useState<Store | null>(null);
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    // Update merchant heartbeat (is_online + last_active)
    const updateHeartbeat = useCallback(async (isOnline: boolean) => {
        if (!merchantId) return;

        try {
            const { error } = await supabase
                .from('merchants')
                .update({
                    is_online: isOnline,
                    last_active: new Date().toISOString()
                })
                .eq('id', merchantId);

            if (error) {
                console.warn('[useStore] Heartbeat error:', error);
            }
        } catch (e) {
            console.warn('[useStore] Heartbeat exception:', e);
        }
    }, [merchantId]);

    // Start periodic heartbeat
    const startHeartbeat = useCallback(() => {
        // Clear any existing interval
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
        }

        // Send immediate heartbeat
        updateHeartbeat(true);

        // Set up periodic heartbeat
        heartbeatInterval.current = setInterval(() => {
            updateHeartbeat(true);
        }, HEARTBEAT_INTERVAL);
    }, [updateHeartbeat]);

    // Stop heartbeat and mark offline
    const stopHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
        updateHeartbeat(false);
    }, [updateHeartbeat]);

    // Handle app state changes (foreground/background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // App came to foreground
                startHeartbeat();
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                // App went to background
                stopHeartbeat();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription?.remove();
            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
            }
        };
    }, [startHeartbeat, stopHeartbeat]);

    // Fetch store data
    useEffect(() => {
        const fetchStore = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                // First try the Store table (for established stores)
                let { data, error } = await supabase
                    .from('Store')
                    .select('id, name, address, image, active')
                    .eq('managerId', user.id)
                    .maybeSingle();

                if (error) {
                    console.error('[useStore] Fetch error:', error);
                }

                if (data) {
                    setStore(data);
                    // Try to find linked merchant ID
                    const { data: merchantData } = await supabase
                        .from('merchants')
                        .select('id')
                        .eq('email', user.email)
                        .maybeSingle();
                    if (merchantData) {
                        setMerchantId(merchantData.id);
                    }
                } else {
                    // Fallback: Check the 'merchants' table (signup data)
                    const { data: merchantData } = await supabase
                        .from('merchants')
                        .select('id, store_name')
                        .eq('email', user.email)
                        .maybeSingle();

                    if (merchantData) {
                        setMerchantId(merchantData.id);
                        setStore({
                            id: '', // No official ID yet
                            name: merchantData.store_name,
                            address: null,
                            image: null,
                            active: false
                        });
                    }
                }
            } catch (e) {
                console.error('[useStore] Exception:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchStore();
    }, []);

    // Start heartbeat when merchantId is available
    useEffect(() => {
        if (merchantId && AppState.currentState === 'active') {
            startHeartbeat();
        }

        return () => {
            stopHeartbeat();
        };
    }, [merchantId, startHeartbeat, stopHeartbeat]);

    const toggleStoreStatus = async (newStatus: boolean): Promise<boolean> => {
        try {
            if (!store?.id) return false;

            const { error } = await supabase
                .from('Store')
                .update({ active: newStatus })
                .eq('id', store.id);

            if (error) {
                console.error('[useStore] Toggle error:', error);
                return false;
            }

            // Optimistic update
            setStore(prev => prev ? { ...prev, active: newStatus } : null);
            return true;
        } catch (e) {
            console.error('[useStore] Toggle exception:', e);
            return false;
        }
    };

    return {
        store,
        storeId: store?.id || null,
        storeName: store?.name || null,
        merchantId,
        loading,
        error: null,
        toggleStoreStatus,
        // Manual heartbeat controls (for triggering on specific actions)
        sendHeartbeat: () => updateHeartbeat(true),
    };
}
