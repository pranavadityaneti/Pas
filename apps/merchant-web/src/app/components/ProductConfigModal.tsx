import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { GlobalProduct } from '@/app/context/CatalogContext';

interface ProductConfigModalProps {
  isOpen: boolean;
  products: GlobalProduct[];
  onClose: () => void;
  onConfirm: (configurations: ProductConfiguration[]) => void;
}

export interface ProductConfiguration {
  productId: string;
  sellingPrice: number;
  stockQty: number;
  isActive: boolean;
}

export default function ProductConfigModal({
  isOpen,
  products,
  onClose,
  onConfirm,
}: ProductConfigModalProps) {
  const [configurations, setConfigurations] = useState<
    Record<string, ProductConfiguration>
  >({});

  useEffect(() => {
    if (isOpen && products.length > 0) {
      // Initialize configurations with default values
      const initialConfig: Record<string, ProductConfiguration> = {};
      products.forEach((product) => {
        initialConfig[product.id] = {
          productId: product.id,
          sellingPrice: product.mrp,
          stockQty: 10,
          isActive: true,
        };
      });
      setConfigurations(initialConfig);
    }
  }, [isOpen, products]);

  const updateConfig = (
    productId: string,
    field: keyof ProductConfiguration,
    value: number | boolean
  ) => {
    setConfigurations((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const handleConfirm = () => {
    const configArray = Object.values(configurations);
    onConfirm(configArray);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full max-h-[85vh] sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Configure Products ({products.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {products.map((product) => {
            const config = configurations[product.id];
            if (!config) return null;

            return (
              <div
                key={product.id}
                className="p-4 border border-gray-200 rounded-xl bg-gray-50"
              >
                {/* Product Info */}
                <div className="flex gap-3 mb-4">
                  <img
                    src={product.img}
                    alt={product.name}
                    className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gray-900 line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {product.desc}
                    </p>
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      MRP: ₹{product.mrp}
                    </p>
                  </div>
                </div>

                {/* Configuration Fields */}
                <div className="space-y-3">
                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Your Selling Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-900">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={config.sellingPrice === 0 ? '' : config.sellingPrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            updateConfig(product.id, 'sellingPrice', val);
                          }
                        }}
                        className={clsx(
                          'w-full pl-8 pr-4 py-2.5 border rounded-lg text-sm font-bold outline-none transition-colors border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black'
                        )}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Stock Quantity */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Initial Stock Quantity
                    </label>
                    <input
                      type="number"
                      value={config.stockQty === 0 ? '' : config.stockQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        updateConfig(
                          product.id,
                          'stockQty',
                          isNaN(val) ? 0 : val
                        );
                      }}
                      min="0"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-black focus:border-black transition-colors"
                      placeholder="0"
                    />
                  </div>

                  {/* Visibility Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">
                      Visible in Catalog
                    </label>
                    <button
                      onClick={() =>
                        updateConfig(product.id, 'isActive', !config.isActive)
                      }
                      className={clsx(
                        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none',
                        config.isActive ? 'bg-black' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ml-1',
                          config.isActive ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Add to Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
