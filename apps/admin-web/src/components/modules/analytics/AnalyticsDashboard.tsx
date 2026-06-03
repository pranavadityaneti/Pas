/**
 * Analytics Dashboard — REAL data via Supabase RPC `get_super_admin_stats`.
 *
 * 2026-06-02: rewritten from a 100%-static visual mockup to live data.
 * Source-of-truth is the same RPC the main Dashboard uses, so the data is
 * consistent across both screens.
 *
 * Removed (per founder request):
 *   - Static User Retention bars [65, 59, 80, …] — replaced with real GMV trend
 *   - Static "Map Visualization Loaded" heatmap — replaced with order status pie
 *   - Hardcoded "Top Performing Merchants" (Ratnadeep / Vijetha / Organic World)
 *   - Hardcoded "Top Selling Products" (Fresh Milk / Bread / Tomato / Onion)
 *
 * Product-level analytics (top selling) wait for a separate session — needs an
 * `OrderItem.productId` join + GROUP BY in the RPC.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Download, TrendingUp, ShoppingBag, Loader2, Trophy } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface DailyStat {
  date: string;
  gmv: number;
  orders: number;
}
interface StatusBreakdownItem {
  status: string;
  count: number;
}
interface TopStore {
  storeName: string;
  totalGmv: number;
  totalOrders: number;
}
interface Stats {
  dailyStats: DailyStat[];
  statusBreakdown: StatusBreakdownItem[];
  topStores: TopStore[];
  totalGmv?: number;
  totalOrders?: number;
}

// Brand-red palette for the pie chart. Status semantics handled in code below.
const BRAND_RED = '#B52725';
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6',  // blue
  READY:     '#10B981',  // green (semantic — ready for pickup)
  COMPLETED: '#F59E0B',  // amber (semantic — completed; intentionally orange-ish)
  CANCELLED: '#EF4444',  // red (semantic — blocked/cancelled)
  REFUNDED:  '#8B5CF6',  // violet (rare, non-semantic; OK to leave)
  PENDING:   '#9CA3AF',  // gray (informational)
};

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data, error: e } = await supabase.rpc('get_super_admin_stats');
        if (cancelled) return;
        if (e) { setError(e.message); return; }
        setStats(data as Stats);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 m-6">
        Failed to load analytics: {error}
      </div>
    );
  }

  const dailyStats = stats?.dailyStats ?? [];
  const statusBreakdown = stats?.statusBreakdown ?? [];
  const topStores = stats?.topStores ?? [];

  return (
    <div className="h-full flex flex-col space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Business Intelligence</h2>
          <p className="text-sm text-gray-500">Live platform performance — pulled from the same source-of-truth as the main Dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" disabled>
            Last 30 Days
          </Button>
          <Button
            disabled
            className="bg-[#B52725] hover:bg-[#9a1f1d] text-white gap-2"
            title="CSV / deck export ships post-launch"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Top Row — Revenue trend (real) + Order status (real) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue trend chart — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Revenue Trend (last 30 days)</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            {dailyStats.length === 0 ? (
              <ChartEmpty message="No revenue data in the last 30 days yet" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor={BRAND_RED} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={BRAND_RED} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'GMV']}
                    />
                    <Area type="monotone" dataKey="gmv" stroke={BRAND_RED} strokeWidth={2} fill="url(#gmvFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status — 1/3 width */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Order Status</CardTitle>
            <ShoppingBag className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <ChartEmpty message="No orders yet" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusBreakdown.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#9CA3AF'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row — Top stores (real) + Top products (coming soon, honest) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="w-4 h-4 text-[#B52725]" />
            <CardTitle className="text-base">Top Performing Stores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topStores.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                No store revenue yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStores.slice(0, 8).map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-gray-900">{s.storeName ?? '—'}</TableCell>
                      <TableCell className="text-right text-gray-700">{(s.totalOrders ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-[#B52725]">₹{(s.totalGmv ?? 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products — empty state until product-level analytics ship */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-10 text-center">
            <p className="text-sm font-bold text-gray-700">Product-level analytics — coming soon</p>
            <p className="text-xs text-gray-500 mt-1">
              Needs an OrderItem → Product join. Planned post-launch.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}
