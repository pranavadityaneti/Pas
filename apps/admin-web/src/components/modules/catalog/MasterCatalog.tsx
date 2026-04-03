import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Upload,
  Trash2,
  Edit,
  MoreHorizontal,
  Package,
  Barcode,
  Loader2,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  X,
  ChevronDown,
  Percent,
  FolderTree,
  Zap,
} from 'lucide-react';
import { LiveImportModal } from './LiveImportModal';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '../../ui/sheet';
import { Slider } from '../../ui/slider';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';
import api from '@/lib/api';

interface ProductImage {
  id: string;
  url: string;
  name?: string;
  isPrimary: boolean;
}

interface Product {
  id: string;
  name: string;
  category: string;
  mrp: number;
  image: string | null;
  ean?: string;
  brand?: string;
  createdByStoreId?: string | null;
  images?: ProductImage[];
  // New Fields
  unitType?: string;
  unitValue?: number;
  uom?: string;
  hsnCode?: string;
  gstRate?: number;
  vertical?: string | null;
}

interface SyncItem {
  id: string;
  name: string;
  brand: string | null;
  mrp: number;
  category: string;
  subcategory: string | null;
  packsize: string | null;
  image: string | null;
  vertical: string | null;
  sourceProductId: string;
  status: string;
  createdAt: string;
  metadata?: any;
}
// Centralized category list for consistency across all dropdowns
const VERTICALS = [
    'Grocery & Kirana', 'Fruits & Vegetables', 'Restaurants & Cafes', 
    'Bakeries & Desserts', 'Meat & Seafood', 'Pharmacy & Wellness', 
    'Electronics & Accessories', 'Fashion & Apparel', 'Home & Lifestyle', 
    'Beauty & Personal Care', 'Pet Care & Supplies'
];

const PRODUCT_CATEGORIES = [
    'Dairy & Milk', 'Staples & Pulse', 'Snacks & Munchies', 'Beverages', 
    'Personal Care', 'Home Essentials', 'Ready-to-Eat', 'Household Supply'
];

const CATEGORIES = [...VERTICALS, ...PRODUCT_CATEGORIES];

