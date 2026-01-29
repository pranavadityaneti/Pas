import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useStore } from '@/app/context/StoreContext';

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

const generateProducts = (storeId: string): Product[] => {
  const baseProducts = [
    { name: 'Fresh Farm Milk', desc: '500ml pouch, full cream, pasteurized', mrp: 34, img: 'https://images.unsplash.com/photo-1635436322965-48ff696e7392?w=100&h=100&fit=crop', category: 'Groceries > Dairy Products', rating: 4.5, isBestSeller: true },
    { name: 'Whole Wheat Bread', desc: '400g loaf, 100% whole wheat, zero maida', mrp: 50, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.2, isBestSeller: false },
    { name: 'Farm Fresh Eggs', desc: 'Pack of 6, brown eggs, organic feed', mrp: 75, img: 'https://images.unsplash.com/photo-1587486913049-53fc88980fa1?w=100&h=100&fit=crop', category: 'Groceries > Dairy Products', rating: 4.8, isBestSeller: true },
    { name: 'Salted Potato Chips', desc: 'Classic salted, 50g pack, crispy', mrp: 20, img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 3.9, isBestSeller: false },
    { name: 'Cola Soft Drink', desc: '750ml PET bottle, carbonated beverage', mrp: 45, img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.0, isBestSeller: true },
    { name: 'Instant Noodles', desc: 'Masala flavor, single pack, 70g', mrp: 14, img: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.3, isBestSeller: true },
    { name: 'Tomato Ketchup', desc: '500g glass bottle, rich tomato taste', mrp: 120, img: 'https://images.unsplash.com/photo-1607301406259-dfb1a41456de?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.1, isBestSeller: false },
    { name: 'Green Tea Bags', desc: 'Pack of 25, honey lemon flavor, detox', mrp: 180, img: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.6, isBestSeller: false },
    { name: 'Dark Chocolate', desc: '70% cocoa, 100g bar, intense flavor', mrp: 150, img: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.7, isBestSeller: true },
    { name: 'Basmati Rice', desc: '1kg premium aged rice, extra long grain', mrp: 140, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.4, isBestSeller: false },
  ];
  
  const products: Product[] = [];
  
  for (let i = 0; i < 50; i++) {
    const base = baseProducts[i % baseProducts.length];
    products.push({
      id: `${storeId}-${i}`,
      name: `${base.name} ${i > 9 ? `(Var ${i})` : ''}`,
      desc: base.desc,
      img: base.img,
      mrp: base.mrp + (i * 2),
      sellingPrice: base.mrp + (i * 2),
      discountValue: 0,
      discountType: 'PERCENT',
      isActive: i % 5 !== 0,
      stockQty: Math.floor(Math.random() * 50) + 5,
      category: base.category,
      rating: base.rating,
      isBestSeller: base.isBestSeller,
    });
  }

  return products;
};

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { currentStore } = useStore();
  const [products, setProducts] = useState<Product[]>([]);

  // Initialize products when store changes (only if empty to simulate persistence per session)
  useEffect(() => {
    if (products.length === 0 && currentStore) {
        setProducts(generateProducts(currentStore.id));
    }
  }, [currentStore?.id]);

  const addProducts = (configs: ProductConfiguration[], globalProducts: GlobalProduct[]) => {
    setProducts((prevProducts) => {
      const newProducts: Product[] = [];
      
      configs.forEach((config) => {
        const globalProduct = globalProducts.find(p => p.id === config.productId);
        if (!globalProduct) return;

        const isDuplicate = prevProducts.some(p => p.name === globalProduct.name);
        
        const newProduct: Product = {
          id: `${currentStore.id}-added-${Date.now()}-${config.productId}`,
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
        
        // Calculate discount if selling price < mrp
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
