import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Badge } from "../../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Store, MapPin, Phone, Mail, History, ShoppingCart, Star } from "lucide-react";
import { Merchant, useMerchants } from "../../../hooks/useMerchants";
import { StoreProductTable } from "./StoreProductTable";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface MerchantDetailsSheetProps {
    merchant: Merchant | null;
    isOpen: boolean;
    onClose: () => void;
}

export function MerchantDetailsSheet({ merchant, isOpen, onClose }: MerchantDetailsSheetProps) {
    const { getMerchantStats } = useMerchants();
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (merchant && isOpen) {
            const fetchData = async () => {
                setLoading(true);
                // 1. Fetch Orders directly implies real-time data
                const { data: orderData } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('store_id', merchant.id)
                    .order('created_at', { ascending: false });
                setOrders(orderData || []);

                // 2. Fetch Real Stats (using V2 RPC)
                const realStats = await getMerchantStats(merchant.id);
                setStats(realStats);

                setLoading(false);
            };
            fetchData();
        }
    }, [merchant, isOpen]);

    if (!merchant) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-[700px] p-0 flex flex-col h-full bg-white border-l shadow-2xl">
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Header Section */}
                    <div className="p-8 pb-4 border-b border-gray-50 bg-gradient-to-b from-gray-50/50 to-transparent">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 duration-200">
                                <Store className="w-10 h-10 text-white" />
                            </div>
                            <div className="space-y-1.5 flex-1">
                                <SheetTitle className="text-2xl font-bold text-gray-900 leading-tight">
                                    {merchant.store_name}
                                </SheetTitle>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge
                                        variant="outline"
                                        className={`px-2.5 py-0.5 font-semibold tracking-wide ${merchant.status === 'active'
                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                            : 'text-gray-500 bg-gray-50'
                                            }`}
                                    >
                                        {(merchant.status || 'unknown').toUpperCase()}
                                    </Badge>
                                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-sm font-bold border border-amber-100">
                                        <Star className="w-3.5 h-3.5 fill-current" />
                                        {merchant.rating || '0'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-500 text-sm font-medium">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {merchant.city}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 pt-6">
                        <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="mb-8">
                                <TabsTrigger value="overview">
                                    <Store className="w-4 h-4" />
                                    Overview
                                </TabsTrigger>
                                <TabsTrigger value="orders">
                                    <ShoppingCart className="w-4 h-4" />
                                    Recent Orders ({orders.length})
                                </TabsTrigger>
                                <TabsTrigger value="inventory">
                                    <History className="w-4 h-4" />
                                    Product Inventory
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Owner Detail
                                        </div>
                                        <div className="space-y-3">
                                            <div className="text-base font-bold text-gray-900">{merchant.owner_name}</div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-emerald-600 transition-colors group cursor-pointer">
                                                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50">
                                                        <Phone className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500" />
                                                    </div>
                                                    {merchant.phone}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-emerald-600 transition-colors group cursor-pointer">
                                                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50">
                                                        <Mail className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500" />
                                                    </div>
                                                    {merchant.email}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            Store Address
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                            </div>
                                            <div className="text-sm text-gray-600 leading-relaxed pt-1.5">
                                                {merchant.address || 'No specific address provided'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Compliance Section */}
                                <div className="p-6 border border-gray-100 rounded-2xl bg-white shadow-sm space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">KYC</Badge>
                                            Compliance & Documents
                                        </h4>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Turnover: <span className="text-gray-900">{merchant.turnover_range || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PAN</div>
                                            <div className="text-sm font-bold text-gray-900">{merchant.pan_number || 'N/A'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aadhaar</div>
                                            <div className="text-sm font-bold text-gray-900">{merchant.aadhar_number || 'N/A'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">GSTIN</div>
                                            <div className="text-sm font-bold text-gray-900">{merchant.gst_number || 'N/A'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bank A/C</div>
                                            <div className="text-sm font-bold text-gray-900">{merchant.bank_account_number?.slice(-4).padStart(8, '*') || 'N/A'}</div>
                                        </div>
                                    </div>

                                    {/* Document Links */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {merchant.pan_doc_url && (
                                            <a href={merchant.pan_doc_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                                                PAN View
                                            </a>
                                        )}
                                        {merchant.aadhar_front_url && (
                                            <a href={merchant.aadhar_front_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                                                Aadhaar Front
                                            </a>
                                        )}
                                        {merchant.aadhar_back_url && (
                                            <a href={merchant.aadhar_back_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                                                Aadhaar Back
                                            </a>
                                        )}
                                        {merchant.gst_certificate_url && (
                                            <a href={merchant.gst_certificate_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">
                                                GST Cert
                                            </a>
                                        )}
                                    </div>

                                    {/* Store Photos */}
                                    {merchant.store_photos && merchant.store_photos.length > 0 && (
                                        <div className="pt-4 border-t border-gray-50">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Store Photos ({merchant.store_photos.length})</div>
                                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                                {merchant.store_photos.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="w-24 h-24 rounded-xl border border-gray-100 overflow-hidden flex-shrink-0 hover:border-blue-300 transition-colors">
                                                        <img src={url} alt="Store" className="w-full h-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Performance Card */}
                                <div className="p-6 border border-emerald-100 rounded-3xl bg-emerald-50/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/30 rounded-full -mr-16 -mt-16 blur-2xl transition-all group-hover:bg-emerald-200/40" />

                                    <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <History className="w-4 h-4 text-emerald-600" />
                                        Performance Overview (Last 30 Days)
                                    </h4>

                                    <div className="grid grid-cols-3 gap-8 text-center relative z-10">
                                        <div className="space-y-1">
                                            <div className="text-3xl font-black text-gray-900 tracking-tight">{stats?.orders_30d || 0}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orders</div>
                                        </div>
                                        <div className="space-y-1 border-x border-emerald-100/50">
                                            <div className="text-3xl font-black text-gray-900 tracking-tight">
                                                ₹{stats?.avg_order_value ? Math.round(stats.avg_order_value) : 0}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Ticket</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-3xl font-black text-emerald-600 tracking-tight">
                                                ₹{stats?.gmv_30d ? stats.gmv_30d.toLocaleString() : '0'}
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revenue</div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="orders" className="animate-in fade-in duration-300">
                                <div className="space-y-4 pr-1">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                            <div className="w-10 h-10 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
                                            <p className="text-sm font-medium">Fetching recent orders...</p>
                                        </div>
                                    ) : orders.length === 0 ? (
                                        <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                            <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                            <p className="text-gray-400 font-medium font-sm">No orders found for this period</p>
                                        </div>
                                    ) : orders.map(order => (
                                        <div key={order.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-emerald-200 hover:shadow-sm transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                    <ShoppingCart className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 text-sm">Order #{order.id.slice(0, 8)}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5 font-medium">
                                                        {order.customer_name || 'Customer'} • {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-gray-900">₹{order.amount}</div>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] px-2 py-0 border-none font-bold uppercase tracking-tight h-5 mt-1 ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                        order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    {order.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="inventory" className="animate-in fade-in duration-300 min-h-[500px]">
                                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                    <StoreProductTable storeId={merchant.id} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
