import { useState, useEffect, useMemo } from 'react';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Package,
    IndianRupee,
    Star,
    CheckCircle,
    Clock,
    Calendar,
    AlertTriangle,
    ShoppingBag
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '../../ui/tabs';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Merchant } from '../../../hooks/useMerchants';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface MerchantReportDialogProps {
    merchant: Merchant | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// --- Mock Data Generator (Robust & Deterministic) ---
const generateMockStats = (merchantId: string) => {
    // Determine random seed based on ID length (simple hash)
    const seed = merchantId.length;
    const rand = (n: number) => (seed * n * 37) % 100;

    // 1. Order History Generator
    const orderHistory = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const orders = 12 + (rand(i) % 20); // 12-32 orders
        const cancelled = Math.floor(orders * 0.1) + (rand(i) % 2); // 10-20% cancel rate
        return {
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            orders: orders,
            cancelled: cancelled,
            fulfilled: orders - cancelled,
            gmv: (orders - cancelled) * (350 + (rand(i) % 100))
        };
    });

    // 2. Heatmap Data (Hourly)
    const heatMap = [
        { time: '10am', orders: 2 + (rand(1) % 5) },
        { time: '1pm', orders: 15 + (rand(2) % 10) }, // Lunch peak
        { time: '4pm', orders: 5 + (rand(3) % 5) },
        { time: '7pm', orders: 12 + (rand(4) % 8) },  // Dinner peak
        { time: '10pm', orders: 3 + (rand(5) % 4) },
    ];

    // 3. Top Products
    const topProducts = [
        { name: 'Organic Milk 1L', sales: 45 + rand(1), revenue: 3200 },
        { name: 'Wheat Bread', sales: 38 + rand(2), revenue: 1500 },
        { name: 'Farm Eggs (6pcs)', sales: 32 + rand(3), revenue: 2100 },
        { name: 'Butter 200g', sales: 25 + rand(4), revenue: 2800 },
    ];

    return {
        orderHistory,
        heatMap,
        topProducts,
        summary: {
            fulfillmentRate: 98 - (rand(1) % 15), // 83-98%
            avgPrepTime: 15 + (rand(2) % 30), // 15-45 mins
            customerRating: 4.8 - (rand(3) % 15) / 10, // 3.3 - 4.8
            payoutPending: 12500 + (rand(4) * 100)
        }
    };
};

function formatCurrency(value: number): string {
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
}

