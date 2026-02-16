import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types matched to existing useStore
export interface Store {
    id: string;
    name: string;
    address: string | null;
    image: string | null;
    active: boolean;
    operating_hours?: any;
}

interface StoreContextType {
    store: Store | null;
    merchantId: string | null;
    loading: boolean;
    toggleStoreStatus: (newStatus: boolean) => Promise<{ success: boolean; error?: string }>;
    refreshStore: () => Promise<void>;
    updateStoreDetails: (updates: Partial<Store>) => Promise<{ success: boolean; error?: string }>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CACHE_KEY = 'cached_store_state';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
    const [store, setStore] = useState<Store | null>(null);
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const retryTimeout = useRef<NodeJS.Timeout | null>(null);
    const retryCount = useRef(0);

    // Heartbeat logic constants
    const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

    // --- Heartbeat Logic ---
    const updateHeartbeat = useCallback(async (isOnline: boolean) => {
        if (!merchantId) return;
        try {
            const { error } = await supabase
                .from('merchants')
                .update({ is_online: isOnline, last_active: new Date().toISOString() })
                .eq('id', merchantId);
            if (error) console.warn('[StoreContext] Heartbeat error:', error);
        } catch (e) {
            console.warn('[StoreContext] Heartbeat exception:', e);
        }
    }, [merchantId]);

