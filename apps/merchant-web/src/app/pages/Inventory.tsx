import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Star, TrendingUp, X, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../context/StoreContext';
import { useCatalog } from '@/app/context/CatalogContext';
import { useNavigate, useLocation } from 'react-router-dom';
import FilterModal, { FilterState } from '@/app/components/FilterModal';
import { toast } from 'sonner';

export default function Inventory() {
  const { currentStore } = useStore();
  const { products, setProducts } = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [preSelectedCategory, setPreSelectedCategory] = useState<string | undefined>();
  const [filters, setFilters] = useState<FilterState>({
    selectedCategories: [],
    sort: 'relevance',
    priceRange: [0, 1000000],
    customerRating: 0,
    bestSeller: false,
  });

  // New state for quick "Low Stock" filter
  const [isLowStockFilterActive, setIsLowStockFilterActive] = useState(false);

  // Check for incoming navigation state (e.g., from Dashboard)
  useEffect(() => {
    if (location.state && location.state.filter === 'low-stock') {
        setIsLowStockFilterActive(true);
        // Clear the state so refreshing doesn't keep it stuck
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const toggleActive = (id: string) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const updatePrice = (id: string, newSpStr: string) => {
    const newSp = parseFloat(newSpStr);
    
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      
      if (isNaN(newSp)) return { ...p, sellingPrice: 0 }; 
      
      let newDiscountValue = 0;
      if (p.discountType === 'FLAT') {
        newDiscountValue = p.mrp - newSp;
      } else {
        newDiscountValue = ((p.mrp - newSp) / p.mrp) * 100;
        newDiscountValue = Math.round(newDiscountValue * 10) / 10;
      }

      return {
        ...p,
        sellingPrice: newSp,
        discountValue: Math.max(0, newDiscountValue)
      };
    }));
  };

  const updateDiscount = (id: string, newDiscStr: string) => {
    const newDisc = parseFloat(newDiscStr);
    
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (isNaN(newDisc)) return { ...p, discountValue: 0 };

      let newSellingPrice = p.mrp;
      
      if (p.discountType === 'FLAT') {
        const validDisc = Math.min(newDisc, p.mrp); 
        newSellingPrice = p.mrp - validDisc;
        return { ...p, discountValue: validDisc, sellingPrice: newSellingPrice };
      } else {
        const validDisc = Math.min(newDisc, 100);
        newSellingPrice = p.mrp - (p.mrp * validDisc / 100);
        newSellingPrice = Math.round(newSellingPrice); 
        return { ...p, discountValue: validDisc, sellingPrice: newSellingPrice };
      }
    }));
  };

  const setDiscountType = (id: string, newType: 'PERCENT' | 'FLAT') => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (p.discountType === newType) return p;
      
      let newDiscountValue = 0;
      if (newType === 'FLAT') {
        newDiscountValue = p.mrp - p.sellingPrice;
      } else {
        newDiscountValue = ((p.mrp - p.sellingPrice) / p.mrp) * 100;
        newDiscountValue = Math.round(newDiscountValue * 10) / 10;
      }

      return { ...p, discountType: newType, discountValue: newDiscountValue };
    }));
  };

  const updateStock = (id: string, newStockStr: string) => {
    const newStock = parseInt(newStockStr);
    setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, stockQty: isNaN(newStock) ? 0 : newStock } : p
    ));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Product removed from catalog');
  };

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

  const toggleLowStock = () => {
      setIsLowStockFilterActive(prev => !prev);
  };

  const removeFilter = (filterKey: string, value?: string) => {
    if (filterKey === 'lowStock') {
        setIsLowStockFilterActive(false);
        return;
    }

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
    // We don't count low stock here as it has its own active state
    return count;
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    // Apply Low Stock Filter (Priority)
    if (isLowStockFilterActive) {
        result = result.filter(p => p.stockQty <= 10); // Assuming 10 is the threshold
    }

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
      (p) => p.sellingPrice >= filters.priceRange[0] && p.sellingPrice <= filters.priceRange[1]
    );

    // Apply sorting
    switch (filters.sort) {
      case 'price_low_to_high':
        result.sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case 'price_high_to_low':
        result.sort((a, b) => b.sellingPrice - a.sellingPrice);
        break;
      case 'discount_high_to_low':
        result.sort((a, b) => b.discountValue - a.discountValue);
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
  }, [products, search, filters, isLowStockFilterActive]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black pb-24">
      {/* Header with Search */}
      <div className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="p-4 pb-3">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">
                Active Store
              </span>
              <span className="text-xs font-bold text-black bg-gray-100 px-2 py-1 rounded">
                {currentStore.name}
              </span>
            </div>
          </div>

          <div className="relative mb-3">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-black focus:border-black transition-all"
            />
          </div>

          {/* Add Products Button */}
          <button
            onClick={() => navigate('/inventory/add-products')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-xl text-sm font-bold mb-3 hover:bg-gray-800 transition-colors"
          >
            <Plus size={18} />
            <span>Add Products to Catalog</span>
          </button>

          {/* Filter Buttons Row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
             {/* Low Stock Quick Filter */}
             <button
              onClick={toggleLowStock}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                isLowStockFilterActive
                  ? 'bg-orange-100 text-orange-800 border-orange-200 ring-1 ring-orange-300'
                  : 'bg-white border border-gray-300 hover:bg-orange-50 text-gray-700'
              )}
            >
              <AlertTriangle size={16} className={isLowStockFilterActive ? "fill-orange-800" : ""} />
              <span>Low Stock</span>
            </button>

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
          filters.sort !== 'relevance' ||
          isLowStockFilterActive) && (
          <div className="px-4 pb-3 pt-1">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {isLowStockFilterActive && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium whitespace-nowrap border border-orange-200">
                    <span>⚠️ Low Stock</span>
                    <button
                        onClick={() => removeFilter('lowStock')}
                        className="hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                    >
                        <X size={14} />
                    </button>
                    </div>
                )}

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

      {/* Product List */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>No products found</p>
          </div>
        ) : (
          filteredAndSortedProducts.map((product) => (
            <div
              key={product.id}
              className={clsx(
                'p-4 rounded-2xl shadow-sm border transition-colors relative',
                product.isActive
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200/60'
              )}
            >
              {/* Delete Button */}
              <button 
                onClick={() => deleteProduct(product.id)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              >
                <Trash2 size={16} />
              </button>

              <div className="flex gap-4 mb-5 pr-8">
                <div
                  className={clsx(
                    'w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border relative transition-all',
                    product.isActive
                      ? 'grayscale-0 border-gray-100'
                      : 'grayscale opacity-60 border-gray-200'
                  )}
                >
                  <img
                    src={product.img}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  {!product.isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded shadow-sm">
                        HIDDEN
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div
                    className={clsx(
                      'transition-opacity',
                      product.isActive ? 'opacity-100' : 'opacity-50'
                    )}
                  >
                    <h3 className="font-bold text-gray-900 leading-tight line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
                      {product.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => toggleActive(product.id)}
                      className={clsx(
                        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none',
                        product.isActive ? 'bg-black' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ml-1',
                          product.isActive ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                    <span className="text-xs font-medium text-gray-500">{product.isActive ? 'Active' : 'Hidden'}</span>
                  </div>
                </div>
              </div>

              <div
                className={clsx(
                  'grid grid-cols-4 gap-2 transition-opacity',
                  product.isActive
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-50 pointer-events-none select-none'
                )}
              >
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 flex flex-col justify-between h-16">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">
                    MRP
                  </span>
                  <span className="font-bold text-gray-500 text-sm">
                    ₹{product.mrp}
                  </span>
                </div>

                <div
                  className={clsx(
                    'rounded-lg p-2 border flex flex-col justify-between h-16 relative transition-colors',
                    product.sellingPrice < product.mrp
                      ? 'bg-white border-black ring-1 ring-black/5'
                      : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-wide truncate">
                    Your Price
                  </span>
                  <div className="flex items-center">
                    <span className="text-xs font-bold text-gray-900 mr-0.5">₹</span>
                    <input
                      type="number"
                      value={product.sellingPrice === 0 ? '' : product.sellingPrice}
                      onChange={(e) => updatePrice(product.id, e.target.value)}
                      className="w-full bg-transparent font-bold text-gray-900 outline-none p-0 text-sm placeholder:text-gray-300"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className={clsx(
                    "bg-white border rounded-lg p-2 flex flex-col justify-between h-16 transition-colors",
                    product.stockQty <= 10 ? "border-orange-300 bg-orange-50" : "border-gray-200"
                )}>
                  <span className={clsx(
                      "text-[10px] font-bold uppercase tracking-wide truncate",
                      product.stockQty <= 10 ? "text-orange-700" : "text-gray-900"
                  )}>
                    Stock Qty
                  </span>
                  <input
                    type="number"
                    value={product.stockQty === 0 ? '' : product.stockQty}
                    onChange={(e) => updateStock(product.id, e.target.value)}
                    className={clsx(
                        "w-full bg-transparent font-bold outline-none p-0 text-sm placeholder:text-gray-300",
                        product.stockQty <= 10 ? "text-orange-800" : "text-gray-900"
                    )}
                    placeholder="0"
                  />
                </div>

                <div
                  className={clsx(
                    'rounded-lg p-1.5 border flex flex-col justify-between h-16 relative',
                    product.discountValue > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <div className="flex bg-gray-200/50 rounded p-[2px] w-full">
                    <button
                      onClick={() => setDiscountType(product.id, 'PERCENT')}
                      className={clsx(
                        'flex-1 text-[8px] font-bold rounded py-0.5 transition-all text-center',
                        product.discountType === 'PERCENT'
                          ? 'bg-white shadow text-black'
                          : 'text-gray-400 hover:text-gray-600'
                      )}
                    >
                      %
                    </button>
                    <button
                      onClick={() => setDiscountType(product.id, 'FLAT')}
                      className={clsx(
                        'flex-1 text-[8px] font-bold rounded py-0.5 transition-all text-center',
                        product.discountType === 'FLAT'
                          ? 'bg-white shadow text-black'
                          : 'text-gray-400 hover:text-gray-600'
                      )}
                    >
                      ₹
                    </button>
                  </div>

                  <div className="flex items-center px-0.5 mt-1">
                    <input
                      type="number"
                      value={product.discountValue === 0 ? '' : product.discountValue}
                      onChange={(e) => updateDiscount(product.id, e.target.value)}
                      className={clsx(
                        'w-full bg-transparent font-bold outline-none p-0 text-sm text-center placeholder:text-gray-300',
                        product.discountValue > 0 ? 'text-green-700' : 'text-gray-900'
                      )}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
        preSelectedCategory={preSelectedCategory}
      />
    </div>
  );
}