export function MasterCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogType, setCatalogType] = useState<'global' | 'custom' | 'sync_queue'>('global');
  
  // Live Sync States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activeSyncRunId, setActiveSyncRunId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeSyncRunId');
    }
    return null;
  });
  const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('activeSyncRunId');
    }
    return false;
  });

  // Server-Side Filters
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 50, page: 1 });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: [] as string[],
    brand: [] as string[], // Placeholder for now
    gstRate: [] as number[],
    priceRange: [0, 10000],
    missingData: [] as string[]
  });

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importReport, setImportReport] = useState<{ imported: number, skipped: any[] } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, searchQuery]);

  useEffect(() => {
    if (catalogType === 'sync_queue') {
      fetchSyncQueue();
    } else {
      fetchProducts();
    }
  }, [page, filters, searchQuery, catalogType]); // Re-fetch when any filter changes

  // Polling for Sync Queue status
  useEffect(() => {
    let interval: any;
    if (isSyncing && activeSyncRunId) {
      // Poll specific run status
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/catalog/sync/status/${activeSyncRunId}`);
          if (res.data?.status === 'SUCCEEDED') {
            toast.success('Products successfully arrived in the Sync Queue!');
            setIsSyncing(false);
            setActiveSyncRunId(null);
            localStorage.removeItem('activeSyncRunId');
            fetchSyncQueue();
          } else if (res.data?.status === 'FAILED') {
            toast.error('Live sync failed.');
            setIsSyncing(false);
            setActiveSyncRunId(null);
            localStorage.removeItem('activeSyncRunId');
          }
        } catch (e) {
          console.error("Status check failed", e);
        }
      }, 5000); // 5 seconds
    } else if (catalogType === 'sync_queue') {
      interval = setInterval(() => {
        fetchSyncQueue();
      }, 10000); // Relaxed polling just to keep UI fresh if on tab
    }
    return () => clearInterval(interval);
  }, [isSyncing, activeSyncRunId, catalogType]);

  const fetchSyncQueue = async () => {
    try {
      const response = await api.get('/catalog/sync/queue');
      setSyncQueue(response.data);
      
      // If we were syncing and items appear, we can stop the aggressive isSyncing status
      // but keep polling if we're on the sync_queue tab
      if (isSyncing && response.data.length > 0) {
        // We could check if run is actually finished, but for now this is fine
      }
    } catch (error) {
      console.error('Failed to fetch sync queue:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '50');
      if (searchQuery) params.append('search', searchQuery);

      if (filters.category.length > 0) params.append('category', filters.category.join(','));
      if (filters.gstRate.length > 0) params.append('gstRate', filters.gstRate.join(','));
      if (filters.missingData.length > 0) params.append('missingData', filters.missingData.join(','));
      params.append('type', catalogType);

      // Price Range
      if (filters.priceRange[0] > 0) params.append('minPrice', filters.priceRange[0].toString());
      if (filters.priceRange[1] < 10000) params.append('maxPrice', filters.priceRange[1].toString());

      const response = await api.get(`/products?${params.toString()}`);

      console.log('API Response:', response.data);
      if (response.data.pagination) {
        setProducts(Array.isArray(response.data.data) ? response.data.data : []);
        setPagination(response.data.pagination);
      } else {
        // Fallback for array response
        setProducts(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const getActiveListIds = () => catalogType === 'sync_queue' ? syncQueue.map(p => p.id) : products.map(p => p.id);

  const toggleSelectAll = () => {
    const activeIds = getActiveListIds();
    if (selectedProducts.length === activeIds.length && activeIds.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(activeIds);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(p => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const handleSyncQueueEdit = (id: string, field: keyof SyncItem, value: any) => {
    setSyncQueue(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleApproveSyncItems = async () => {
    if (selectedProducts.length === 0) return;
    const toastId = toast.loading(`Approving ${selectedProducts.length} items to Master Catalog...`);

    try {
      const itemsToApprove = syncQueue.filter(item => selectedProducts.includes(item.id));
      const response = await api.post('/catalog/sync/approve', { items: itemsToApprove });
      toast.success(response.data.message || 'Items approved and added to catalog!', { id: toastId });
      
      setSyncQueue(prev => prev.filter(item => !selectedProducts.includes(item.id)));
      setSelectedProducts([]);
      
      // Refresh global products so changes reflect instantly
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve items', { id: toastId });
    }
  };

  const handleRejectSyncItems = async () => {
    if (selectedProducts.length === 0) return;
    const confirm = window.confirm(`Are you sure you want to permanently delete ${selectedProducts.length} scratched item(s) from the queue?`);
    if (!confirm) return;

    const toastId = toast.loading(`Deleting ${selectedProducts.length} items...`);

    try {
      await api.post('/catalog/sync/reject', { ids: selectedProducts });
      toast.success(`Items permanently deleted!`, { id: toastId });
      
      setSyncQueue(prev => prev.filter(item => !selectedProducts.includes(item.id)));
      setSelectedProducts([]);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete items', { id: toastId });
    }
  };

  const handleUpdateProduct = async (id: string, field: string, value: any) => {
    // OPTIMISTIC UPDATE: Update UI immediately
    const previousProducts = [...products];
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

    // Show loading toast immediately
    const toastId = toast.loading(`Updating ${field}...`);

    try {
      await api.patch(`/products/${id}`, { [field]: value });
      toast.success(`Saved!`, { id: toastId });
    } catch (error) {
      // ROLLBACK on error
      setProducts(previousProducts);
      toast.error(`Failed to update ${field}`, { id: toastId });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  // --- Bulk Actions ---
  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedProducts.length} product(s)? This action cannot be undone.`
    );
    if (!confirmed) return;

    const toastId = toast.loading(`Deleting ${selectedProducts.length} products...`);

    try {
      const response = await api.post('/products/bulk-delete', { ids: selectedProducts });
      toast.success(response.data.message, { id: toastId });
      setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
    } catch (error) {
      toast.error('Failed to delete products', { id: toastId });
    }
  };

  const handleBulkUpdateCategory = async (category: string) => {
    if (selectedProducts.length === 0) return;
    const toastId = toast.loading(`Updating category to ${category}...`);

    try {
      const response = await api.post('/products/bulk-update', {
        ids: selectedProducts,
        updates: { category }
      });
      toast.success(response.data.message, { id: toastId });
      setProducts(prev => prev.map(p =>
        selectedProducts.includes(p.id) ? { ...p, category } : p
      ));
      setSelectedProducts([]);
    } catch (error) {
      toast.error('Failed to update products', { id: toastId });
    }
  };

  const handleBulkUpdateGST = async (gstRate: number) => {
    if (selectedProducts.length === 0) return;
    const toastId = toast.loading(`Updating GST rate to ${gstRate}%...`);

    try {
      const response = await api.post('/products/bulk-update', {
        ids: selectedProducts,
        updates: { gstRate }
      });
      toast.success(response.data.message, { id: toastId });
      setProducts(prev => prev.map(p =>
        selectedProducts.includes(p.id) ? { ...p, gstRate } : p
      ));
      setSelectedProducts([]);
    } catch (error) {
      toast.error('Failed to update products', { id: toastId });
    }
  };

  const handleBulkExport = async () => {
    if (selectedProducts.length === 0) return;
    const toastId = toast.loading(`Exporting ${selectedProducts.length} products...`);

    try {
      const response = await api.post('/products/export-selected', { ids: selectedProducts }, { responseType: 'blob' });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export downloaded successfully', { id: toastId });
      setSelectedProducts([]);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export products', { id: toastId });
    }
  };

  // --- Bulk Import ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const promise = api.post('/products/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    toast.promise(promise, {
      loading: 'Importing products...',
      success: (response) => {
        fetchProducts();
        if (response.data.skippedCount > 0) {
          setImportReport({
            imported: response.data.importedCount,
            skipped: response.data.skipped
          });
          return `Imported ${response.data.importedCount} items. ${response.data.skippedCount} skipped.`;
        }
        return response.data.message;
      },
      error: 'Failed to import products'
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Image Upload (Add to Gallery) ---
  const handleAddImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingProduct) return;

    setIsUploading(true);

    try {
      // Step 1: Upload the physical file to storage
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await api.post('/products/upload-image', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { url } = uploadResponse.data;
      if (!url) throw new Error('No URL returned from upload');

      // Step 2: Link image to product in DB
      // First image is always primary LOGIC
      const isFirstImage = !editingProduct.images || editingProduct.images.length === 0;

      const linkResponse = await api.post(`/products/${editingProduct.id}/images`, {
        url,
        name: file.name.split('.')[0],
        isPrimary: isFirstImage
      });

      const newImage = linkResponse.data;

      // Update both local editing state AND the global products list
      const updateState = (prevProduct: Product) => {
        const updatedImages = prevProduct.images ? [...prevProduct.images, newImage] : [newImage];
        const shouldUpdateMain = isFirstImage || (prevProduct.images?.length === 0);
        return {
          ...prevProduct,
          images: updatedImages,
          image: shouldUpdateMain ? newImage.url : prevProduct.image
        };
      };

      setEditingProduct(prev => prev ? updateState(prev) : null);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updateState(p) : p));

      toast.success('Image added successfully');
    } catch (error: any) {
      console.error('Upload Error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload image. Check server logs.');
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    if (!editingProduct) return;
    try {
      await api.delete(`/products/images/${imageId}`);

      const updateState = (prevProduct: Product) => {
        const updatedImages = prevProduct.images?.filter(img => img.id !== imageId) || [];
        const newMainImage = updatedImages.length > 0 ? updatedImages[0].url : null;
        return { ...prevProduct, images: updatedImages, image: (updatedImages.length > 0 && prevProduct.image) ? prevProduct.image : newMainImage };
      };

      setEditingProduct(prev => prev ? updateState(prev) : null);
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updateState(p) : p));

      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
  };

  // --- Save Edit Modal ---
  const saveEdit = async () => {
    if (!editingProduct) return;
    try {
      const { id, name, category, mrp, brand, ean, image } = editingProduct;

      // Ensure payload types are correct
      const payload = {
        name,
        category,
        vertical: editingProduct.vertical || null,
        mrp: Number(mrp), // Explicit number conversion
        brand: brand || null,
        ean: ean || null,
        image
      };

      await api.patch(`/products/${id}`, payload);

      toast.success('Product details saved');

      setProducts(prev => prev.map(p => p.id === id ? editingProduct : p));
      setIsEditOpen(false);
    } catch (error: any) {
      console.error('Save Error:', error);
      toast.error(error.response?.data?.error || 'Failed to save changes');
    }
  };

  // --- Filters ---
  // Client-side filtering removed in favor of Server-Side Pagination
  // The 'products' state now contains only the relevant items


  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6 relative">
      {/* --- Header --- */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#B52725] rounded-lg shadow-lg shadow-red-200">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Global Inventory Catalog</h1>
            <p className="text-sm text-gray-500 font-medium">Repository & Pricing Standard</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-blue-600" onClick={() => window.open('http://localhost:3000/products/template', '_blank')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Template
          </Button>
          <div className="w-px h-4 bg-gray-200"></div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            style={{ display: 'none' }}
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            variant="outline"
            className="border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition-all"
            onClick={() => setIsSyncModalOpen(true)}
          >
            <Zap className="w-4 h-4 mr-2 fill-amber-500 text-amber-500" />
            Refresh Import
          </Button>

          <Button
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-white shadow-md transition-all hover:shadow-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      {/* --- Syncing Background Task Banner --- */}
      {isSyncing && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">Live Sync in Progress...</h4>
              <p className="text-xs text-amber-700 font-medium">Extracting products directly from our Quick Commerce partner. This can take 1-2 minutes. Please do not refresh the page.</p>
            </div>
          </div>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-none border border-amber-200">
            Polling Apify Status...
          </Badge>
        </div>
      )}

      {/* --- Filter Tabs --- */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-4 font-medium transition-colors ${catalogType === 'global' ? 'border-b-2 border-[#B52725] text-[#B52725]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setCatalogType('global'); setPage(1); }}
        >
          Global Catalog
        </button>
        <button
          className={`pb-2 px-4 font-medium transition-colors ${catalogType === 'custom' ? 'border-b-2 border-[#B52725] text-[#B52725]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setCatalogType('custom'); setPage(1); }}
        >
          Merchant Requests
        </button>
        <button
          className={`pb-2 px-4 font-medium transition-colors ${catalogType === 'sync_queue' ? 'border-b-2 border-[#B52725] text-[#B52725]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setCatalogType('sync_queue'); setPage(1); }}
        >
          <div className="flex items-center gap-2">
            Sync Queue
            {syncQueue.length > 0 && (
              <Badge className="bg-[#B52725] text-white hover:bg-[#B52725] text-[10px] h-4 px-1">
                {syncQueue.length}
              </Badge>
            )}
          </div>
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-[#B52725] transition-colors" />
              <Input
                placeholder="Search products..."
                className="pl-10 bg-white border-gray-200 focus:border-[#B52725] transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Sheet */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white relative">
                  <Filter className="w-4 h-4 text-gray-500" />
                  Filters
                  {(filters.category.length > 0 || filters.gstRate.length > 0 || filters.missingData.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] bg-blue-50 text-blue-700 hover:bg-blue-100">
                      {filters.category.length + filters.gstRate.length + filters.missingData.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white shrink-0">
                  <SheetHeader>
                    <SheetTitle className="text-xl font-bold text-gray-900">Filter Inventory</SheetTitle>
                  </SheetHeader>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
                  <div className="space-y-6">

                    {/* Categories Card */}
                    <div className="space-y-4">
                      <Label className="text-base font-semibold text-gray-900">Categories</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {CATEGORIES.map(cat => (
                          <div key={cat} className="flex items-center space-x-2">
                            <Checkbox
                              id={`cat-${cat}`}
                              checked={filters.category.includes(cat)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  category: checked
                                    ? [...prev.category, cat]
                                    : prev.category.filter(c => c !== cat)
                                }));
                              }}
                              className="data-[state=checked]:bg-gray-900 border-gray-300"
                            />
                            <label htmlFor={`cat-${cat}`} className="text-sm text-gray-700 font-medium leading-none cursor-pointer hover:text-gray-900">
                              {cat}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Price Range */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold text-gray-900">Price Range</Label>
                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          ₹{filters.priceRange[0]} - ₹{filters.priceRange[1]}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <Slider
                          defaultValue={[0, 10000]}
                          max={10000}
                          step={100}
                          value={filters.priceRange}
                          onValueChange={(val) => setFilters(prev => ({ ...prev, priceRange: val }))}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* GST Rate */}
                    <div className="space-y-4">
                      <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-gray-500" /> GST Rate
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {[0, 5, 12, 18, 28].map(rate => (
                          <div key={rate}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-all ${filters.gstRate.includes(rate)
                              ? 'bg-gray-900 border-gray-900 text-white shadow-md transform scale-105'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            onClick={() => {
                              setFilters(prev => ({
                                ...prev,
                                gstRate: prev.gstRate.includes(rate)
                                  ? prev.gstRate.filter(r => r !== rate)
                                  : [...prev.gstRate, rate]
                              }));
                            }}
                          >
                            {rate}%
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Data Quality */}
                    <div className="bg-orange-50/50 rounded-xl p-6 border border-orange-100 space-y-4">
                      <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                        Data Quality Issues
                      </Label>
                      <div className="space-y-3">
                        {['image', 'brand', 'hsn'].map(field => (
                          <div key={field} className="flex items-center space-x-2">
                            <Checkbox
                              id={`miss-${field}`}
                              checked={filters.missingData.includes(field)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  missingData: checked
                                    ? [...prev.missingData, field]
                                    : prev.missingData.filter(f => f !== field)
                                }));
                              }}
                              className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 border-orange-200"
                            />
                            <label htmlFor={`miss-${field}`} className="text-sm font-medium leading-none capitalize cursor-pointer text-gray-700">
                              Missing {field === 'hsn' ? 'HSN Code' : field}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 bg-white px-6 py-4 flex justify-between items-center shrink-0">
                  <Button
                    variant="ghost"
                    className="text-gray-500 hover:text-gray-900"
                    onClick={() => setFilters({
                      category: [],
                      brand: [],
                      gstRate: [],
                      priceRange: [0, 10000],
                      missingData: []
                    })}>
                    Reset All
                  </Button>
                  <Button
                    className="bg-gray-900 hover:bg-gray-800 text-white px-8 shadow-lg shadow-gray-200"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    View Results
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {(filters.category.length > 0 || filters.gstRate.length > 0 || filters.missingData.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setFilters({ category: [], brand: [], gstRate: [], priceRange: [0, 10000], missingData: [] })}
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
            <Package className="w-4 h-4 text-[#B52725]" />
            <span className="font-semibold text-gray-900">{pagination.total}</span> SKUs
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto flex flex-col">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#B52725]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedProducts.length === products.length && products.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead className="w-[180px]">Vertical (Tier 1)</TableHead>
                    <TableHead className="w-[180px]">Category (Tier 2)</TableHead>
                    <TableHead className="w-[150px]">Global MRP (₹)</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogType === 'sync_queue' ? (
                    syncQueue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-64 text-center text-gray-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Zap className="w-8 h-8 opacity-20" />
                            <p>No items in sync queue. Pull some data!</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncQueue.map((item: SyncItem) => (
                        <TableRow key={item.id} className="hover:bg-gray-50/50">
                          <TableCell className="w-[50px]">
                            <Checkbox
                              checked={selectedProducts.includes(item.id)}
                              onCheckedChange={() => toggleSelect(item.id)}
                            />
                          </TableCell>
                          <TableCell className="w-[80px]">
                            <ImageWithFallback
                              src={item.image || ''}
                              alt={item.name}
                              className="w-12 h-12 rounded-lg object-contain border border-gray-100 bg-white"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-900 leading-tight">{item.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Label className="text-[10px] text-gray-500 w-8 uppercase tracking-wider font-bold">Brand</Label>
                                <Input 
                                  value={item.brand || ''}
                                  placeholder="Generic"
                                  className="h-6 text-xs flex-1 max-w-[150px] bg-white border-gray-200"
                                  onChange={(e) => handleSyncQueueEdit(item.id, 'brand', e.target.value)}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input 
                              value={item.packsize || ''}
                              placeholder="e.g. 250 g"
                              className="h-8 text-sm bg-white border-gray-200 shadow-sm font-medium"
                              onChange={(e) => handleSyncQueueEdit(item.id, 'packsize', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.vertical || ''}
                              onValueChange={(value) => handleSyncQueueEdit(item.id, 'vertical', value)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs bg-amber-50 border-amber-200 font-semibold text-amber-900">
                                <SelectValue placeholder="Vertical" />
                              </SelectTrigger>
                              <SelectContent>
                                {VERTICALS.map(v => (
                                  <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.category || ''}
                              onValueChange={(value) => handleSyncQueueEdit(item.id, 'category', value)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs bg-white border-gray-200 shadow-sm">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-500">₹</span>
                              <Input
                                type="number"
                                value={item.mrp || 0}
                                className="h-8 w-20 text-right font-bold bg-white border-gray-200 shadow-sm"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  handleSyncQueueEdit(item.id, 'mrp', val);
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50/50 font-bold whitespace-nowrap">
                               {item.status}
                             </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )
                  ) : (
                    Array.isArray(products) && products.map((product) => (
                    <TableRow key={product.id} className="group hover:bg-gray-50/80 transition-colors">
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-white relative group cursor-pointer shadow-sm"
                          onClick={() => { setEditingProduct(product); setIsEditOpen(true); }}>
                          <ImageWithFallback
                            src={product.image || ''}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Edit className="w-4 h-4 text-white drop-shadow-md" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{product.name}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Barcode className="w-3 h-3" /> {product.ean || 'N/A'} • {product.brand || 'Generic'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={product.vertical || ''}
                          onValueChange={(value) => handleUpdateProduct(product.id, 'vertical', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs bg-amber-50 border-amber-200 font-semibold text-amber-900">
                            <SelectValue placeholder="Vertical" />
                          </SelectTrigger>
                          <SelectContent>
                            {VERTICALS.map(v => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 font-medium">{product.uom || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={product.category}
                          onValueChange={(value) => handleUpdateProduct(product.id, 'category', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_CATEGORIES.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.mrp}
                          className="h-8 w-24 text-right font-medium"
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, mrp: val } : p));
                          }}
                          onBlur={(e) => handleUpdateProduct(product.id, 'mrp', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setEditingProduct(product); setIsEditOpen(true); }}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)} className="text-red-600 focus:text-red-500">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>

              {/* Pagination Area */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
                <span className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- Refactored Edit Modal (Clean & Spacious) --- */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg bg-white rounded-xl shadow-2xl border-0 p-0 gap-0 overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white relative">
              <DialogTitle className="text-lg font-bold text-gray-900">Edit Product</DialogTitle>
              <div className="flex items-center gap-4 pr-6"> {/* pr-6 to avoid overlap with close button which is usually absolute right-4 */}
                <div className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                  Public
                </div>
              </div>
            </div>

            {editingProduct && (
              <div className="p-6 overflow-y-auto max-h-[80vh]">

                {/* Images Section */}
                <div className="mb-6">
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Product Media</Label>

                  {/* Full Width Upload */}
                  {(editingProduct?.images?.length || 0) < 5 && (
                    <div
                      className="w-full h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 cursor-pointer flex flex-col items-center justify-center gap-2 transition-all group mb-4"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                      <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Click to Upload Image</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={imageInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleAddImage}
                  />

                  {/* Image List */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {editingProduct?.images?.map((img, idx) => (
                      <div key={img.id} className="relative group flex-shrink-0 w-20">
                        <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-white relative">
                          <img src={img.url} alt="Prod" className="w-full h-full object-cover" />
                          <button
                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => handleRemoveImage(img.id)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {idx === 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-[#B52725]/90 text-white text-[9px] font-bold text-center py-0.5">
                              MAIN
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Fields Container */}
                <div className="space-y-4">

                  {/* Name */}
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name</Label>
                    <Input
                      value={editingProduct?.name || ''}
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="h-10 text-sm bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md shadow-sm"
                    />
                  </div>

                  {/* Brand & Category Grid */}
                  {/* Vertical & Category Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">Store Vertical</Label>
                      <Select
                        value={editingProduct?.vertical || ''}
                        onValueChange={(v) => setEditingProduct(prev => prev ? { ...prev, vertical: v } : null)}
                      >
                        <SelectTrigger className="h-10 text-sm bg-white border-gray-300 shadow-sm">
                          <SelectValue placeholder="Select Vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          {VERTICALS.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">Product Category</Label>
                      <Select
                        value={editingProduct?.category}
                        onValueChange={(v) => setEditingProduct(prev => prev ? { ...prev, category: v } : null)}
                      >
                        <SelectTrigger className="h-10 text-sm bg-white border-gray-300 shadow-sm">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* EAN & MRP Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">EAN / Barcode</Label>
                      <Input
                        value={editingProduct?.ean || ''}
                        onChange={(e) => setEditingProduct(prev => prev ? { ...prev, ean: e.target.value } : null)}
                        className="h-10 text-sm font-mono bg-white border-gray-300 shadow-sm"
                        placeholder="N/A"
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">MRP (₹)</Label>
                      <Input
                        type="number"
                        value={editingProduct?.mrp}
                        onChange={(e) => setEditingProduct(prev => prev ? { ...prev, mrp: e.target.value === '' ? 0 : parseFloat(e.target.value) } : null)}
                        className="h-10 text-sm font-semibold text-gray-900 bg-white border-gray-300 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Commerce Details Grid (GST, HSN, Unit) */}
                  <div className="grid grid-cols-3 gap-4 border-t border-gray-50 pt-4 mt-2">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Type</Label>
                      <Select
                        value={editingProduct?.unitType || ''}
                        onValueChange={(v) => setEditingProduct(prev => prev ? { ...prev, unitType: v } : null)}
                      >
                        <SelectTrigger className="h-10 text-sm bg-white border-gray-300 shadow-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="pc">pc</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Value</Label>
                      <Input
                        type="number"
                        value={editingProduct?.unitValue || ''}
                        onChange={(e) => setEditingProduct(prev => prev ? { ...prev, unitValue: parseFloat(e.target.value) } : null)}
                        className="h-10 text-sm bg-white border-gray-300 shadow-sm"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">GST Rate (%)</Label>
                      <Select
                        value={String(editingProduct?.gstRate ?? '')}
                        onValueChange={(v) => setEditingProduct(prev => prev ? { ...prev, gstRate: parseFloat(v) } : null)}
                      >
                        <SelectTrigger className="h-10 text-sm bg-white border-gray-300 shadow-sm">
                          <SelectValue placeholder="Tax" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="block text-sm font-medium text-gray-700 mb-1.5">HSN Code</Label>
                      <Input
                        value={editingProduct?.hsnCode || ''}
                        onChange={(e) => setEditingProduct(prev => prev ? { ...prev, hsnCode: e.target.value } : null)}
                        className="h-10 text-sm font-mono bg-white border-gray-300 shadow-sm"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-gray-50">
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditOpen(false)}
                    className="text-gray-600 hover:text-gray-900 h-10 px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveEdit}
                    className="bg-gray-900 hover:bg-black text-white px-6 h-10 shadow-sm font-medium"
                  >
                    Save Changes
                  </Button>
                </div>

              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* --- Import Report Dialog --- */}
        <Dialog open={!!importReport} onOpenChange={(open) => !open && setImportReport(null)}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogTitle className="text-red-600">Import Issues Found</DialogTitle>
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <p className="text-sm text-red-800">
                  Successfully imported <strong>{importReport?.imported}</strong> products.
                  <br />
                  However, <strong>{importReport?.skipped.length}</strong> items were skipped due to errors.
                </p>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importReport?.skipped.map((skip, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{skip.row}</TableCell>
                        <TableCell>{skip.name}</TableCell>
                        <TableCell className="text-red-600 font-medium text-xs">{skip.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setImportReport(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* --- FLOATING BULK ACTION BAR --- */}
        {
          selectedProducts.length > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700">
                {/* Selection Count */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">
                    {selectedProducts.length}
                  </div>
                  <span className="text-sm font-medium text-gray-300">selected</span>
                </div>

                <div className="w-px h-8 bg-gray-600"></div>

                {catalogType === 'sync_queue' ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-[#B52725] hover:bg-[#8e1d1b] text-white shadow-md transition-all gap-2 px-4 whitespace-nowrap"
                      onClick={handleApproveSyncItems}
                    >
                      <Plus className="w-4 h-4" />
                      Approve Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 gap-2 shrink-0 border border-red-900/50 line-clamp-1"
                      onClick={handleRejectSyncItems}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Change Category */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-gray-800 gap-2">
                          <FolderTree className="w-4 h-4" />
                          Category
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-48">
                        <DropdownMenuLabel>Change Category</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {CATEGORIES.map(cat => (
                          <DropdownMenuItem key={cat} onClick={() => handleBulkUpdateCategory(cat)}>
                            {cat}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Change GST Rate */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-gray-800 gap-2">
                          <Percent className="w-4 h-4" />
                          GST Rate
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-40">
                        <DropdownMenuLabel>Set GST Rate</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[0, 5, 12, 18, 28].map(rate => (
                          <DropdownMenuItem key={rate} onClick={() => handleBulkUpdateGST(rate)}>
                            {rate}%
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Export Selected */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-gray-800 gap-2"
                      onClick={handleBulkExport}
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </Button>

                    <div className="w-px h-8 bg-gray-600"></div>

                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 gap-2"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </>
                )}

                {/* Clear Selection */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={() => setSelectedProducts([])}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        }
      </div>
      <LiveImportModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        onSyncTriggered={(runId) => {
          setActiveSyncRunId(runId);
          setIsSyncing(true);
          localStorage.setItem('activeSyncRunId', runId);
          setCatalogType('sync_queue');
        }} 
      />
    </div>
  );
}

export default MasterCatalog;
