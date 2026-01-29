import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  Filter,
  ArrowUpDown,
  Star,
  TrendingUp,
  X,
  Check,
} from 'lucide-react';
import clsx from 'clsx';
import FilterModal, { FilterState } from '@/app/components/FilterModal';
import ProductConfigModal from '@/app/components/ProductConfigModal';
import type { ProductConfiguration } from '@/app/components/ProductConfigModal';
import { toast } from 'sonner';
import { useCatalog, GlobalProduct } from '../context/CatalogContext';

// Mock global inventory data
const GLOBAL_INVENTORY: GlobalProduct[] = [
  { id: 'global-1', name: 'Premium Olive Oil', desc: '500ml extra virgin cold pressed', mrp: 350, img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.6, isBestSeller: true },
  { id: 'global-2', name: 'Organic Honey', desc: '250g pure raw honey, no additives', mrp: 280, img: 'https://images.unsplash.com/photo-1587049352846-4a222e784367?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.8, isBestSeller: true },
  { id: 'global-3', name: 'Cashew Nuts', desc: '200g premium quality, roasted & salted', mrp: 420, img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.4, isBestSeller: false },
  { id: 'global-4', name: 'Protein Bar', desc: 'Chocolate flavor, 60g high protein', mrp: 99, img: 'https://images.unsplash.com/photo-1604480132715-bd70a0043f3d?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.2, isBestSeller: true },
  { id: 'global-5', name: 'Greek Yogurt', desc: '200g thick & creamy, high protein', mrp: 65, img: 'https://images.unsplash.com/photo-1571212515416-fca705e5e0c5?w=100&h=100&fit=crop', category: 'Groceries > Dairy Products', rating: 4.5, isBestSeller: false },
  { id: 'global-6', name: 'Chia Seeds', desc: '100g organic superfood, omega-3 rich', mrp: 180, img: 'https://images.unsplash.com/photo-1585154805528-d0a18222810c?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.7, isBestSeller: false },
  { id: 'global-7', name: 'Quinoa', desc: '500g organic white quinoa, protein rich', mrp: 320, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.3, isBestSeller: false },
  { id: 'global-8', name: 'Almond Milk', desc: '1L unsweetened, dairy-free alternative', mrp: 220, img: 'https://images.unsplash.com/photo-1635436322965-48ff696e7392?w=100&h=100&fit=crop', category: 'Groceries > Dairy Products', rating: 4.1, isBestSeller: false },
  { id: 'global-9', name: 'Green Coffee', desc: '200g unroasted beans, weight management', mrp: 450, img: 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.0, isBestSeller: false },
  { id: 'global-10', name: 'Peanut Butter', desc: '500g creamy, no added sugar', mrp: 280, img: 'https://images.unsplash.com/photo-1607301406259-dfb1a41456de?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.6, isBestSeller: true },
  { id: 'global-11', name: 'Coconut Oil', desc: '500ml virgin coconut oil, multipurpose', mrp: 300, img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.5, isBestSeller: false },
  { id: 'global-12', name: 'Oats', desc: '1kg rolled oats, quick cooking', mrp: 180, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.4, isBestSeller: true },
  { id: 'global-13', name: 'Dates', desc: '500g premium Medjool dates, natural sweetener', mrp: 420, img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.7, isBestSeller: false },
  { id: 'global-14', name: 'Whey Protein', desc: '1kg chocolate flavor, muscle building', mrp: 2500, img: 'https://images.unsplash.com/photo-1604480132715-bd70a0043f3d?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.3, isBestSeller: true },
  { id: 'global-15', name: 'Flax Seeds', desc: '200g organic, omega-3 & fiber rich', mrp: 140, img: 'https://images.unsplash.com/photo-1585154805528-d0a18222810c?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.5, isBestSeller: false },
  { id: 'global-16', name: 'Kombucha', desc: '500ml ginger flavor, probiotic drink', mrp: 180, img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.2, isBestSeller: false },
  { id: 'global-17', name: 'Pasta Sauce', desc: '400g organic tomato basil sauce', mrp: 220, img: 'https://images.unsplash.com/photo-1607301406259-dfb1a41456de?w=100&h=100&fit=crop', category: 'Groceries > Staples & Cooking', rating: 4.1, isBestSeller: false },
  { id: 'global-18', name: 'Granola', desc: '500g crunchy with nuts & honey', mrp: 350, img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.4, isBestSeller: false },
  { id: 'global-19', name: 'Herbal Tea', desc: 'Pack of 25, chamomile & lavender blend', mrp: 240, img: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=100&h=100&fit=crop', category: 'Groceries > Snacks & Beverages', rating: 4.6, isBestSeller: false },
  { id: 'global-20', name: 'Soy Milk', desc: '1L unsweetened, plant-based milk', mrp: 180, img: 'https://images.unsplash.com/photo-1635436322965-48ff696e7392?w=100&h=100&fit=crop', category: 'Groceries > Dairy Products', rating: 4.0, isBestSeller: false },
];

export default function AddProducts() {
  const navigate = useNavigate();
  const { products, addProducts } = useCatalog();
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [preSelectedCategory, setPreSelectedCategory] = useState<string | undefined>();
  const [filters, setFilters] = useState<FilterState>({
    selectedCategories: [],
    sort: 'relevance',
    priceRange: [0, 1000000],
    customerRating: 0,
    bestSeller: false,
  });

  const handleOpenFilterModal = (category?: string) => {
    setPreSelectedCategory(category);
    setIsFilterModalOpen(true);
  };

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const toggleBestSeller = () => {
    setFilters((prev) => ({ ...prev, bestSeller: !prev.bestSeller }));
  };

  const removeFilter = (filterKey: string, value?: string) => {
    setFilters((prev) => {
      if (filterKey === 'category' && value) {
        return {
          ...prev,
          selectedCategories: prev.selectedCategories.filter((c) => c !== value),
        };
      }
      if (filterKey === 'bestSeller') {
        return { ...prev, bestSeller: false };
      }
      if (filterKey === 'customerRating') {
        return { ...prev, customerRating: 0 };
      }
      if (filterKey === 'sort') {
        return { ...prev, sort: 'relevance' };
      }
      return prev;
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.selectedCategories.length > 0) count += filters.selectedCategories.length;
    if (filters.customerRating > 0) count++;
    if (filters.sort !== 'relevance') count++;
    if (filters.priceRange[1] < 1000000) count++;
    return count;
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleAddSelected = () => {
    if (selectedProducts.size > 0) {
      setIsConfigModalOpen(true);
    }
  };

  const handleConfirmAdd = (configurations: ProductConfiguration[]) => {
    addProducts(configurations, GLOBAL_INVENTORY);
    toast.success(`${configurations.length} products added to your catalog!`);
    setSelectedProducts(new Set());
    navigate('/inventory');
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = GLOBAL_INVENTORY.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    // Apply category filter
    if (filters.selectedCategories.length > 0) {
      result = result.filter((p) =>
        filters.selectedCategories.some((cat) => p.category === cat)
      );
    }

    // Apply best seller filter
    if (filters.bestSeller) {
      result = result.filter((p) => p.isBestSeller);
    }

    // Apply customer rating filter
    if (filters.customerRating > 0) {
      result = result.filter((p) => (p.rating || 0) >= filters.customerRating);
    }

    // Apply price range filter
    result = result.filter(
      (p) => p.mrp >= filters.priceRange[0] && p.mrp <= filters.priceRange[1]
    );

    // Apply sorting
    switch (filters.sort) {
      case 'price_low_to_high':
        result.sort((a, b) => a.mrp - b.mrp);
        break;
      case 'price_high_to_low':
        result.sort((a, b) => b.mrp - a.mrp);
        break;
      case 'alphabetical_a_z':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'alphabetical_z_a':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        // relevance - no sorting
        break;
    }

    return result;
  }, [search, filters]);

  const selectedProductsArray = filteredAndSortedProducts.filter((p) =>
    selectedProducts.has(p.id)
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black pb-24">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="p-4 pb-3">
          {/* Back Button & Title */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/inventory')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-900" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Add Products</h1>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search global inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
            />
          </div>

          {/* Filter Buttons Row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleOpenFilterModal('type')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-gray-50 transition-colors"
            >
              <Filter size={16} />
              <span>Filter</span>
              {getActiveFilterCount() > 0 && (
                <span className="bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>

            <button
              onClick={() => handleOpenFilterModal('sort')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown size={16} />
              <span>Sort</span>
            </button>

            <button
              onClick={toggleBestSeller}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                filters.bestSeller
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-300 hover:bg-gray-50'
              )}
            >
              <TrendingUp size={16} />
              <span>Best Seller</span>
            </button>

            <button
              onClick={() => handleOpenFilterModal('customerRating')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-gray-50 transition-colors"
            >
              <Star size={16} />
              <span>Ratings</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(filters.selectedCategories.length > 0 ||
          filters.bestSeller ||
          filters.customerRating > 0 ||
          filters.sort !== 'relevance') && (
          <div className="px-4 pb-3 pt-1">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {filters.selectedCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium whitespace-nowrap"
                >
                  <span>{cat.split(' > ')[1]}</span>
                  <button
                    onClick={() => removeFilter('category', cat)}
                    className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {filters.bestSeller && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium whitespace-nowrap">
                  <span>Best Seller</span>
                  <button
                    onClick={() => removeFilter('bestSeller')}
                    className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {filters.customerRating > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium whitespace-nowrap">
                  <span>{filters.customerRating}★ & above</span>
                  <button
                    onClick={() => removeFilter('customerRating')}
                    className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {filters.sort !== 'relevance' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium whitespace-nowrap">
                  <span>Sorted</span>
                  <button
                    onClick={() => removeFilter('sort')}
                    className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product Cards Grid */}
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>No products found</p>
          </div>
        ) : (
          filteredAndSortedProducts.map((product) => {
            const isSelected = selectedProducts.has(product.id);
            const isAlreadyAdded = products.some(p => p.name === product.name);

            return (
              <div
                key={product.id}
                onClick={() => !isAlreadyAdded && toggleProductSelection(product.id)}
                className={clsx(
                  'p-4 rounded-xl border transition-all cursor-pointer',
                  isSelected
                    ? 'bg-gray-900 border-gray-900'
                    : isAlreadyAdded ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 hover:border-gray-400'
                )}
              >
                <div className="flex gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isAlreadyAdded ? (
                      <div className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-200 flex items-center justify-center">
                        <Check size={14} className="text-gray-500" />
                      </div>
                    ) : (
                      <div
                        className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-white border-white'
                            : 'bg-white border-gray-300'
                        )}
                      >
                        {isSelected && <Check size={14} className="text-black" />}
                      </div>
                    )}
                  </div>

                  {/* Product Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                    <img
                      src={product.img}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3
                        className={clsx(
                          'font-bold leading-tight line-clamp-2',
                          isSelected ? 'text-white' : 'text-gray-900'
                        )}
                      >
                        {product.name}
                      </h3>
                      {isAlreadyAdded && (
                        <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                          Added
                        </span>
                      )}
                    </div>
                    <p
                      className={clsx(
                        'text-xs mt-1 leading-snug line-clamp-1',
                        isSelected ? 'text-gray-300' : 'text-gray-500'
                      )}
                    >
                      {product.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={clsx(
                          'text-sm font-bold',
                          isSelected ? 'text-white' : 'text-gray-900'
                        )}
                      >
                        MRP: ₹{product.mrp}
                      </span>
                      {product.isBestSeller && (
                        <span className="text-[10px] font-bold bg-yellow-400 text-gray-900 px-2 py-0.5 rounded">
                          BESTSELLER
                        </span>
                      )}
                      {product.rating && (
                        <span
                          className={clsx(
                            'text-xs font-medium',
                            isSelected ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          ★ {product.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      {selectedProducts.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleAddSelected}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-colors"
            >
              <span>Add Selected ({selectedProducts.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
        preSelectedCategory={preSelectedCategory}
      />

      {/* Product Configuration Modal */}
      <ProductConfigModal
        isOpen={isConfigModalOpen}
        products={selectedProductsArray}
        onClose={() => setIsConfigModalOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </div>
  );
}
