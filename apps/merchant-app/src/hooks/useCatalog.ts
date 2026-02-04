import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Product {
    id: string;
    name: string;
    description?: string;
    mrp: number;
    image: string | null;
    category: string;
    brand?: string;
    ean?: string;
    gstRate?: number;
    inStock?: boolean; // Local state for now
}

export function useCatalog() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('Product') // Note: Case sensitive table name
                .select('*')
                .order('name');

            if (error) throw error;

            if (data) {
                // Map DB fields to UI fields if necessary, or just use as is
                // Adding 'inStock' as true by default for now (since we don't have inventory linking yet)
                const mapped: Product[] = data.map((p: any) => ({
                    ...p,
                    inStock: true
                }));
                setProducts(mapped);
            }
        } catch (err: any) {
            console.error('Error fetching catalog:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return { products, loading, error, refetch: fetchProducts };
}
