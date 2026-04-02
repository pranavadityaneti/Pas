// @lock — Do NOT overwrite.
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  image: string;
  price: number;
  mrp: number;
  stock: number;
  uom: string;
  subCategory: string;
  isVeg: boolean;
  isBestseller: boolean;
  rating: string;
  discount: number;
}

/**
 * useProducts Hook
 * Fetches and transforms live product data for a specific store from Supabase.
 * Joins StoreProduct with the Master Catalog Product table.
 * @param storeId The UUID of the store
 */
export const useProducts = (storeId: string | null) => {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        if (!storeId) return;
        
        try {
            setLoading(true);
            setError(null);
            
            // Supabase Join Query: StoreProduct -> Product
            const { data, error: fetchError } = await supabase
                .from('StoreProduct')
                .select(`
                    id,
                    price,
                    stock,
                    is_best_seller,
                    variant,
                    product:Product (
                        id,
                        name,
                        description,
                        image,
                        mrp,
                        uom,
                        subcategory,
                        avg_rating,
                        extra_data
                    )
                `)
                .eq('storeId', storeId)
                .eq('active', true);

            if (fetchError) throw fetchError;

            if (data) {
                const transformed: ProductItem[] = data.map((item: any) => {
                    const p = item.product;
                    const mrp = p.mrp || item.price;
                    const discount = mrp > item.price ? Math.round(((mrp - item.price) / mrp) * 100) : 0;
                    
                    return {
                        id: item.id, // We use the StoreProduct ID for uniqueness in cart
                        name: p.name || 'Unknown Product',
                        description: p.description || null,
                        image: p.image || 'https://images.unsplash.com/photo-1542838132-92c53300491?w=400',
                        price: item.price,
                        mrp: mrp,
                        stock: item.stock || 0,
                        uom: p.uom || '1 Pc',
                        subCategory: p.subcategory || 'Other',
                        // Logic for dietary/metadata from extra_data if needed, or defaults
                        isVeg: p.extra_data?.isVeg ?? true, 
                        isBestseller: item.is_best_seller || false,
                        rating: p.avg_rating ? String(p.avg_rating) : '4.2',
                        discount: discount
                    };
                });
                setProducts(transformed);
            }
        } catch (err: any) {
            console.error('Error fetching live products:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return {
        products,
        loading,
        error,
        refresh: fetchProducts
    };
};
