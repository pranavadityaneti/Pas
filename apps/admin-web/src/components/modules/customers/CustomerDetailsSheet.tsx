import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { ShoppingBag, Package, MapPin, Phone, Mail, Clock, Calendar } from "lucide-react";
import { Customer } from "../../../hooks/useCustomers";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface CustomerDetailsSheetProps {
    customer: Customer | null;
    isOpen: boolean;
    onClose: () => void;
}

export function CustomerDetailsSheet({ customer, isOpen, onClose }: CustomerDetailsSheetProps) {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (customer && isOpen) {
            const fetchHistory = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', customer.id)
                    .order('created_at', { ascending: false });
                setOrders(data || []);
                setLoading(false);
            };
            fetchHistory();
        }
    }, [customer, isOpen]);

    if (!customer) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
                            {customer.name.charAt(0)}
                        </div>
                        <div>
                            <SheetTitle className="text-xl">{customer.name}</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={customer.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500'}>
                                    {customer.status.toUpperCase()}
                                </Badge>
                                <span className="text-gray-400">•</span>
                                <span className="text-sm font-medium">
                                    LTV: ₹{orders.reduce((sum, o) => sum + Number(o.amount), 0).toLocaleString()}
                                </span>
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start border-b border-gray-100 bg-transparent p-0 mb-6 rounded-none space-x-6 h-auto">
                        <TabsTrigger
                            value="overview"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-fuchsia-600 data-[state=active]:text-fuchsia-600 px-0 pb-2"
                        >
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="orders"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-fuchsia-600 data-[state=active]:text-fuchsia-600 px-0 pb-2"
                        >
                            Order History ({orders.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Contact Info</div>
                                <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                                    <Phone className="w-4 h-4 text-gray-400" /> {customer.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Mail className="w-4 h-4 text-gray-400" /> {customer.id}@example.com
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Location</div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <MapPin className="w-4 h-4 text-gray-400" /> {customer.city}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border border-gray-100 rounded-lg">
                            <h4 className="text-sm font-semibold mb-3">Shopping Insights</h4>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{orders.length}</div>
                                    <div className="text-xs text-gray-500 mt-1">Total Orders</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-emerald-600">
                                        ₹{orders.length > 0 ? Math.round(orders.reduce((sum, o) => sum + Number(o.amount), 0) / orders.length) : 0}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Avg. Order Value</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{new Date().getFullYear() - new Date(customer.created_at).getFullYear() + 1}</div>
                                    <div className="text-xs text-gray-500 mt-1">Years Active</div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="orders">
                        <div className="space-y-3">
                            {loading ? (
                                <div className="text-center py-8 text-gray-500">Loading orders...</div>
                            ) : orders.map(order => (
                                <div key={order.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-gray-900">{order.store_name}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <Calendar className="w-3 h-3" /> {new Date(order.created_at).toLocaleDateString()}
                                                <span>•</span>
                                                Order #{order.id.slice(0, 8)}
                                            </div>
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
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
