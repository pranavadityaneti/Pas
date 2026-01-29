import React, { useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback'; // Using the system component

interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  image: string;
}

const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Classic Chicken Burger',
    price: 180,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: '2',
    name: 'Masala Chai',
    price: 40,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1561336313-0bd5e31f5c46?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: '3',
    name: 'Veg Biryani',
    price: 220,
    inStock: false,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: '4',
    name: 'Chocolate Brownie',
    price: 90,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476d?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: '5',
    name: 'Paneer Tikka Wrap',
    price: 160,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=150&q=80'
  }
];

export default function InventoryScreen() {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStockToggle = (id: string) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, inStock: !p.inStock } : p
    ));
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    const price = parseInt(newPrice) || 0;
    setProducts(products.map(p => 
      p.id === id ? { ...p, price } : p
    ));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b sticky top-0 bg-white z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Catalog</h1>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items in shop..."
            className="pl-9 bg-gray-50 border-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {filteredProducts.map((product) => (
            <div key={product.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                <ImageWithFallback 
                  src={product.image} 
                  alt={product.name} 
                  className="h-full w-full object-cover"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{product.name}</h3>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <span className="mr-1">₹</span>
                  <input 
                    type="number"
                    className="w-16 p-1 border rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 text-gray-900 font-semibold"
                    value={product.price}
                    onChange={(e) => handlePriceChange(product.id, e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-medium",
                  product.inStock ? "text-green-600" : "text-gray-400"
                )}>
                  {product.inStock ? 'In Stock' : 'Out'}
                </span>
                <Switch 
                  checked={product.inStock} 
                  onCheckedChange={() => handleStockToggle(product.id)}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
