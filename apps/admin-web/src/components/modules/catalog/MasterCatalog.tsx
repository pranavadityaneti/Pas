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
  Image as ImageIcon,
  Plus,
  X,
  CreditCard,
  Tag
} from 'lucide-react';
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
  images?: ProductImage[];
}

export function MasterCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(p => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const handleUpdateProduct = async (id: string, field: string, value: any) => {
    try {
      await api.patch(`/products/${id}`, { [field]: value });
      toast.success(`Updated ${field}`);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    } catch (error) {
      toast.error(`Failed to update ${field}`);
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
        return { ...prev, images: updatedImages, image: (updatedImages.length > 0 && prevProduct.image) ? prevProduct.image : newMainImage };
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
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) || '';

    if (filterType === 'missing_image') return matchesSearch && !p.image;
    if (filterType === 'no_brand') return matchesSearch && !p.brand;

    return matchesSearch;
  });

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6 relative">
      {/* --- Header --- */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
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
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-blue-600" onClick={() => window.open('http://localhost:3000/products/export', '_blank')}>
            <Download className="w-4 h-4 mr-2" /> Export
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
            className="bg-gray-900 hover:bg-gray-800 text-white shadow-md transition-all hover:shadow-lg"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Search products..."
                className="pl-10 bg-white border-gray-200 focus:border-blue-500 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] bg-white">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <SelectValue placeholder="Filter" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="missing_image">Missing Image</SelectItem>
                <SelectItem value="no_brand">No Brand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-gray-900">{filteredProducts.length}</span> SKUs
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
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
                  <TableHead>Product Info</TableHead>
                  <TableHead className="w-[200px]">Category</TableHead>
                  <TableHead className="w-[150px]">Global MRP (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
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
                        defaultValue={product.category}
                        onValueChange={(value) => handleUpdateProduct(product.id, 'category', value)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dairy">Dairy</SelectItem>
                          <SelectItem value="Bakery">Bakery</SelectItem>
                          <SelectItem value="Snacks">Snacks</SelectItem>
                          <SelectItem value="Staples">Staples</SelectItem>
                          <SelectItem value="Condiments">Condiments</SelectItem>
                          <SelectItem value="Confectionery">Confectionery</SelectItem>
                          <SelectItem value="Grocery">Grocery</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={product.mrp}
                        className="h-8 w-24 text-right font-medium"
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
                ))}
              </TableBody>
            </Table>
          )}
        </div>
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
                {(editingProduct.images?.length || 0) < 5 && (
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
                  {editingProduct.images?.map((img, idx) => (
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
                          <div className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-white text-[9px] font-bold text-center py-0.5">
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
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="h-10 text-sm bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md shadow-sm"
                  />
                </div>

                {/* Brand & Category Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1.5">Brand</Label>
                    <Input
                      value={editingProduct.brand || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                      className="h-10 text-sm bg-white border-gray-300 shadow-sm"
                      placeholder="Generic"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1.5">Category</Label>
                    <Select
                      value={editingProduct.category}
                      onValueChange={(v) => setEditingProduct({ ...editingProduct, category: v })}
                    >
                      <SelectTrigger className="h-10 text-sm bg-white border-gray-300 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dairy">Dairy</SelectItem>
                        <SelectItem value="Bakery">Bakery</SelectItem>
                        <SelectItem value="Snacks">Snacks</SelectItem>
                        <SelectItem value="Staples">Staples</SelectItem>
                        <SelectItem value="Condiments">Condiments</SelectItem>
                        <SelectItem value="Confectionery">Confectionery</SelectItem>
                        <SelectItem value="Grocery">Grocery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* EAN & MRP Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1.5">EAN / Barcode</Label>
                    <Input
                      value={editingProduct.ean || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, ean: e.target.value })}
                      className="h-10 text-sm font-mono bg-white border-gray-300 shadow-sm"
                      placeholder="N/A"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1.5">MRP (₹)</Label>
                    <Input
                      type="number"
                      value={editingProduct.mrp}
                      onChange={(e) => setEditingProduct({ ...editingProduct, mrp: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="h-10 text-sm font-semibold text-gray-900 bg-white border-gray-300 shadow-sm"
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
    </div>
  );
}
