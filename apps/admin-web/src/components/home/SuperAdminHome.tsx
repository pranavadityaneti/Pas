/**
 * SuperAdminHome — platform overview for SUPER_ADMIN-tier users.
 *
 * Composition:
 *   - Greeting + date-range chips (Today / 7d / 30d)
 *   - 4 primary KPIs        : GMV, Orders, Active Consumers, Total Merchants
 *   - 4 secondary KPIs      : AOV, Cancellation %, New Customers (range), Active Stores
 *   - Revenue trend (area)  : real data, brand-red gradient
 *   - Order status (pie)    : semantic colors
 *   - Top performing stores : top 10 from RPC
 *   - Recent activity feed  : last 10 orders + last 5 new merchants, merged
 *   - Quick actions         : jump to Merchants, Orders, KYC, Reports
 *
 * Data sources:
 *   - get_super_admin_stats (existing RPC, 30-day window)
 *   - Direct Supabase reads for recent orders + recent merchants (small, indexed)
 *
 * NOT included (deferred — surfaced honestly in code, not in UI):
 *   - Compare-vs-previous-period delta (needs RPC extension)
 *   - Pending refunds count (no dedicated refunds table yet)
 *   - Per-tile sparkline (would require per-tile time-series — RPC doesn't return that)
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet, ShoppingBag, Users, Store as StoreIcon, Activity, AlertTriangle,
  TrendingUp, Trophy, Loader2, Building2, FileBarChart2, ClipboardCheck, MessageSquare,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { HomeHeader, KpiTile, QuickActions, SectionCard, EmptyState, fmtINR } from './_shared';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const BRAND_RED = '#B52725';
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6', READY: '#10B981', COMPLETED: '#F59E0B',
  CANCELLED: '#EF4444', REFUNDED: '#8B5CF6', PENDING: '#9CA3AF',
};

interface DailyStat   { date: string; gmv: number; orders: number; }
interface StatusItem  { status: string; count: number; }
interface TopStore    { storeName: string; totalGmv: number; totalOrders: number; }
interface Stats {
  dailyStats:      DailyStat[];
  statusBreakdown: StatusItem[];
  topStores:       TopStore[];
  totalGmv:        number;
  totalOrders:     number;
  activeCustomers: number;
  totalMerchants:  number;
}
interface RecentOrder    { id: string; order_number: string; customer_name: string | null; total_amount: number; status: string; created_at: string; }
interface RecentMerchant { id: string; store_name: string | null; status: string | null; created_at: string; }
interface ActivityItem   { kind: 'order' | 'merchant'; ts: string; title: string; meta: string; }

type Preset = '24h' | '7d' | '30d';

export function SuperAdminHome() {
  const { user } = useAuth();
  const [preset,     setPreset]     = useState<Preset>('30d');
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [activity,   setActivity]   = useState<ActivityItem[]>([]);
  const [newCust,    setNewCust]    = useState<number | null>(null);
  const [activeStr,  setActiveStr]  = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Main stats — single RPC, same as the legacy Dashboard
      const { data, error } = await supabase.rpc('get_super_admin_stats');
      if (!cancelled && !error) setStats(data as Stats);

      // Range-specific extras — light direct reads, in parallel
      const since = new Date();
      if (preset === '24h')  since.setDate(since.getDate() - 1);
      if (preset === '7d')   since.setDate(since.getDate() - 7);
      if (preset === '30d')  since.setDate(since.getDate() - 30);

      const [{ count: nc }, { count: as }, recentOrders, recentMerchants] = await Promise.all([
        supabase.from('User').select('id', { count: 'exact', head: true })
          .eq('role', 'CONSUMER').gte('createdAt', since.toISOString()),
        supabase.from('merchant_branches').select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('orders')
          .select('id, order_number, customer_name, total_amount, status, created_at')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('merchants')
          .select('id, store_name, status, created_at')
          .order('created_at', { ascending: false }).limit(5),
      ]);

      if (cancelled) return;
      setNewCust(nc ?? null);
      setActiveStr(as ?? null);

      // Merge into a single time-ordered activity feed
      const events: ActivityItem[] = [];
      (recentOrders.data ?? []).forEach((o: RecentOrder) => events.push({
        kind: 'order', ts: o.created_at,
        title: `Order ${o.order_number ?? o.id.slice(0,8)} — ${o.status}`,
        meta:  `${o.customer_name ?? 'Unknown'} · ${fmtINR(o.total_amount)}`,
      }));
      (recentMerchants.data ?? []).forEach((m: RecentMerchant) => events.push({
        kind: 'merchant', ts: m.created_at,
        title: `New merchant: ${m.store_name ?? '(unnamed)'}`,
        meta:  `Status: ${m.status ?? 'pending'}`,
      }));
      events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setActivity(events.slice(0, 12));

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [preset]);

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Loading platform overview…</p>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Failed to load platform data.
      </div>
    );
  }

  // Derived metrics
  const totalStatus = (stats.statusBreakdown ?? []).reduce((s, x) => s + (x.count ?? 0), 0);
  const cancelled   = (stats.statusBreakdown ?? []).find(x => x.status === 'CANCELLED')?.count ?? 0;
  const cancelRate  = totalStatus > 0 ? (cancelled / totalStatus) * 100 : 0;
  const aov         = (stats.totalOrders ?? 0) > 0 ? (stats.totalGmv ?? 0) / (stats.totalOrders ?? 1) : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <HomeHeader
        name={user?.name}
        role={user?.role}
        subtitle="Platform overview — live numbers across every store and consumer."
        right={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <PresetChips value={preset} onChange={setPreset} />
            <QuickActions actions={[
              { to: '/merchants',        label: 'Merchants',    icon: StoreIcon       },
              { to: '/orders',           label: 'Orders',       icon: ShoppingBag     },
              { to: '/reports',          label: 'Reports',      icon: FileBarChart2   },
              { to: '/customer-support', label: 'Inbox',        icon: MessageSquare   },
            ]} />
          </div>
        }
      />

      {/* ─── Primary KPI strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Total GMV"        value={fmtINR(stats.totalGmv)}                   icon={Wallet}     accent />
        <KpiTile label="Total Orders"     value={(stats.totalOrders ?? 0).toLocaleString('en-IN')} icon={ShoppingBag} />
        <KpiTile label="Active Consumers" value={(stats.activeCustomers ?? 0).toLocaleString('en-IN')} icon={Users} />
        <KpiTile label="Total Merchants"  value={(stats.totalMerchants ?? 0).toLocaleString('en-IN')} icon={StoreIcon} />
      </div>

      {/* ─── Secondary KPI strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Avg Order Value"           value={fmtINR(aov)}                                  icon={Activity} />
        <KpiTile label="Cancellation Rate"         value={`${cancelRate.toFixed(1)}%`}                  icon={AlertTriangle} tone={cancelRate > 10 ? 'warn' : undefined} />
        <KpiTile label={`New Customers · ${preset}`}  value={newCust == null ? '—' : newCust.toLocaleString('en-IN')} icon={Users} tone="good" />
        <KpiTile label="Active Stores"             value={activeStr == null ? '—' : activeStr.toLocaleString('en-IN')} icon={Building2} />
      </div>

      {/* ─── Charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Revenue Trend (30d)" icon={TrendingUp} className="lg:col-span-2">
          {(stats.dailyStats ?? []).length === 0 ? (
            <EmptyState title="No revenue data yet" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="superGmvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={BRAND_RED} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={BRAND_RED} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(v: number) => [fmtINR(v), 'GMV']}
                  />
                  <Area type="monotone" dataKey="gmv" stroke={BRAND_RED} strokeWidth={2} fill="url(#superGmvFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Order Status" icon={ShoppingBag}>
          {(stats.statusBreakdown ?? []).length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.statusBreakdown} dataKey="count" nameKey="status"
                       cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {stats.statusBreakdown.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ─── Top stores + Activity feed ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Performing Stores" icon={Trophy}>
          {(stats.topStores ?? []).length === 0 ? (
            <EmptyState title="No store revenue yet" />
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.topStores.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{s.storeName ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                    <span>{(s.totalOrders ?? 0).toLocaleString('en-IN')} orders</span>
                    <span className="font-bold text-[#B52725]">{fmtINR(s.totalGmv)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Activity" icon={Activity}>
          {activity.length === 0 ? (
            <EmptyState title="Nothing happening yet" hint="Activity will appear here as orders come in and merchants sign up." />
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 truncate">{a.meta}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(a.ts), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick Actions moved to the header (2026-06-03) so they sit next to the date chips,
          matching the "actions beside filter" pattern Pranav requested. */}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Range preset chips

function PresetChips({ value, onChange }: { value: Preset; onChange: (v: Preset) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
      {([
        { k: '24h' as Preset, label: '24h' },
        { k: '7d'  as Preset, label: '7d'  },
        { k: '30d' as Preset, label: '30d' },
      ]).map((p) => (
        <button
          key={p.k}
          onClick={() => onChange(p.k)}
          className={
            'px-3 py-1.5 text-xs font-medium border-r last:border-r-0 border-gray-200 transition-colors ' +
            (value === p.k
              ? 'bg-[#B52725] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50')
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Suppress unused-Link warning — used inside QuickActions transitively
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _link = Link;
