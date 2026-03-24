import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
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
        category_id?: string;
        subcategory?: string;
        brand?: string;
        description?: string;
        ean?: string;
        uom?: string;
        gstRate?: number;
        createdByStoreId?: string;
    };
}
// ... interface definition ends ...

// Note for next tool call: I will update the query separately to make sure lines match exactly.

export function useInventory() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use the dedicated useStore hook
    const { storeId, loading: storeLoading } = useStore();

    const fetchInventory = useCallback(async () => {
        console.log('[useInventory] fetchInventory called. StoreId:', storeId);
        if (!storeId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('StoreProduct')
                .select(`
                    *,
                    variant, 
                    is_best_seller, 
                    product:Product (
                        name,
                        image,
                        mrp,
                        category_id,
                        subcategory,
                        brand,
                        description,
                        ean,
                        uom,
                        gstRate,
                        createdByStoreId
                    )
                `)
                .eq('storeId', storeId)
                .eq('is_deleted', false)
                .order('updatedAt', { ascending: false })
                .limit(50);

            if (fetchError) {
                console.error('[useInventory] Supabase Error:', JSON.stringify(fetchError, null, 2));
                throw fetchError;
            }

            if (data) {
                setInventory(data as unknown as InventoryItem[]);
            }
        } catch (e: any) {
            console.error('[useInventory] Fetch failed:', e);
            setError(e?.message || 'Failed to load inventory. Check your connection.');
            // DO NOT clear inventory here — preserve last known good data if available
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
            if (subscription) supabase.removeChannel(subscription);
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
        // Store the previous state to revert if the network request fails
        const previousState = [...inventory];
        
        // Optimistic UI update
        setInventory(prev => prev.filter(item => item.id !== id));

        const { error } = await supabase
            .from('StoreProduct')
            .update({ is_deleted: true })
            .eq('id', id);

        if (error) {
            console.error('Delete failed:', error);
            // Revert the UI back to what it was
            setInventory(previousState);
            Alert.alert('Error', error.message || 'Failed to delete the product.');
        }
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
        error,
        refetch,
        updateItem,
        deleteItem,
        toggleStatus,
        storeId // Expose storeId for Catalog Picker
    };
}
