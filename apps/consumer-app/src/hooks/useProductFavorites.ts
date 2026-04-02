// @lock — Do NOT overwrite.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

/**
 * useProductFavorites Hook
 * Manages user's favorite products with optimistic UI updates and Auth guards.
 */
export const useProductFavorites = () => {
    const { user } = useAuth();
    const [productFavorites, setProductFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Initial Fetch
    const fetchProductFavorites = useCallback(async () => {
        if (!user) {
            setProductFavorites([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('favorite_products')
                .select('store_product_id')
                .eq('user_id', user.id);

            if (error) throw error;
            if (data) {
                setProductFavorites(data.map(f => f.store_product_id));
            }
        } catch (error) {
            console.error('[useProductFavorites] Fetch failed:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProductFavorites();
    }, [fetchProductFavorites]);

    // 2. Toggle Engine with Optimistic UI
    const toggleProductFavorite = async (storeProductId: string) => {
        // --- Auth Guard (Anti-Prop Drilling) ---
        if (!user) {
            // Context does not provide a global modal trigger at this time
            Alert.alert(
                "Login Required",
                "Please log in to save favorite items.",
                [{ text: "OK" }]
            );
            return;
        }

        const isFavorited = productFavorites.includes(storeProductId);
        
        // --- Optimistic Update ---
        const prevFavorites = [...productFavorites];
        if (isFavorited) {
            setProductFavorites(productFavorites.filter(id => id !== storeProductId));
        } else {
            setProductFavorites([...productFavorites, storeProductId]);
        }

        try {
            if (isFavorited) {
                // DELETE
                const { error } = await supabase
                    .from('favorite_products')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('store_product_id', storeProductId);
                
                if (error) throw error;
            } else {
                // INSERT (Upsert as a safety against race conditions)
                const { error } = await supabase
                    .from('favorite_products')
                    .upsert({
                        user_id: user.id,
                        store_product_id: storeProductId
                    });
                
                if (error) throw error;
            }
        } catch (error) {
            console.error('[useProductFavorites] Mutation failed, rolling back:', error);
            // Rollback on failure
            setProductFavorites(prevFavorites);
            Alert.alert("Error", "Could not update product favorites.");
        }
    };

    return {
        productFavorites,
        loading,
        toggleProductFavorite,
        refreshProductFavorites: fetchProductFavorites
    };
};
