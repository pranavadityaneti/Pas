import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Badge } from "../../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Store, MapPin, Phone, Mail, Package, History, ShoppingCart, Star } from "lucide-react";
import { Merchant, useMerchants } from "../../../hooks/useMerchants";
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
            <SheetContent className="w-[600px] sm:w-[640px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                            <Store className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl">{merchant.store_name}</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={merchant.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500'}>
                                    {merchant.status.toUpperCase()}
                                </Badge>
                                <div className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    {merchant.rating}
                                </div>
                                <span className="text-gray-400">•</span>
                                <span className="text-sm font-medium">{merchant.city}</span>
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start border-b border-gray-100 bg-transparent p-0 mb-6 rounded-none space-x-6 h-auto">
                        <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 px-0 pb-2">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 px-0 pb-2">
                            Live Orders ({orders.length})
                        </TabsTrigger>
                        <TabsTrigger value="inventory" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 px-0 pb-2">
                            Top Categories
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Owner Detail</div>
                                <div className="font-medium text-gray-900 mb-2">{merchant.owner_name}</div>
                                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                                    <Phone className="w-3.5 h-3.5 text-gray-400" /> {merchant.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Mail className="w-3.5 h-3.5 text-gray-400" /> {merchant.email}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Address</div>
                                <div className="flex items-start gap-2 text-sm text-gray-700 p-1">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                                    {merchant.address || 'Address not provided'}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border border-gray-100 rounded-lg bg-orange-50/30">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <History className="w-4 h-4 text-orange-600" />
                                Store Performance (30 Days)
                            </h4>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats?.orders_30d || 0}</div>
                                    <div className="text-xs text-gray-500 mt-1">Orders</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{stats?.avg_order_value ? Math.round(stats.avg_order_value) : 0}</div>
                                    <div className="text-xs text-gray-500 mt-1">Avg Ticket</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-emerald-600">
                                        ₹{stats?.gmv_30d ? stats.gmv_30d.toLocaleString() : 0}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Revenue</div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="orders">
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="text-center py-8 text-gray-500">Loading orders...</div>
                            ) : orders.map(order => (
                                <div key={order.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <ShoppingCart className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-gray-900">Order #{order.id.slice(0, 8)}</div>
                                            <div className="text-xs text-gray-500">{order.customer_name} • {new Date(order.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-sm">₹{order.amount}</div>
                                        <Badge variant="secondary" className="text-[10px] h-5">{order.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="inventory">
                        <div className="grid gap-4">
                            {stats?.top_categories?.length > 0 ? (
                                stats.top_categories.map((cat: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {i + 1}
                                            </div>
                                            <div className="font-medium">{cat.name}</div>
                                        </div>
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">{cat.count} Sales</Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    No category data available yet.
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
