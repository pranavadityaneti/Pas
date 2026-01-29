import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface FilterCategory {
  id: string;
  label: string;
}

interface ProductCategory {
  id: string;
  label: string;
  subcategories: { id: string; label: string }[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
  preSelectedCategory?: string;
}

export interface FilterState {
  selectedCategories: string[];
  sort: string;
  priceRange: [number, number];
  customerRating: number;
  bestSeller: boolean;
  // Fashion specific
  colour?: string[];
  material?: string[];
  size?: string[];
  pattern?: string[];
  // Groceries specific
  freshness?: string[];
  organic?: boolean;
  // Electronics specific
  brand?: string[];
  warranty?: boolean;
  condition?: string;
}

const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'electronics',
    label: 'Electronics',
    subcategories: [
      { id: 'mobile-accessories', label: 'Mobile & Accessories' },
      { id: 'laptops-computers', label: 'Laptops & Computers' },
      { id: 'tv-appliances', label: 'TV & Appliances' },
      { id: 'cameras-audio', label: 'Cameras & Audio' },
    ],
  },
  {
    id: 'groceries',
    label: 'Groceries',
    subcategories: [
      { id: 'fruits-vegetables', label: 'Fruits & Vegetables' },
      { id: 'dairy-products', label: 'Dairy Products' },
      { id: 'snacks-beverages', label: 'Snacks & Beverages' },
      { id: 'staples-cooking', label: 'Staples & Cooking' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    subcategories: [
      { id: 'mens-clothing', label: "Men's Clothing" },
      { id: 'womens-clothing', label: "Women's Clothing" },
      { id: 'footwear', label: 'Footwear' },
      { id: 'accessories', label: 'Accessories' },
    ],
  },
  {
    id: 'home-kitchen',
    label: 'Home & Kitchen',
    subcategories: [
      { id: 'furniture', label: 'Furniture' },
      { id: 'home-decor', label: 'Home Decor' },
      { id: 'kitchen-appliances', label: 'Kitchen Appliances' },
      { id: 'cookware', label: 'Cookware' },
    ],
  },
];

export default function FilterModal({
  isOpen,
  onClose,
  onApply,
  initialFilters,
  preSelectedCategory,
}: FilterModalProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>(
    preSelectedCategory || 'type'
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters);
      setSelectedFilterCategory(preSelectedCategory || 'type');
    }
  }, [isOpen, initialFilters, preSelectedCategory]);

  const getAvailableFilters = (): FilterCategory[] => {
    const baseFilters: FilterCategory[] = [
      { id: 'sort', label: 'Sort' },
      { id: 'type', label: 'Type' },
      { id: 'price', label: 'Price' },
      { id: 'customerRating', label: 'Customer Ratings' },
      { id: 'bestSeller', label: 'Best Seller' },
    ];

    // Check which main category is selected
    const selectedMainCategories = filters.selectedCategories
      .map((cat) => cat.split(' > ')[0])
      .filter((cat) => cat);

    const hasFashion = selectedMainCategories.includes('Fashion');
    const hasGroceries = selectedMainCategories.includes('Groceries');
    const hasElectronics = selectedMainCategories.includes('Electronics');
    const hasHomeKitchen = selectedMainCategories.includes('Home & Kitchen');

    if (hasFashion) {
      baseFilters.splice(2, 0, 
        { id: 'colour', label: 'Colour' },
        { id: 'material', label: 'Material' },
        { id: 'size', label: 'Size' },
        { id: 'pattern', label: 'Pattern' }
      );
    }

    if (hasGroceries) {
      baseFilters.splice(2, 0,
        { id: 'freshness', label: 'Freshness' },
        { id: 'organic', label: 'Organic' }
      );
    }

    if (hasElectronics) {
      baseFilters.splice(2, 0,
        { id: 'brand', label: 'Brand' },
        { id: 'warranty', label: 'Warranty' },
        { id: 'condition', label: 'Condition' }
      );
    }

    if (hasHomeKitchen) {
      baseFilters.splice(2, 0,
        { id: 'colour', label: 'Colour' },
        { id: 'material', label: 'Material' }
      );
    }

    return baseFilters;
  };

  const handleClearAll = () => {
    setFilters({
      selectedCategories: [],
      sort: 'relevance',
      priceRange: [0, 1000000],
      customerRating: 0,
      bestSeller: false,
    });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const toggleCategory = (categoryPath: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryPath)
        ? prev.selectedCategories.filter((c) => c !== categoryPath)
        : [...prev.selectedCategories, categoryPath],
    }));
  };

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const current = (prev[key] as string[]) || [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const renderRightPanel = () => {
    switch (selectedFilterCategory) {
      case 'sort':
        return (
          <div className="space-y-2">
            {[
              { value: 'relevance', label: 'Relevance' },
              { value: 'price_low_to_high', label: 'Price (Low To High)' },
              { value: 'price_high_to_low', label: 'Price (High To Low)' },
              { value: 'discount_high_to_low', label: 'Discount (High To Low)' },
              { value: 'alphabetical_a_z', label: 'Alphabetical (A-Z)' },
              { value: 'alphabetical_z_a', label: 'Alphabetical (Z-A)' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="sort"
                  checked={filters.sort === option.value}
                  onChange={() => setFilters({ ...filters, sort: option.value })}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm font-medium text-gray-900">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'type':
        return (
          <div className="space-y-2">
            {PRODUCT_CATEGORIES.map((category) => (
              <div key={category.id}>
                <button
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === category.id ? null : category.id
                    )
                  }
                  className="flex items-center justify-between w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {category.label}
                  </span>
                  <ChevronRight
                    size={16}
                    className={clsx(
                      'transition-transform text-gray-400',
                      expandedCategory === category.id && 'rotate-90'
                    )}
                  />
                </button>
                {expandedCategory === category.id && (
                  <div className="ml-4 mt-2 space-y-2">
                    {category.subcategories.map((sub) => {
                      const categoryPath = `${category.label} > ${sub.label}`;
                      return (
                        <label
                          key={sub.id}
                          className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filters.selectedCategories.includes(categoryPath)}
                            onChange={() => toggleCategory(categoryPath)}
                            className="w-4 h-4 accent-black"
                          />
                          <span className="text-sm text-gray-700">{sub.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'price':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Price Range: ₹{filters.priceRange[0]} - ₹{filters.priceRange[1]}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="1000000"
                  step="100"
                  value={filters.priceRange[1]}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      priceRange: [0, parseInt(e.target.value)],
                    })
                  }
                  className="w-full accent-black"
                />
              </div>
            </div>
            <div className="space-y-2">
              {[
                { min: 0, max: 1000, label: '₹0 - ₹1,000' },
                { min: 1000, max: 5000, label: '₹1,000 - ₹5,000' },
                { min: 5000, max: 20000, label: '₹5,000 - ₹20,000' },
                { min: 20000, max: 100000, label: '₹20,000 - ₹1,00,000' },
                { min: 100000, max: 1000000, label: '₹1,00,000+' },
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() =>
                    setFilters({ ...filters, priceRange: [range.min, range.max] })
                  }
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 'customerRating':
        return (
          <div className="space-y-2">
            {[
              { value: 4, label: '4★ & above' },
              { value: 3, label: '3★ & above' },
              { value: 2, label: '2★ & above' },
              { value: 0, label: 'All Ratings' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="rating"
                  checked={filters.customerRating === option.value}
                  onChange={() =>
                    setFilters({ ...filters, customerRating: option.value })
                  }
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm font-medium text-gray-900">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'bestSeller':
        return (
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.bestSeller}
              onChange={(e) =>
                setFilters({ ...filters, bestSeller: e.target.checked })
              }
              className="w-4 h-4 accent-black"
            />
            <span className="text-sm font-medium text-gray-900">Show Best Sellers Only</span>
          </label>
        );

      case 'colour':
        return (
          <div className="space-y-2">
            {['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Orange', 'Pink', 'Purple'].map(
              (color) => (
                <label
                  key={color}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={(filters.colour || []).includes(color)}
                    onChange={() => toggleArrayFilter('colour', color)}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-gray-700">{color}</span>
                </label>
              )
            )}
          </div>
        );

      case 'material':
        return (
          <div className="space-y-2">
            {['Cotton', 'Polyester', 'Denim', 'Silk', 'Wool', 'Leather', 'Wood', 'Metal', 'Plastic', 'Glass'].map(
              (mat) => (
                <label
                  key={mat}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={(filters.material || []).includes(mat)}
                    onChange={() => toggleArrayFilter('material', mat)}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm text-gray-700">{mat}</span>
                </label>
              )
            )}
          </div>
        );

      case 'size':
        return (
          <div className="space-y-2">
            {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
              <label
                key={sz}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={(filters.size || []).includes(sz)}
                  onChange={() => toggleArrayFilter('size', sz)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm text-gray-700">{sz}</span>
              </label>
            ))}
          </div>
        );

      case 'pattern':
        return (
          <div className="space-y-2">
            {['Solid', 'Striped', 'Printed', 'Checked', 'Floral'].map((pat) => (
              <label
                key={pat}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={(filters.pattern || []).includes(pat)}
                  onChange={() => toggleArrayFilter('pattern', pat)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm text-gray-700">{pat}</span>
              </label>
            ))}
          </div>
        );

      case 'freshness':
        return (
          <div className="space-y-2">
            {['Farm Fresh', 'Fresh', 'Standard'].map((fresh) => (
              <label
                key={fresh}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={(filters.freshness || []).includes(fresh)}
                  onChange={() => toggleArrayFilter('freshness', fresh)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm text-gray-700">{fresh}</span>
              </label>
            ))}
          </div>
        );

      case 'organic':
        return (
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.organic || false}
              onChange={(e) => setFilters({ ...filters, organic: e.target.checked })}
              className="w-4 h-4 accent-black"
            />
            <span className="text-sm font-medium text-gray-900">Organic Products Only</span>
          </label>
        );

      case 'brand':
        return (
          <div className="space-y-2">
            {['Samsung', 'Apple', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Xiaomi'].map((br) => (
              <label
                key={br}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={(filters.brand || []).includes(br)}
                  onChange={() => toggleArrayFilter('brand', br)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm text-gray-700">{br}</span>
              </label>
            ))}
          </div>
        );

      case 'warranty':
        return (
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.warranty || false}
              onChange={(e) => setFilters({ ...filters, warranty: e.target.checked })}
              className="w-4 h-4 accent-black"
            />
            <span className="text-sm font-medium text-gray-900">With Warranty Only</span>
          </label>
        );

      case 'condition':
        return (
          <div className="space-y-2">
            {['New', 'Refurbished'].map((cond) => (
              <label
                key={cond}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="condition"
                  checked={filters.condition === cond}
                  onChange={() => setFilters({ ...filters, condition: cond })}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-sm font-medium text-gray-900">{cond}</span>
              </label>
            ))}
          </div>
        );

      default:
        return <div className="text-gray-400 text-sm">Select a filter category</div>;
    }
  };

  if (!isOpen) return null;

  const availableFilters = getAvailableFilters();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full h-[85vh] sm:h-[600px] sm:max-w-2xl rounded-t-3xl sm:rounded-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Categories */}
          <div className="w-2/5 border-r border-gray-200 overflow-y-auto bg-gray-50">
            {availableFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilterCategory(filter.id)}
                className={clsx(
                  'w-full text-left px-4 py-4 text-sm font-medium border-b border-gray-200 transition-colors',
                  selectedFilterCategory === filter.id
                    ? 'bg-white text-black'
                    : 'text-gray-600 hover:bg-white/50'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Right Panel - Options */}
          <div className="w-3/5 overflow-y-auto p-4">{renderRightPanel()}</div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleClearAll}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
