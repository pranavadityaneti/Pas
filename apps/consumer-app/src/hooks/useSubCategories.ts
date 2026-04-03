import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SubCategory {
    id: string;
    name: string;
    image: string | null;
    vertical_id: string;
    active: boolean;
}

/**
 * useSubCategories Hook
 * Fetches live sub-categories from the `Tier2Category` table for a given vertical.
 * @param verticalId The UUID of the parent Vertical
 */
export const useSubCategories = (verticalId: string | null) => {
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSubCategories = useCallback(async () => {
        if (!verticalId) {
            setSubCategories([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('Tier2Category')
                .select('*')
                .eq('vertical_id', verticalId)
                .eq('active', true)
                .order('name', { ascending: true });

            if (fetchError) throw fetchError;

            if (data) {
                setSubCategories(data);
            }
        } catch (err: any) {
            console.error('Error fetching sub-categories:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [verticalId]);

    useEffect(() => {
        fetchSubCategories();
    }, [fetchSubCategories]);

    return {
        subCategories,
        loading,
        error,
        refresh: fetchSubCategories,
    };
};
