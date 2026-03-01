import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from './useStore';

export interface InventoryItem {
    id: string; // StoreProduct ID
    storeId: string;
    productId: string;
    stock: number;
    price: number;
    active: boolean;
    variant: string;
    is_best_seller: boolean; // Added real field
    product: {
        name: string;
        image: string;
        mrp: number;
        category: string;
        brand?: string;
    };
}
// ... interface definition ends ...

// Note for next tool call: I will update the query separately to make sure lines match exactly.

export function useInventory() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Use the dedicated useStore hook
    const { storeId, loading: storeLoading } = useStore();

    const fetchInventory = useCallback(async () => {
        console.log('[useInventory] fetchInventory called. StoreId:', storeId);
        if (!storeId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('StoreProduct')
                .select(`
                    *,
                    variant, 
                    is_best_seller, 
                    product:Product (
                        name,
                        image,
                        mrp,
                        category,
                        brand
                    )
                `)
                // CRITICAL: Ensure 'variant' and 'is_best_seller' are selected above.
                // Missing these will cause silent failures in the UI.
                .eq('storeId', storeId)
                .order('updatedAt', { ascending: false });

            if (error) {
                console.error('[useInventory] Supabase Error:', JSON.stringify(error, null, 2));
                throw error;
            }

            if (data) {
                setInventory(data as unknown as InventoryItem[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [storeId]);

    // Initial load when storeId is available
    useEffect(() => {
        if (storeLoading) return;

        let subscription: any;

        if (storeId) {
            fetchInventory();

            // Subscribe to real-time changes for this store's inventory
            subscription = supabase
                .channel(`inventory-${storeId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'StoreProduct',
                    filter: `storeId=eq.${storeId}`
                }, () => {
                    // Refetch to get the latest data including joined Product details
                    fetchInventory();
                })
                .subscribe();
        } else {
            setLoading(false);
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [storeId, storeLoading, fetchInventory]);


    const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
        // Optimistic Update
        setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));

        const { error } = await supabase
            .from('StoreProduct')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Update failed:', error);
            // Revert or fetch? For now log error.
            fetchInventory();
        }
    };

    const deleteItem = async (id: string) => {
        // Optimistic
        setInventory(prev => prev.filter(item => item.id !== id));

        const { error } = await supabase
            .from('StoreProduct')
            .delete()
            .eq('id', id);

        if (error) fetchInventory();
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        updateItem(id, { active: !currentStatus });
    };

    // CRITICAL: refetch must be memoized with useCallback.
    // Passing a raw function to the dependency array of a useEffect (like in InventoryScreen) 
    // will cause infinite loops or stale closures if not memoized.
    // will cause infinite loops or stale closures if not memoized.
    const refetch = useCallback(() => {
        setRefreshing(true);
        fetchInventory();
    }, [fetchInventory]);

    return {
        inventory,
        loading,
        refreshing,
        refetch,
        updateItem,
        deleteItem,
        toggleStatus,
        storeId // Expose storeId for Catalog Picker
    };
}
