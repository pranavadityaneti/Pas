import React, { useState, useEffect } from 'react';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import { Search, Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface InventoryItem {
  id: string; // store_inventory id
  product_id: string; // master product id
  price: number;
  inStock: boolean;
  // Joined fields
  master: {
    name: string;
    image: string;
    category: string;
    mrp: number;
  }
}

interface CatalogItem {
  id: string;
  name: string;
  image: string;
  category: string;
  mrp: number;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (isAddOpen) {
      searchCatalog();
    }
  }, [catalogSearch, isAddOpen]);

  const fetchInventory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('store_inventory')
      .select(`
            id, product_id, price, is_available,
            products (name, image, category, mrp)
        `)
      .eq('store_id', user.id);

    if (error) {
      console.error(error);
      return;
    }

    const simple = data.map((d: any) => ({
      id: d.id,
      product_id: d.product_id,
      price: d.price,
      inStock: d.is_available,
      master: d.products
    }));
    setItems(simple);
    setLoading(false);
  };

  const searchCatalog = async () => {
    setSearchingCatalog(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use RPC to search excluding owned items
    const { data, error } = await supabase.rpc('search_master_catalog_for_store', {
      p_store_id: user.id,
      p_query: catalogSearch
    });

    if (!error && data) {
      setCatalogResults(data);
    }
    setSearchingCatalog(false);
  }

  const addToInventory = async (product: CatalogItem) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    toast.loading("Adding product...");

    const { error } = await supabase.from('store_inventory').insert({
      store_id: user.id,
      product_id: product.id,
      price: product.mrp, // Default to MSRP
      is_available: true
    });

    if (error) {
      toast.dismiss();
      toast.error("Failed to add product");
    } else {
      toast.dismiss();
      toast.success("Added to inventory");
      fetchInventory(); // Refresh list
      // Remove from local search results to prevent double add
      setCatalogResults(prev => prev.filter(p => p.id !== product.id));
    }
  };

  const updateItem = async (id: string, updates: any) => {
    // Optimistic
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));

    const payload: any = {};
    if ('price' in updates) payload.price = updates.price;
    if ('inStock' in updates) payload.is_available = updates.inStock;

    await supabase.from('store_inventory').update(payload).eq('id', id);
  };

  const removeItem = async (id: string) => {
    if (!confirm("Remove this item from your store?")) return;

    setItems(items.filter(i => i.id !== id));
    await supabase.from('store_inventory').delete().eq('id', id);
    toast.success("Item removed");
  }

  const filteredItems = items.filter(i =>
    i.master?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="px-6 py-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Catalog</h1>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search my items..."
              className="pl-9 bg-gray-50 border-gray-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" className="h-10 w-10 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-lg top-2">
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[80vh] flex flex-col p-0 gap-0 max-w-md w-full">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Add to Catalog</DialogTitle>
            </DialogHeader>
            <div className="p-4 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search generic names..."
                  className="pl-9"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {searchingCatalog ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : (
                <div className="space-y-2">
                  {catalogResults.map(prod => (
                    <div key={prod.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 cursor-pointer group">
                      <div className="h-12 w-12 rounded overflow-hidden bg-white border">
                        <ImageWithFallback src={prod.image} alt={prod.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{prod.name}</h4>
                        <p className="text-xs text-gray-500">{prod.category}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => addToInventory(prod)}>
                        Add
                      </Button>
                    </div>
                  ))}
                  {catalogResults.length === 0 && !searchingCatalog && (
                    <p className="text-center text-gray-400 text-sm mt-8">No results in Master Catalog.</p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="divide-y divide-gray-100 pb-20">
            {filteredItems.map(({ id, price, inStock, master }) => (
              <div key={id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                  <ImageWithFallback
                    src={master?.image}
                    alt={master?.name}
                    className={cn("h-full w-full object-cover transition-opacity", !inStock && "opacity-50 grayscale")}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-sm font-medium text-gray-900 truncate", !inStock && "text-gray-500 line-through decoration-gray-300")}>
                    {master?.name}
                  </h3>
                  <div className="mt-1 flex items-center text-sm text-gray-500">
                    <span className="mr-1">₹</span>
                    <input
                      type="number"
                      className="w-20 p-1 border rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 text-gray-900 font-semibold"
                      value={price}
                      onChange={(e) => updateItem(id, { price: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-gray-400 ml-2">MSRP: {master?.mrp}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={inStock}
                    onCheckedChange={(val) => updateItem(id, { inStock: val })}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="text-gray-500 mb-2">Your inventory is empty.</p>
                <Button variant="outline" onClick={() => setIsAddOpen(true)}>Add items from Master Catalog</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
