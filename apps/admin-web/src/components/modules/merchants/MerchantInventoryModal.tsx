import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/select";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
    Search,
    Store,
    Package,
    Loader2,
    ExternalLink,
    TrendingUp,
} from 'lucide-react';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Branch {
    id: string;
    name: string;
    address: string;
    active: boolean;
}

interface InventoryItem {
    id: string;
    storeId: string;
    productId: string;
    stock: number;
    price: number;
    active: boolean;
    product: {
        name: string;
        image: string | null;
        category: string;
        mrp: number;
    };
}

interface MerchantInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    merchant: {
        id: string;
        store_name: string;
    } | null;
}

export function MerchantInventoryModal({ isOpen, onClose, merchant }: MerchantInventoryModalProps) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isBranchesLoading, setIsBranchesLoading] = useState(false);

    useEffect(() => {
        if (isOpen && merchant) {
            setSearchQuery('');
            setInventory([]);
            fetchBranches();
        }
    }, [isOpen, merchant]);

    useEffect(() => {
        if (selectedBranchId) {
            fetchInventory();
        }
    }, [selectedBranchId, searchQuery]);

    const fetchBranches = async () => {
        if (!merchant) return;
        setIsBranchesLoading(true);
        try {
            const response = await api.get(`/merchants/${merchant.id}/branches`);
            setBranches(response.data);
            if (response.data.length > 0) {
                // Find the main store or just pick the first one
                const mainStore = response.data.find((b: Branch) => b.id === merchant.id) || response.data[0];
                setSelectedBranchId(mainStore.id);
            }
        } catch (error) {
            console.error('Failed to fetch branches:', error);
            toast.error('Failed to load merchant branches');
        } finally {
            setIsBranchesLoading(false);
        }
    };

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);

            const response = await api.get(`/merchants/${selectedBranchId}/inventory?${params.toString()}`);
            setInventory(response.data);
        } catch (error) {
            console.error('Failed to fetch inventory:', error);
            toast.error('Failed to load branch inventory');
        } finally {
            setLoading(false);
        }
    };

    if (!merchant) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl">
                {/* Header Section */}
                <div className="p-6 bg-gray-50/50 border-b border-gray-100 shrink-0">
                    <DialogHeader className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Store className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold text-gray-900">
                                        {merchant.store_name} Catalog
                                    </DialogTitle>
                                    <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                                        Managing Inventory & Stock Levels
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" onClick={() => window.open('/catalog', '_blank')}>
                                <ExternalLink className="w-3.5 h-3.5" />
                                Full Catalog View
                            </Button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Branch Selector */}
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Select Branch</label>
                                <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isBranchesLoading}>
                                    <SelectTrigger className="w-full bg-white border-gray-200">
                                        <SelectValue placeholder="Selecting branch..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branches.map(branch => (
                                            <SelectItem key={branch.id} value={branch.id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{branch.name}</span>
                                                    <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                                                        {branch.id === merchant.id ? 'Main' : 'Branch'}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Search */}
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Search Products</label>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-primary transition-colors" />
                                    <Input
                                        placeholder="Search in branch inventory..."
                                        className="pl-9 bg-white border-gray-200 focus-visible:ring-primary"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-auto bg-white p-6 pt-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
                            <p className="text-sm font-medium text-gray-400">Loading inventory data...</p>
                        </div>
                    ) : inventory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                            <div className="p-4 bg-gray-50 rounded-full">
                                <Package className="w-8 h-8 text-gray-300" />
                            </div>
                            <div>
                                <p className="text-gray-900 font-bold">No products found</p>
                                <p className="text-sm text-gray-500 max-w-[200px] mt-1">This branch hasn't added any items to their catalog yet.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm mt-6">
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow>
                                        <TableHead className="w-[80px]">Image</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="w-[120px]">Category</TableHead>
                                        <TableHead className="w-[100px] text-right">Price (₹)</TableHead>
                                        <TableHead className="w-[100px] text-right">Stock</TableHead>
                                        <TableHead className="w-[100px] text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventory.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                            <TableCell>
                                                <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-white">
                                                    <ImageWithFallback
                                                        src={item.product?.image || ''}
                                                        alt={item.product?.name || 'Unknown Product'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900 leading-tight">
                                                        {item.product?.name || 'Unknown Product'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 font-bold">
                                                        MRP: ₹{item.product?.mrp || 0}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none px-2 py-0.5 text-[10px] font-bold uppercase transition-all">
                                                    {item.product?.category || 'Uncategorized'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-gray-900">₹{item.price}</span>
                                                    {item.product?.mrp && item.price < item.product.mrp && (
                                                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                                            <TrendingUp className="w-2.5 h-2.5" />
                                                            Save {Math.round((1 - item.price / item.product.mrp) * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={`font-bold ${item.stock < 10 ? 'text-red-500' : 'text-gray-900'}`}>
                                                    {item.stock}
                                                </span>
                                                <span className="text-[10px] text-gray-400 block font-medium">Units</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={`${item.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'} px-2 py-0.5 text-[10px] font-bold uppercase border`}>
                                                    {item.active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* Footer Area */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <Package className="w-3.5 h-3.5" />
                        Showing {inventory.length} items in inventory
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-900">
                        Close Panel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
