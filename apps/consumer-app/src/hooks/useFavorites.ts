// @lock — Do NOT overwrite.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

/**
 * useFavorites Hook
 * Manages user's favorite stores with optimistic UI updates and Auth guards.
 * @param onAuthRequired Optional callback to trigger a login modal/prompt
 */
export const useFavorites = (onAuthRequired?: () => void) => {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Initial Fetch
    const fetchFavorites = useCallback(async () => {
        if (!user) {
            setFavorites([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('favorite_stores')
                .select('store_id')
                .eq('user_id', user.id);

            if (error) throw error;
            if (data) {
                setFavorites(data.map(f => f.store_id));
            }
        } catch (error) {
            console.error('[useFavorites] Fetch failed:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    // 2. Toggle Engine with Optimistic UI
    const toggleFavorite = async (storeId: string) => {
        // --- Auth Guard ---
        if (!user) {
            if (onAuthRequired) {
                onAuthRequired();
            } else {
                Alert.alert(
                    "Login Required",
                    "Please log in to save your favorite stores.",
                    [{ text: "OK" }]
                );
            }
            return;
        }

        const isFavorited = favorites.includes(storeId);
        
        // --- Optimistic Update ---
        const prevFavorites = [...favorites];
        if (isFavorited) {
            setFavorites(favorites.filter(id => id !== storeId));
        } else {
            setFavorites([...favorites, storeId]);
        }

        try {
            if (isFavorited) {
                // DELETE
                const { error } = await supabase
                    .from('favorite_stores')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('store_id', storeId);
                
                if (error) throw error;
            } else {
                // INSERT (Upsert as a safety against race conditions)
                const { error } = await supabase
                    .from('favorite_stores')
                    .upsert({
                        user_id: user.id,
                        store_id: storeId
                    });
                
                if (error) throw error;
            }
        } catch (error) {
            console.error('[useFavorites] Mutation failed, rolling back:', error);
            // Rollback on failure
            setFavorites(prevFavorites);
            Alert.alert("Error", "Could not update favorites. Please try again.");
        }
    };

    return {
        favorites,
        loading,
        toggleFavorite,
        refreshFavorites: fetchFavorites
    };
};
