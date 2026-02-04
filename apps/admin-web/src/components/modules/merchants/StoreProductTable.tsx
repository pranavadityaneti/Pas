import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "../../ui/table";
import { Badge } from "../../ui/badge";
import { Switch } from "../../ui/switch";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Star, Search, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";

interface StoreProductTableProps {
    storeId: string;
}

interface ProductItem {
    id: string; // StoreProduct ID
    stock: number;
    price: number; // Selling Price
    active: boolean;
    is_best_seller: boolean;
    product: {
        name: string;
        image: string;
        mrp: number;
        category: string;
        brand: string;
    };
}

export function StoreProductTable({ storeId }: StoreProductTableProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    // const { toast } = useToast(); // Sonner imports directly

    const fetchInventory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('StoreProduct')
            .select(`
                id, stock, price, active, is_best_seller,
                product:productId (name, image, mrp, category, brand)
            `)
            .eq('storeId', storeId)
            .order('active', { ascending: false });

        if (error) {
            console.error(error);
            toast.error("Error fetching inventory");
        } else {
            // Transform data to match ProductItem interface if needed, or cast
            const formattedData = (data || []).map((item: any) => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product
            })).filter((item: any) => item.product); // Filter out items with missing product relation
            setProducts(formattedData as ProductItem[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (storeId) fetchInventory();
    }, [storeId]);

    const handleUpdate = async (id: string, updates: Partial<ProductItem>) => {
        // Optimistic Update
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

        const { error } = await supabase
            .from('StoreProduct')
            .update(updates)
            .eq('id', id);

        if (error) {
            toast.error("Update failed");
            fetchInventory(); // Revert on fail
        }
    };

    const filteredProducts = products.filter(p =>
        p.product.name.toLowerCase().includes(search.toLowerCase()) ||
        p.product.category.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading inventory...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                    className="bg-transparent text-sm active:outline-none focus:outline-none w-full"
                    placeholder="Search products..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="rounded-md border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[300px]">Product</TableHead>
                            <TableHead className="w-[100px]">Stock</TableHead>
                            <TableHead className="w-[120px]">Price (₹)</TableHead>
                            <TableHead className="w-[100px] text-center">Status</TableHead>
                            <TableHead className="w-[80px] text-center">Best Seller</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-40 text-center text-gray-500">
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No products found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map(item => {
                                const discount = item.product.mrp > 0
                                    ? Math.round(((item.product.mrp - item.price) / item.product.mrp) * 100)
                                    : 0;

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={item.product.image || 'https://placehold.co/40x40'}
                                                    className="w-10 h-10 rounded-md bg-gray-100 object-cover"
                                                />
                                                <div>
                                                    <div className="font-medium text-sm text-gray-900 line-clamp-1">
                                                        {item.product.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {item.product.category} • MRP: ₹{item.product.mrp}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                className={`h-8 w-20 ${item.stock === 0 ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                                                value={item.stock}
                                                onChange={e => handleUpdate(item.id, { stock: parseInt(e.target.value) || 0 })}
                                            />
                                            {item.stock < 10 && item.stock > 0 && (
                                                <div className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Low Stock
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-24"
                                                    value={item.price}
                                                    onChange={e => handleUpdate(item.id, { price: parseFloat(e.target.value) || 0 })}
                                                />
                                                {discount > 0 && (
                                                    <Badge variant="secondary" className="bg-green-50 text-green-700 text-[10px] w-fit">
                                                        {discount}% OFF
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={item.active}
                                                onCheckedChange={checked => handleUpdate(item.id, { active: checked })}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`hover:bg-yellow-50 ${item.is_best_seller ? 'text-yellow-500' : 'text-gray-300'}`}
                                                onClick={() => handleUpdate(item.id, { is_best_seller: !item.is_best_seller })}
                                            >
                                                <Star className={`w-5 h-5 ${item.is_best_seller ? 'fill-current' : ''}`} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