    const startHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
        updateHeartbeat(true);
        heartbeatInterval.current = setInterval(() => updateHeartbeat(true), HEARTBEAT_INTERVAL);
    }, [updateHeartbeat]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
        updateHeartbeat(false);
    }, [updateHeartbeat]);

    // App State Listener (Foreground/Background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                startHeartbeat();
                // Also refresh store data when coming to foreground
                fetchStore();
            } else if (nextAppState.match(/inactive|background/)) {
                stopHeartbeat();
            }
        };
        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            sub.remove();
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
        };
    }, [startHeartbeat, stopHeartbeat]);

    // Start heartbeat when merchantId is loaded
    useEffect(() => {
        if (merchantId && AppState.currentState === 'active') {
            startHeartbeat();
        }
    }, [merchantId]);

    // --- Data Fetching ---
    const fetchStore = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('[StoreContext] No auth user yet, will retry on auth state change');
                setLoading(false);
                return;
            }

            // 1. Fetch Store
            console.log('[StoreContext] Fetching store for user:', user.id, user.email);

            let { data: storeData, error: storeError } = await supabase
                .from('Store')
                .select('id, name, address, image, active, operating_hours, managerId')
                .eq('managerId', user.id)
                .maybeSingle();

            if (storeError) console.error('[StoreContext] Store fetch error:', storeError);
            if (storeData) console.log('[StoreContext] Store found:', storeData.id);
            else console.log('[StoreContext] No store found for managerId:', user.id);

            // 2. Fetch Merchant ID (for heartbeat)
            const { data: merchantData } = await supabase
                .from('merchants')
                .select('id, store_name')
                .eq('email', user.email)
                .maybeSingle();

            if (merchantData) {
                console.log('[StoreContext] Merchant found by email:', merchantData.id);
                if (merchantData.id !== user.id) {
                    console.warn('[StoreContext] MISMATCH: Merchant ID != Auth ID');
                }
                setMerchantId(merchantData.id);
            } else {
                console.log('[StoreContext] No merchant row found for email:', user.email);
            }

            if (storeData && storeData.id) {
                // Valid store with real ID — cache it and set state
                setStore(storeData);
                retryCount.current = 0; // Reset retry counter on success
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(storeData));
                console.log('[StoreContext] Store cached successfully with ID:', storeData.id);
            } else if (merchantData) {
                console.log('[StoreContext] No Store row found, using fallback (empty ID)');
                // Fallback for new merchants without Store row yet
                const fallbackStore = {
                    id: '',
                    name: merchantData.store_name,
                    address: null,
                    image: null,
                    active: false,
                    operating_hours: null
                };
                setStore(fallbackStore);

                // DO NOT cache fallback stores — they have empty IDs and will cause
                // "Store ID Unavailable" errors if loaded from cache on next restart
                await AsyncStorage.removeItem(CACHE_KEY);
                console.log('[StoreContext] Cleared cache — fallback store should not be cached');

                // Retry: the Store row might be created shortly after merchant signup
                if (retryCount.current < MAX_RETRY_ATTEMPTS) {
                    retryCount.current += 1;
                    console.log(`[StoreContext] Scheduling retry ${retryCount.current}/${MAX_RETRY_ATTEMPTS} in ${RETRY_DELAY_MS}ms`);
                    if (retryTimeout.current) clearTimeout(retryTimeout.current);
                    retryTimeout.current = setTimeout(() => {
                        fetchStore();
                    }, RETRY_DELAY_MS);
                } else {
                    console.warn('[StoreContext] Max retries reached — store row may not exist yet');
                }
            } else {
                // No merchant data at all — clear any stale cache
                await AsyncStorage.removeItem(CACHE_KEY);
            }
        } catch (e) {
            console.error('[StoreContext] Fetch exception:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- Initial Load: Read cache, then fetch live data ---
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached && mounted) {
                    const parsedCache = JSON.parse(cached);
                    // Only use cache if it has a valid (non-empty) store ID
                    if (parsedCache?.id) {
                        setStore(parsedCache);
                        console.log('[StoreContext] Loaded valid cache with ID:', parsedCache.id);
                    } else {
                        console.log('[StoreContext] Ignoring stale cache with empty ID');
                        await AsyncStorage.removeItem(CACHE_KEY);
                    }
                }
            } catch (e) {
                console.error('[StoreContext] Cache read error:', e);
            }

            if (mounted) {
                await fetchStore();
            }
        };

        init();

        return () => {
            mounted = false;
            if (retryTimeout.current) clearTimeout(retryTimeout.current);
        };
    }, []);

    // --- Auth State Change Listener ---
    // Re-fetch store when auth session becomes available (critical for Android
    // where session restoration from secure storage may be slower)
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[StoreContext] Auth state changed:', event);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Session is now available — fetch store data
                retryCount.current = 0; // Reset retries on fresh auth
                fetchStore();
            } else if (event === 'SIGNED_OUT') {
                setStore(null);
                setMerchantId(null);
                AsyncStorage.removeItem(CACHE_KEY);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [fetchStore]);

    // --- Realtime Subscription ---
    useEffect(() => {
        if (!store?.id) return;

        const channel = supabase.channel(`store_${store.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Store',
                    filter: `id=eq.${store.id}`
                },
                (payload) => {
                    // 1. Merge payload (Fast)
                    setStore(prev => prev ? { ...prev, ...payload.new } : null);

                    // 2. Fetch latest authority (Robust)
                    fetchStore();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [store?.id]);

    // --- Actions ---
    const toggleStoreStatus = async (newStatus: boolean): Promise<{ success: boolean; error?: string }> => {
        if (!store?.id) {
            console.error('[StoreContext] No store ID found in context, attempting re-fetch...');
            // Instead of immediately failing, try one more fetch
            await fetchStore();
            // Check again after re-fetch
            if (!store?.id) {
                return { success: false, error: 'Store ID unavailable. Please try again or contact support.' };
            }
        }
        try {
            // Optimistic update
            const oldStatus = store.active;
            setStore(prev => prev ? { ...prev, active: newStatus } : null);

            const { error } = await supabase
                .from('Store')
                .update({ active: newStatus })
                .eq('id', store.id);

            if (error) {
                console.error('[StoreContext] Toggle error:', error);
                // Revert
                setStore(prev => prev ? { ...prev, active: oldStatus } : null);
                fetchStore();
                return { success: false, error: error.message || 'Database update failed' };
            }
            return { success: true };
        } catch (e: any) {
            console.error('[StoreContext] Toggle exception:', e);
            return { success: false, error: e.message || 'Unknown error occurred' };
        }
    };

    const updateStoreDetails = async (updates: Partial<Store>): Promise<{ success: boolean; error?: string }> => {
        if (!store?.id) return { success: false, error: 'Store not found' };

        // 1. Optimistic Update
        const previousStore = store;
        const newStore = { ...store, ...updates };
        setStore(newStore);

        try {
            // 2. DB Update
            const { data, error } = await supabase
                .from('Store')
                .update(updates)
                .eq('id', store.id)
                .select();

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('[StoreContext] Update failed:', error);
            // 3. Revert on failure
            setStore(previousStore);
            return { success: false, error: error.message };
        }
    };

    return (
        <StoreContext.Provider value={{ store, merchantId, loading, toggleStoreStatus, refreshStore: fetchStore, updateStoreDetails }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStoreContext() {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error('useStoreContext must be used within a StoreProvider');
    }
    return context;
}