export function MerchantReportDialog({ merchant, open, onOpenChange }: MerchantReportDialogProps) {
    // Memoize stats to prevent infinite re-renders or "hanging"
    const stats = useMemo(() => {
        if (!merchant) return null;
        return generateMockStats(merchant.id);
    }, [merchant?.id]);

    if (!merchant || !stats) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b bg-gray-50/50">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                {merchant.store_name}
                                <Badge variant="outline" className="ml-2 font-normal text-xs uppercase tracking-wider bg-white">
                                    {merchant.city}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Performance Report • Last 7 Days
                            </DialogDescription>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-500">Live Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${merchant.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className={`text-sm font-semibold ${merchant.is_online ? 'text-green-700' : 'text-red-700'}`}>
                                    {merchant.is_online ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs for Reports */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b bg-background">
                        <TabsList className="flex w-full justify-start rounded-none p-0 bg-transparent h-auto gap-2">
                            <TabsTrigger
                                value="overview"
                                className="gap-2 rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-gray-900 transition-colors"
                            >
                                <BarChart3 className="w-4 h-4" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="operations"
                                className="gap-2 rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-gray-900 transition-colors"
                            >
                                <Clock className="w-4 h-4" />
                                Operational Health
                            </TabsTrigger>
                            <TabsTrigger
                                value="products"
                                className="gap-2 rounded-md border border-transparent px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-gray-900 transition-colors"
                            >
                                <ShoppingBag className="w-4 h-4" />
                                Products
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6 space-y-6">

                        {/* TAB: OVERVIEW */}
                        <TabsContent value="overview" className="space-y-6 m-0">
                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="p-4 bg-white rounded-lg border shadow-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Total Revenue</p>
                                        <IndianRupee className="w-4 h-4 text-green-600" />
                                    </div>
                                    <p className="text-2xl font-bold">{formatCurrency(stats.orderHistory.reduce((a, b) => a + b.gmv, 0))}</p>
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +12% vs last week
                                    </p>
                                </div>
                                <div className="p-4 bg-white rounded-lg border shadow-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Total Orders</p>
                                        <Package className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <p className="text-2xl font-bold">{stats.orderHistory.reduce((a, b) => a + b.orders, 0)}</p>
                                    <p className="text-xs text-gray-500">Last 7 days</p>
                                </div>
                                <div className="p-4 bg-white rounded-lg border shadow-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Customer Rating</p>
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    </div>
                                    <p className="text-2xl font-bold">{stats.summary.customerRating.toFixed(1)}</p>
                                    <p className="text-xs text-gray-500">Based on 45 reviews</p>
                                </div>
                                <div className="p-4 bg-white rounded-lg border shadow-sm space-y-2">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Pending Payout</p>
                                        <Clock className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <p className="text-2xl font-bold">{formatCurrency(stats.summary.payoutPending)}</p>
                                    <p className="text-xs text-gray-500">Next payout: Tue</p>
                                </div>
                            </div>

                            {/* Main Chart */}
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Revenue & Order Volume</h3>
                                        <p className="text-sm text-gray-500">Daily performance for the past week</p>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.orderHistory}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                                            <YAxis yAxisId="left" axisLine={false} tickLine={false} fontSize={12} orientation="left" stroke="#888" tickFormatter={(v) => `₹${v}`} />
                                            <YAxis yAxisId="right" axisLine={false} tickLine={false} fontSize={12} orientation="right" stroke="#888" />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                formatter={(value: any, name: string) => [
                                                    name === 'gmv' ? formatCurrency(value) : value,
                                                    name === 'gmv' ? 'Revenue' : 'Orders'
                                                ]}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar yAxisId="left" dataKey="gmv" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: OPERATIONS */}
                        <TabsContent value="operations" className="space-y-6 m-0">
                            <div className="grid grid-cols-2 gap-6">
                                {/* Fulfillment Gauge */}
                                <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide w-full text-left">Fulfillment Reliability</h3>
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" strokeWidth="3" />
                                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={stats.summary.fulfillmentRate > 90 ? "#22c55e" : "#eab308"} strokeWidth="3" strokeDasharray={`${stats.summary.fulfillmentRate}, 100`} />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-3xl font-bold text-gray-900">{stats.summary.fulfillmentRate}%</span>
                                            <span className="text-xs text-gray-500">Success Rate</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 max-w-xs">
                                        Percentage of orders successfully fulfilled without cancellation or issues.
                                    </p>
                                </div>

                                {/* Prep Time Card */}
                                <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
                                    <div className="flex justify-between">
                                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Avg Prep Time</h3>
                                        <Clock className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div>
                                        <span className="text-4xl font-bold text-gray-900">{stats.summary.avgPrepTime}</span>
                                        <span className="text-xl text-gray-500 ml-1">mins</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Fast (&lt;15m)</span>
                                                <span>20%</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 w-[20%]"></div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Normal (15-30m)</span>
                                                <span>65%</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 w-[65%]"></div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Slow (&gt;30m)</span>
                                                <span>15%</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 w-[15%]"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cancellation & Peak Hours Row */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-2 bg-white p-6 rounded-lg border shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Peak Activity Hours</h3>
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={stats.heatMap}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                                <XAxis dataKey="time" axisLine={false} tickLine={false} fontSize={12} stroke="#888" />
                                                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                                <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-lg border shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Return/Cancel Rate</h3>
                                    <div className="space-y-4 text-center py-6">
                                        <AlertTriangle className="w-12 h-12 text-red-100 fill-red-500 mx-auto" />
                                        <div>
                                            <p className="text-3xl font-bold text-gray-900">2.1%</p>
                                            <p className="text-xs text-gray-500">of orders cancelled</p>
                                        </div>
                                        <Separator />
                                        <div className="text-left text-xs text-gray-500 space-y-1">
                                            <p>• 60% Customer Changed Mind</p>
                                            <p>• 30% Item Out of Stock</p>
                                            <p>• 10% Delivery Issues</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: PRODUCTS */}
                        <TabsContent value="products" className="space-y-6 m-0">
                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                <div className="p-6 border-b">
                                    <h3 className="text-lg font-semibold text-gray-900">Top Performing Products</h3>
                                    <p className="text-sm text-gray-500">Best selling items by volume and revenue</p>
                                </div>
                                <div className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Product Name</th>
                                                <th className="px-6 py-3 text-right">Units Sold</th>
                                                <th className="px-6 py-3 text-right">Revenue</th>
                                                <th className="px-6 py-3 text-right">Trend</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {stats.topProducts.map((product, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                                    <td className="px-6 py-4 text-right text-gray-600">{product.sales}</td>
                                                    <td className="px-6 py-4 text-right text-gray-900 font-medium">{formatCurrency(product.revenue)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                                            High Demand
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
