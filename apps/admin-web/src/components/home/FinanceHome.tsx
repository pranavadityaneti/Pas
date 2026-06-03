/**
 * FinanceHome — for FINANCE role.
 *
 * Their day is about money: how much came in, how much we owe merchants,
 * how much we collected vs lost. So the page leads with REVENUE numbers
 * and the settlement queue, not operational queues.
 *
 * Composition:
 *   - Greeting + range chips (7d / 30d / 90d — finance thinks in longer windows)
 *   - 4 KPIs : GMV · AOV · Cancellation Rate (= refund pressure) · Active Merchants
 *   - Revenue trend (area)
 *   - Top stores by revenue (with revenue share %)
 *   - Settlements & refunds card (honest "placeholder — wiring next" until those tables exist)
 *   - Quick actions to Settlements, Invoices, Reports
 *
 * Honest about gaps (Pranav has been clear about not faking data):
 *   - Settlements / payouts table is a placeholder — we ship a card that says so.
 *   - Refunds table not yet wired — we surface refund-status orders as a proxy.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet, Activity, AlertTriangle, Store as StoreIcon,
  TrendingUp, Trophy, Loader2, Receipt, FileBarChart2, Building2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { HomeHeader, KpiTile, QuickActions, SectionCard, EmptyState, fmtINR } from './_shared';

const BRAND_RED = '#B52725';

interface DailyStat   { date: string; gmv: number; orders: number; }
interface StatusItem  { status: string; count: number; }
interface TopStore    { storeName: string; totalGmv: number; totalOrders: number; }
interface Stats {
  dailyStats:      DailyStat[];
  statusBreakdown: StatusItem[];
  topStores:       TopStore[];
  totalGmv:        number;
  totalOrders:     number;
  totalMerchants:  number;
}

type Preset = '7d' | '30d' | '90d';

export function FinanceHome() {
  const { user } = useAuth();
  const [preset,    setPreset]    = useState<Preset>('30d');
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [refundLike,setRefundLike]= useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Try the range RPC first; fall back to fixed-30d if not yet applied
      const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const until = new Date();
      until.setDate(until.getDate() + 1);

      const tryRange = await supabase.rpc('get_super_admin_stats_in_range', {
        from_date: since.toISOString(),
        to_date:   until.toISOString(),
      });

      let data: Stats | null = null;
      if (!tryRange.error) {
        data = tryRange.data as Stats;
        if (!cancelled) setUsingFallback(false);
      } else {
        const old = await supabase.rpc('get_super_admin_stats');
        if (!old.error) data = old.data as Stats;
        if (!cancelled) setUsingFallback(true);
      }

      // 2026-06-04: routed refund-pressure count through API (was RLS-blocked direct read).
      let refundLikeCount: number | null = null;
      try {
        const r = await api.get<{ refundLike: number }>('/admin/home/finance');
        refundLikeCount = r.data.refundLike;
      } catch (err) {
        console.error('FinanceHome refund-pressure count failed:', err);
      }

      if (cancelled) return;
      setStats(data);
      setRefundLike(refundLikeCount);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [preset]);

  if (loading && !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Loading finance overview…</p>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Failed to load finance data.
      </div>
    );
  }

  // Derived
  const totalStatus = (stats.statusBreakdown ?? []).reduce((s, x) => s + (x.count ?? 0), 0);
  const cancelled   = (stats.statusBreakdown ?? []).find(x => x.status === 'CANCELLED')?.count ?? 0;
  const cancelRate  = totalStatus > 0 ? (cancelled / totalStatus) * 100 : 0;
  const aov         = (stats.totalOrders ?? 0) > 0 ? (stats.totalGmv ?? 0) / (stats.totalOrders ?? 1) : 0;
  const topStoreSum = (stats.topStores ?? []).reduce((s, x) => s + (x.totalGmv ?? 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <HomeHeader
        name={user?.name}
        role={user?.role}
        subtitle="Money in, money out — revenue, refund pressure, and merchant payouts."
        right={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <PresetChips value={preset} onChange={setPreset} />
            <QuickActions actions={[
              { to: '/finance',   label: 'Settlements', icon: Wallet        },
              { to: '/reports',   label: 'Reports',     icon: FileBarChart2 },
              { to: '/merchants', label: 'Merchants',   icon: Building2     },
            ]} />
          </div>
        }
      />

      {usingFallback && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-xs">
          Showing the legacy 30-day window — apply <code className="font-mono">get_super_admin_stats_in_range</code> for true range filtering.
        </div>
      )}

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label={`GMV · ${preset}`}        value={fmtINR(stats.totalGmv)}                       icon={Wallet}        accent />
        <KpiTile label="Avg Order Value"           value={fmtINR(aov)}                                  icon={Activity} />
        <KpiTile label="Refund Pressure"           value={refundLike == null ? '—' : refundLike.toLocaleString('en-IN')} icon={AlertTriangle} tone={refundLike && refundLike > 0 ? 'warn' : 'good'} subtext="Cancelled + refunded orders" />
        <KpiTile label="Cancellation Rate"         value={`${cancelRate.toFixed(1)}%`}                  icon={AlertTriangle} tone={cancelRate > 10 ? 'warn' : undefined} />
      </div>

      {/* ─── Revenue trend ─── */}
      <SectionCard title="Revenue Trend" icon={TrendingUp}>
        {(stats.dailyStats ?? []).length === 0 ? (
          <EmptyState title={`No revenue data in the last ${preset}`} />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finGmvFill" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="gmv" stroke={BRAND_RED} strokeWidth={2} fill="url(#finGmvFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ─── Top stores by revenue (with share %) + Settlements card ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top Revenue Stores" icon={Trophy}>
          {(stats.topStores ?? []).length === 0 ? (
            <EmptyState title="No store revenue yet" height={140} />
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.topStores.slice(0, 8).map((s, i) => {
                const share = topStoreSum > 0 ? ((s.totalGmv ?? 0) / topStoreSum) * 100 : 0;
                return (
                  <div key={i} className="py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{i + 1}. {s.storeName ?? '—'}</span>
                      <span className="text-sm font-bold text-[#B52725]">{fmtINR(s.totalGmv)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#B52725]" style={{ width: `${share.toFixed(1)}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap w-12 text-right">{share.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Settlements & Payouts" icon={Receipt}>
          <EmptyState
            title="Settlements engine not yet active"
            hint="When the payout pipeline ships, this card will show: pending settlements, settled-this-week total, and merchants owed."
            height={200}
          />
        </SectionCard>
      </div>

      {/* Quick Actions moved to the header (2026-06-03) per founder request. */}

      <span className="hidden">{StoreIcon ? '' : ''}</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── Range chips

function PresetChips({ value, onChange }: { value: Preset; onChange: (v: Preset) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-white overflow-hidden">
      {([
        { k: '7d'  as Preset, label: '7d'  },
        { k: '30d' as Preset, label: '30d' },
        { k: '90d' as Preset, label: '90d' },
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
