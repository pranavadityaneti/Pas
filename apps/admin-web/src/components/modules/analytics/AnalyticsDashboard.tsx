/**
 * Analytics Dashboard — REAL data via Supabase RPC.
 *
 * 2026-06-02: rewritten from a 100%-static mockup to live data
 *             (`get_super_admin_stats`, 30-day fixed window).
 * 2026-06-03: added date-range filters (Today / 7d / 30d / 90d / Custom),
 *             KPI strip with derived metrics (AOV, cancellation rate),
 *             Orders-per-day line chart, sortable Top Stores,
 *             CSV export of the current view.
 *
 *             Reads from a NEW RPC `get_super_admin_stats_in_range(from, to)`
 *             when available. If the SQL hasn't been applied yet, falls back
 *             gracefully to the original 30-day RPC and shows a small banner.
 *
 * Source-of-truth: the same `"Order"` table the main Dashboard uses.
 *
 * Still out of scope (deferred, surfaced honestly):
 *   - Product-level analytics (top SKUs, category breakdown) — needs OrderItem joins
 *   - City / geo breakdown — needs branch-join aggregation
 *   - Compare-vs-previous-period — needs delta computation in RPC
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { DateRangePicker } from '../../ui/date-range-picker';
import {
  Download, TrendingUp, ShoppingBag, Loader2, Trophy,
  Wallet, Receipt, AlertTriangle, Activity, ArrowUpDown, Info,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface DailyStat   { date: string; gmv: number; orders: number; }
interface StatusItem  { status: string; count: number; }
interface TopStore    { storeName: string; totalGmv: number; totalOrders: number; }
interface Stats {
  dailyStats:      DailyStat[];
  statusBreakdown: StatusItem[];
  topStores:       TopStore[];
  totalGmv?:       number;
  totalOrders?:    number;
  activeCustomers?:number;
  totalMerchants?: number;
}

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

// ────────────────────────────────────────────────────────────────────────────
// Palette — brand red + semantic status colors (no decorative gradients)
// ────────────────────────────────────────────────────────────────────────────

const BRAND_RED = '#B52725';
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6',  // blue — informational
  READY:     '#10B981',  // green — allowed/ready
  COMPLETED: '#F59E0B',  // amber — completed
  CANCELLED: '#EF4444',  // red — blocked
  REFUNDED:  '#8B5CF6',  // violet — rare
  PENDING:   '#9CA3AF',  // gray — informational
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function rangeFromPreset(preset: RangePreset, custom: DateRange | undefined): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const from = startOfDay(now);
      const to   = endOfDay(now);
      return { from, to, label: 'Today' };
    }
    case '7d': {
      const from = startOfDay(subDays(now, 6));
      const to   = endOfDay(now);
      return { from, to, label: 'Last 7 days' };
    }
    case '90d': {
      const from = startOfDay(subDays(now, 89));
      const to   = endOfDay(now);
      return { from, to, label: 'Last 90 days' };
    }
    case 'custom': {
      if (custom?.from && custom?.to) {
        return {
          from: startOfDay(custom.from),
          to:   endOfDay(custom.to),
          label: `${format(custom.from, 'MMM d')} – ${format(custom.to, 'MMM d')}`,
        };
      }
      // No range picked yet — degrade to 30d
      const from = startOfDay(subDays(now, 29));
      const to   = endOfDay(now);
      return { from, to, label: 'Last 30 days' };
    }
    case '30d':
    default: {
      const from = startOfDay(subDays(now, 29));
      const to   = endOfDay(now);
      return { from, to, label: 'Last 30 days' };
    }
  }
}

function fmtINR(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const body = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [preset,       setPreset]       = useState<RangePreset>('30d');
  const [customRange,  setCustomRange]  = useState<DateRange | undefined>(undefined);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);          // true → using old 30-day RPC
  const [topStoresN,   setTopStoresN]   = useState<5 | 10 | 25>(10);
  const [sortKey,      setSortKey]      = useState<'gmv' | 'orders'>('gmv');

  // Resolve the active range
  const range = useMemo(() => rangeFromPreset(preset, customRange), [preset, customRange]);

  // Fetch — try new RPC, fall back to old one
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Attempt 1: new RPC with date range
        const tryNew = await supabase.rpc('get_super_admin_stats_in_range', {
          from_date: range.from.toISOString(),
          to_date:   range.to.toISOString(),
        });

        if (!tryNew.error) {
          if (cancelled) return;
          setFallbackMode(false);
          setStats(tryNew.data as Stats);
          return;
        }

        // Attempt 2: fall back to old RPC (fixed 30-day window)
        const tryOld = await supabase.rpc('get_super_admin_stats');
        if (cancelled) return;
        if (tryOld.error) {
          setError(tryOld.error.message);
          return;
        }
        setFallbackMode(true);
        setStats(tryOld.data as Stats);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range.from.getTime(), range.to.getTime()]);

  // Derived KPIs (from whatever data we got)
  const daily       = stats?.dailyStats      ?? [];
  const statusBrk   = stats?.statusBreakdown ?? [];
  const topStores   = stats?.topStores       ?? [];

  const totalGmv    = stats?.totalGmv    ?? daily.reduce((s, d) => s + (d.gmv ?? 0), 0);
  const totalOrders = stats?.totalOrders ?? daily.reduce((s, d) => s + (d.orders ?? 0), 0);
  const aov         = totalOrders > 0 ? totalGmv / totalOrders : 0;
  const totalStatus = statusBrk.reduce((s, x) => s + (x.count ?? 0), 0);
  const cancelled   = statusBrk.find(x => x.status === 'CANCELLED')?.count ?? 0;
  const cancelRate  = totalStatus > 0 ? (cancelled / totalStatus) * 100 : 0;

  // Sorted top stores
  const sortedStores = useMemo(() => {
    const arr = [...topStores];
    arr.sort((a, b) => sortKey === 'gmv'
      ? (b.totalGmv ?? 0)    - (a.totalGmv ?? 0)
      : (b.totalOrders ?? 0) - (a.totalOrders ?? 0));
    return arr;
  }, [topStores, sortKey]);

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Analytics export — ${range.label}`]);
    rows.push([`Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')}`]);
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total GMV', totalGmv]);
    rows.push(['Total Orders', totalOrders]);
    rows.push(['Average Order Value', Math.round(aov)]);
    rows.push(['Cancellation Rate %', cancelRate.toFixed(2)]);
    rows.push([]);
    rows.push(['DAILY']);
    rows.push(['Date', 'GMV', 'Orders']);
    daily.forEach(d => rows.push([d.date, d.gmv, d.orders]));
    rows.push([]);
    rows.push(['ORDER STATUS']);
    rows.push(['Status', 'Count']);
    statusBrk.forEach(s => rows.push([s.status, s.count]));
    rows.push([]);
    rows.push(['TOP STORES']);
    rows.push(['Store', 'GMV', 'Orders']);
    sortedStores.forEach(s => rows.push([s.storeName ?? '', s.totalGmv, s.totalOrders]));

    const safeLabel = range.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadCSV(`pas-analytics-${safeLabel}-${format(new Date(), 'yyyyMMdd')}.csv`, rows);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  if (loading && !stats) {
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

  return (
    <div className="h-full flex flex-col space-y-6 overflow-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Business Intelligence</h2>
          <p className="text-sm text-gray-500">
            Live platform performance — {range.label.toLowerCase()}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset chips */}
          <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
            {([
              { k: 'today', label: 'Today' },
              { k: '7d',    label: '7d'    },
              { k: '30d',   label: '30d'   },
              { k: '90d',   label: '90d'   },
            ] as { k: RangePreset; label: string }[]).map((p) => (
              <button
                key={p.k}
                onClick={() => setPreset(p.k)}
                className={
                  'px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-200 ' +
                  (preset === p.k
                    ? 'bg-[#B52725] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50')
                }
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={
                'px-3 py-1.5 text-xs font-medium transition-colors ' +
                (preset === 'custom'
                  ? 'bg-[#B52725] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50')
              }
            >
              Custom
            </button>
          </div>

          {preset === 'custom' && (
            <DateRangePicker
              value={customRange}
              onChange={setCustomRange}
              className="min-w-[260px]"
            />
          )}

          <Button
            onClick={handleExportCsv}
            className="bg-[#B52725] hover:bg-[#9a1f1d] text-white gap-2"
            title="Download current view as CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ─── Fallback banner (only when the new RPC isn't applied yet) ─── */}
      {fallbackMode && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-xs">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            Date filter is using the legacy 30-day window — apply{' '}
            <code className="font-mono">get_super_admin_stats_in_range</code>{' '}
            (in <code className="font-mono">docs/migrations-pending-2026-06-03.sql</code>) to enable full date filtering.
          </div>
        </div>
      )}

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Total GMV"
          value={fmtINR(totalGmv)}
          icon={<Wallet className="w-4 h-4" />}
          accent
        />
        <KpiTile
          label="Total Orders"
          value={totalOrders.toLocaleString('en-IN')}
          icon={<Receipt className="w-4 h-4" />}
        />
        <KpiTile
          label="Avg Order Value"
          value={fmtINR(aov)}
          icon={<Activity className="w-4 h-4" />}
        />
        <KpiTile
          label="Cancellation Rate"
          value={`${cancelRate.toFixed(1)}%`}
          icon={<AlertTriangle className="w-4 h-4" />}
          tone={cancelRate > 10 ? 'warn' : undefined}
        />
      </div>

      {/* ─── Row 1 — Revenue trend (real) + Order status (real) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Revenue Trend</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            {daily.length === 0 ? (
              <ChartEmpty message={`No revenue data in ${range.label.toLowerCase()} yet`} />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                      formatter={(value: number) => [fmtINR(value), 'GMV']}
                    />
                    <Area type="monotone" dataKey="gmv" stroke={BRAND_RED} strokeWidth={2} fill="url(#gmvFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Order Status</CardTitle>
            <ShoppingBag className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            {statusBrk.length === 0 ? (
              <ChartEmpty message="No orders yet" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBrk}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusBrk.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#9CA3AF'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                      formatter={(value: number, name: string) => [
                        `${value} (${pct(value, totalStatus)})`,
                        name,
                      ]}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Row 2 — Orders-per-day line chart ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium">Order Volume</CardTitle>
          <Activity className="w-4 h-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <ChartEmpty message="No order volume yet" />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(value: number) => [value, 'Orders']}
                  />
                  <Line type="monotone" dataKey="orders" stroke={BRAND_RED} strokeWidth={2} dot={{ r: 3, fill: BRAND_RED }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Row 3 — Top stores (sortable, sized) + Top products (honest stub) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#B52725]" />
              <CardTitle className="text-base">Top Performing Stores</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortKey(sortKey === 'gmv' ? 'orders' : 'gmv')}
                className="h-7 gap-1 text-xs"
                title={`Sorted by ${sortKey === 'gmv' ? 'GMV' : 'orders'} — click to switch`}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortKey === 'gmv' ? 'GMV' : 'Orders'}
              </Button>
              <Select value={String(topStoresN)} onValueChange={(v) => setTopStoresN(Number(v) as 5 | 10 | 25)}>
                <SelectTrigger className="h-7 w-[80px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Top 5</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="25">Top 25</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedStores.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                No store revenue in {range.label.toLowerCase()}
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
                  {sortedStores.slice(0, topStoresN).map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-gray-900">{s.storeName ?? '—'}</TableCell>
                      <TableCell className="text-right text-gray-700">{(s.totalOrders ?? 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-bold text-[#B52725]">{fmtINR(s.totalGmv)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, icon, accent, tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: 'warn';
}) {
  const valueClass =
    accent      ? 'text-[#B52725]' :
    tone === 'warn' ? 'text-amber-600' :
    'text-gray-900';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          <span className="text-gray-400">{icon}</span>
        </div>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}
