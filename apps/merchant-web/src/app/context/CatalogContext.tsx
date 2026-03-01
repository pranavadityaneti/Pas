import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { supabase } from '../../lib/supabaseClient';

// Product Interface
export interface Product {
  id: string;
  name: string;
  desc: string;
  img: string;
  mrp: number;
  sellingPrice: number;
  discountValue: number;
  discountType: 'PERCENT' | 'FLAT';
  isActive: boolean;
  stockQty: number;
  category?: string;
  rating?: number;
  isBestSeller?: boolean;
}

export interface GlobalProduct {
  id: string;
  name: string;
  desc: string;
  img: string;
  mrp: number;
  category?: string;
  rating?: number;
  isBestSeller?: boolean;
}

export interface ProductConfiguration {
  productId: string;
  sellingPrice: number;
  stockQty: number;
  isActive: boolean;
}

interface CatalogContextType {
  products: Product[];
  addProducts: (configs: ProductConfiguration[], globalProducts: GlobalProduct[]) => void;
  updateProduct: (updatedProduct: Product) => void;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { currentStore } = useStore();
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch Products from Supabase (Real Data)
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('Product') // Case sensitive
          .select('*')
          .order('name');

        if (error) {
          console.error('Error fetching catalog:', error);
          return;
        }

        if (data) {
          // Map DB Product -> Web Product Interface
          const mappedProducts: Product[] = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            desc: p.description || '',
            img: p.image || '',
            mrp: p.mrp,
            sellingPrice: p.mrp, // Default to MRP
            discountValue: 0,
            discountType: 'PERCENT',
            isActive: true, // Default active
            stockQty: 100, // Default stock for visibility
            category: p.category,
            rating: 4.5, // Placeholder
            isBestSeller: false
          }));
          setProducts(mappedProducts);
        }
      } catch (err) {
        console.error('Failed to fetch products', err);
      }
    };

    fetchCatalog();
  }, []); // Run once on mount

  const addProducts = (configs: ProductConfiguration[], globalProducts: GlobalProduct[]) => {
    // This functionality might need Supabase implementation later
    // For now, it updates local state
    setProducts((prevProducts) => {
      const newProducts: Product[] = [];

      configs.forEach((config) => {
        const globalProduct = globalProducts.find(p => p.id === config.productId);
        if (!globalProduct) return;

        const isDuplicate = prevProducts.some(p => p.name === globalProduct.name);

        const newProduct: Product = {
          id: `${currentStore?.id || 'temp'}-added-${Date.now()}-${config.productId}`,
          name: globalProduct.name,
          desc: globalProduct.desc,
          img: globalProduct.img,
          mrp: globalProduct.mrp,
          sellingPrice: config.sellingPrice,
          discountValue: 0,
          discountType: 'PERCENT',
          isActive: config.isActive,
          stockQty: config.stockQty,
          category: globalProduct.category,
          rating: globalProduct.rating,
          isBestSeller: globalProduct.isBestSeller,
        };

        if (config.sellingPrice < globalProduct.mrp) {
          const discountPercent = ((globalProduct.mrp - config.sellingPrice) / globalProduct.mrp) * 100;
          newProduct.discountValue = Math.round(discountPercent * 10) / 10;
        }

        newProducts.push(newProduct);
      });

      return [...newProducts, ...prevProducts];
    });
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  return (
    <CatalogContext.Provider value={{ products, addProducts, updateProduct, setProducts }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (context === undefined) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
