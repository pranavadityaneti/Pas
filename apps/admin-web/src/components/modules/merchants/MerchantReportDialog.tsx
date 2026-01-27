import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Package, IndianRupee, Star, CheckCircle, Clock } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { useMerchants, Merchant, MerchantStats } from '../../../hooks/useMerchants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MerchantReportDialogProps {
    merchant: Merchant;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function formatCurrency(value: number): string {
    if (value >= 100000) {
        return `₹${(value / 100000).toFixed(2)}L`;
    } else if (value >= 1000) {
        return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value}`;
}

function KPICard({ title, value, subtitle, icon: Icon, trend, trendUp }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    trend?: string;
    trendUp?: boolean;
}) {
    return (
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
                <Icon className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-gray-900">{value}</span>
                {trend && (
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                        {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend}
                    </span>
                )}
            </div>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
    );
}

export function MerchantReportDialog({ merchant, open, onOpenChange }: MerchantReportDialogProps) {
    const { getMerchantStats } = useMerchants();
    const [stats, setStats] = useState<MerchantStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && merchant?.id) {
            setLoading(true);
            getMerchantStats(merchant.id)
                .then(setStats)
                .finally(() => setLoading(false));
        }
    }, [open, merchant?.id, getMerchantStats]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        Performance Report
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        {merchant?.store_name}
                        <Badge variant="secondary" className="ml-2">{merchant?.city}</Badge>
                    </DialogDescription>
                </DialogHeader>

                {loading || !stats ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="animate-pulse text-gray-400">Loading stats...</div>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KPICard
                                title="Orders (30d)"
                                value={stats.orders_30d}
                                subtitle={`${stats.orders_7d} this week`}
                                icon={Package}
                                trend="+12%"
                                trendUp={true}
                            />
                            <KPICard
                                title="Revenue (30d)"
                                value={formatCurrency(stats.gmv_30d)}
                                subtitle={`${formatCurrency(stats.gmv_7d)} this week`}
                                icon={IndianRupee}
                                trend="+8%"
                                trendUp={true}
                            />
                            <KPICard
                                title="Avg Order Value"
                                value={formatCurrency(stats.avg_order_value)}
                                icon={TrendingUp}
                            />
                            <KPICard
                                title="Rating"
                                value={stats.current_rating.toFixed(1)}
                                subtitle={`30d avg: ${stats.rating_30d_avg.toFixed(1)}`}
                                icon={Star}
                            />
                        </div>

                        {/* Fulfillment & Payout */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center gap-3">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{stats.fulfillment_rate}% Fulfillment</p>
                                    <p className="text-xs text-gray-500">Order completion rate</p>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex items-center gap-3">
                                <Clock className="w-8 h-8 text-amber-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{formatCurrency(stats.pending_payout)} Pending</p>
                                    <p className="text-xs text-gray-500">Payout to merchant</p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 30-Day Trend Chart */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">30-Day Orders Trend</h4>
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.daily_orders}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v) => new Date(v).getDate().toString()}
                                            tick={{ fontSize: 10 }}
                                            stroke="#888"
                                        />
                                        <YAxis tick={{ fontSize: 10 }} stroke="#888" />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12 }}
                                            formatter={(value: number, name: string) => [
                                                name === 'orders' ? value : formatCurrency(value),
                                                name === 'orders' ? 'Orders' : 'GMV'
                                            ]}
                                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="orders"
                                            stroke="#6366f1"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <Separator />

                        {/* Top Categories */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">Top Categories</h4>
                            <div className="flex flex-wrap gap-2">
                                {stats.top_categories.map((cat, i) => (
                                    <Badge key={i} variant="secondary" className="gap-1.5 px-3 py-1">
                                        {cat.name}
                                        <span className="text-xs text-gray-500">({cat.count})</span>
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Lifetime Stats */}
                        <div className="bg-gray-100 rounded-lg p-4 mt-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lifetime Stats</h4>
                            <div className="flex gap-6 text-sm">
                                <div>
                                    <span className="text-gray-500">Total Orders:</span>{' '}
                                    <span className="font-semibold">{stats.total_orders.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Total GMV:</span>{' '}
                                    <span className="font-semibold">{formatCurrency(stats.total_gmv)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
