import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Store {
    id: string;
    name: string;
    address: string | null;
    image: string | null;
    active: boolean;
}

export function useStore() {
    const [store, setStore] = useState<Store | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStore = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

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
                } else {
                    // Fallback: Check the 'merchants' table (signup data)
                    const { data: merchantData } = await supabase
                        .from('merchants')
                        .select('store_name')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (merchantData) {
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

    return {
        store,
        storeId: store?.id || null,
        storeName: store?.name || null,
        loading,
        error: null
    };
}
