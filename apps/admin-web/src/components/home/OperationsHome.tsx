/**
 * OperationsHome — for OPERATIONS role.
 *
 * Their day is about keeping the engine moving: orders flowing, merchants
 * onboarded, stores active, support tickets in flight. So the page leads
 * with QUEUES that need their attention, not vanity metrics.
 *
 * Composition:
 *   - Greeting
 *   - 4 KPIs : Pending Orders · KYC Queue · Unread Inbox · Active Stores
 *   - Today's order volume (line) — momentum signal
 *   - Recent KYC submissions     — what to review next
 *   - Recent Wati inbox messages — what to respond to next
 *   - Quick actions to deep pages
 *
 * Honest about gaps:
 *   - "Pending Orders" counts statuses PENDING + CONFIRMED + READY (anything
 *     not COMPLETED or CANCELLED). If you want a different cutoff, tell me.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingBag, ClipboardCheck, MessageSquare, Building2,
  Loader2, Activity, Store as StoreIcon, FileBarChart2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { HomeHeader, KpiTile, QuickActions, SectionCard, EmptyState, fmtINR } from './_shared';
import { formatDistanceToNow } from 'date-fns';

const BRAND_RED = '#B52725';

interface PendingMerchant { id: string; store_name: string | null; created_at: string; kyc_status: string | null; }
interface InboxMessage    { id: string; contact_name: string | null; wa_phone: string; body: string | null; received_at: string; is_read: boolean; }
interface HourBucket      { hour: string; orders: number; }

export function OperationsHome() {
  const { user } = useAuth();
  const [pendingOrders,   setPendingOrders]   = useState<number | null>(null);
  const [kycCount,        setKycCount]        = useState<number | null>(null);
  const [unreadInbox,     setUnreadInbox]     = useState<number | null>(null);
  const [activeStores,    setActiveStores]    = useState<number | null>(null);
  const [pendingMerchants,setPendingMerchants]= useState<PendingMerchant[]>([]);
  const [recentMessages,  setRecentMessages]  = useState<InboxMessage[]>([]);
  const [hourBuckets,     setHourBuckets]     = useState<HourBucket[]>([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sinceMidnight = new Date();
      sinceMidnight.setHours(0, 0, 0, 0);

      const [
        { count: pendingOrdersCount },
        { count: kycPendingCount },
        { count: inboxUnreadCount },
        { count: activeStoresCount },
        kycRows,
        inboxRows,
        todaysOrders,
      ] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .in('status', ['PENDING', 'CONFIRMED', 'READY']),
        supabase.from('merchants').select('id', { count: 'exact', head: true })
          .eq('kyc_status', 'pending'),
        supabase.from('wati_inbox').select('id', { count: 'exact', head: true })
          .eq('is_read', false),
        supabase.from('merchant_branches').select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('merchants')
          .select('id, store_name, created_at, kyc_status')
          .eq('kyc_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('wati_inbox')
          .select('id, contact_name, wa_phone, body, received_at, is_read')
          .order('received_at', { ascending: false })
          .limit(8),
        supabase.from('orders')
          .select('created_at')
          .gte('created_at', sinceMidnight.toISOString()),
      ]);

      if (cancelled) return;

      setPendingOrders(pendingOrdersCount ?? 0);
      setKycCount(kycPendingCount ?? 0);
      setUnreadInbox(inboxUnreadCount ?? 0);
      setActiveStores(activeStoresCount ?? 0);
      setPendingMerchants((kycRows.data ?? []) as PendingMerchant[]);
      setRecentMessages((inboxRows.data ?? []) as InboxMessage[]);

      // Bucket today's orders into hours
      const buckets: Record<number, number> = {};
      (todaysOrders.data ?? []).forEach((o: { created_at: string }) => {
        const h = new Date(o.created_at).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      });
      const hours: HourBucket[] = [];
      const nowHour = new Date().getHours();
      for (let h = 0; h <= nowHour; h++) {
        hours.push({
          hour: `${h.toString().padStart(2, '0')}:00`,
          orders: buckets[h] ?? 0,
        });
      }
      setHourBuckets(hours);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Loading operations queues…</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <HomeHeader
        name={user?.name}
        role={user?.role}
        subtitle="Today's queues — what needs your attention now."
        right={
          <QuickActions actions={[
            { to: '/orders',           label: 'Orders',     icon: ShoppingBag    },
            { to: '/merchants',        label: 'KYC',        icon: ClipboardCheck },
            { to: '/customer-support', label: 'Inbox',      icon: MessageSquare  },
            { to: '/reports',          label: 'Reports',    icon: FileBarChart2  },
          ]} />
        }
      />

      {/* ─── KPI strip — queue depths ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Pending Orders" value={pendingOrders == null ? '—' : pendingOrders.toLocaleString('en-IN')} icon={ShoppingBag}    accent  subtext="Not yet completed or cancelled" />
        <KpiTile label="KYC Queue"      value={kycCount      == null ? '—' : kycCount.toLocaleString('en-IN')}     icon={ClipboardCheck} tone={kycCount && kycCount > 5 ? 'warn' : undefined} subtext="Merchants awaiting review" />
        <KpiTile label="Unread Inbox"   value={unreadInbox   == null ? '—' : unreadInbox.toLocaleString('en-IN')}  icon={MessageSquare}  tone={unreadInbox && unreadInbox > 0 ? 'warn' : 'good'} subtext="WhatsApp messages" />
        <KpiTile label="Active Stores"  value={activeStores  == null ? '—' : activeStores.toLocaleString('en-IN')} icon={Building2}      tone="good" subtext="Branches live now" />
      </div>

      {/* ─── Today's order momentum ─── */}
      <SectionCard title="Today's Order Volume" icon={Activity}>
        {hourBuckets.length === 0 || hourBuckets.every(h => h.orders === 0) ? (
          <EmptyState title="No orders today yet" hint="Hourly buckets will populate as orders come in." />
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v: number) => [v, 'Orders']} />
                <Line type="monotone" dataKey="orders" stroke={BRAND_RED} strokeWidth={2} dot={{ r: 3, fill: BRAND_RED }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ─── Two queues side by side ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Pending KYC Reviews" icon={ClipboardCheck}>
          {pendingMerchants.length === 0 ? (
            <EmptyState title="No KYC reviews pending" hint="Great — the queue is empty." height={140} />
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingMerchants.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.store_name ?? '(unnamed merchant)'}</p>
                    <p className="text-xs text-gray-500">Submitted {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {m.kyc_status ?? 'pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent WhatsApp Messages" icon={MessageSquare}>
          {recentMessages.length === 0 ? (
            <EmptyState title="No inbox messages yet" hint="Inbound Wati messages will appear here." height={140} />
          ) : (
            <div className="divide-y divide-gray-100">
              {recentMessages.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.contact_name || m.wa_phone}
                      {!m.is_read && <span className="ml-2 inline-block w-1.5 h-1.5 bg-[#B52725] rounded-full align-middle" />}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{m.body ?? '(no text body)'}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(m.received_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Quick Actions moved to the header (2026-06-03) per founder request. */}

      {/* Unused-import safety — keeps fmtINR + StoreIcon available for future tiles */}
      <span className="hidden">{fmtINR(0)}{StoreIcon ? '' : ''}</span>
    </div>
  );
}
