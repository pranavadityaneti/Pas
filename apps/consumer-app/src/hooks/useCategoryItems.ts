import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CategoryItem {
  id: string;
  store_id: string;
  product_id: string;
  price: number;
  stock: number;
  active: boolean;
  product: {
    id: string;
    name: string;
    image: string | null;
    description: string | null;
    vertical_id: string | null;
    mrp: number;
  };
  store: {
    id: string;
    name: string;
  };
}

export function useCategoryItems(storeIds: string[], verticalId: string) {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!storeIds || storeIds.length === 0 || !verticalId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // CRITICAL NESTED JOIN: Restricted payloads only!
      const { data, error: supabaseError } = await supabase
        .from('StoreProduct')
        .select('id, store_id:storeId, product_id:productId, price, stock, active, product:Product!inner(id, name, image, vertical_id, mrp), store:Store(id, name)')
        .in('storeId', storeIds)
        .eq('product.vertical_id', verticalId)
        .eq('active', true);

      if (supabaseError) throw supabaseError;

      setItems((data as any[]) || []);
    } catch (err: any) {
      console.error('Error fetching category items:', err);
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [storeIds, verticalId]);

  return { items, loading, error, refetch: fetchItems };
}
