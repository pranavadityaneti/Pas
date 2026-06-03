/**
 * SupportHome — for SUPPORT (Customer Support) role.
 *
 * Their day is reactive: handle inbound messages, resolve disputes, refund
 * what needs refunding. So the page leads with the INBOX, not metrics.
 *
 * Composition:
 *   - Greeting
 *   - 4 KPIs : Unread Inbox · Open Tickets (proxy) · Cancelled Today · Total Inbox
 *   - Inbox preview: last 12 messages (unread highlighted)
 *   - Cancellations today list — recent customer-facing failures to investigate
 *   - Quick actions to deep pages
 *
 * Honest about gaps:
 *   - "Open Tickets" is a placeholder until we ship a real support_tickets table
 *     — surfaced as "Coming soon" rather than a fake number.
 *   - Cancelled-today uses Order.status = 'CANCELLED' as a proxy for "things
 *     to investigate." Refund queue ships when refunds table exists.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquare, AlertTriangle, Inbox, Mail,
  Loader2, Activity, Wallet, ShoppingBag,
} from 'lucide-react';
import { HomeHeader, KpiTile, QuickActions, SectionCard, EmptyState, fmtINR } from './_shared';
import { formatDistanceToNow } from 'date-fns';

interface InboxMessage   { id: string; contact_name: string | null; wa_phone: string; body: string | null; received_at: string; is_read: boolean; status: string | null; }
interface CancelledOrder { id: string; order_number: string | null; customer_name: string | null; customer_phone: string | null; total_amount: number; created_at: string; cancelled_reason: string | null; }

export function SupportHome() {
  const { user } = useAuth();
  const [unread,        setUnread]       = useState<number | null>(null);
  const [totalInbox,    setTotalInbox]   = useState<number | null>(null);
  const [cancelledToday,setCancelledToday]= useState<number | null>(null);
  const [messages,      setMessages]     = useState<InboxMessage[]>([]);
  const [cancelled,     setCancelled]    = useState<CancelledOrder[]>([]);
  const [loading,       setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sinceMidnight = new Date();
      sinceMidnight.setHours(0, 0, 0, 0);

      const [
        { count: unreadCount },
        { count: totalCount },
        { count: cancelTodayCount },
        inboxRows,
        cancelledOrders,
      ] = await Promise.all([
        supabase.from('wati_inbox').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('wati_inbox').select('id', { count: 'exact', head: true }),
        supabase.from('Order').select('id', { count: 'exact', head: true })
          .eq('status', 'CANCELLED').gte('created_at', sinceMidnight.toISOString()),
        supabase.from('wati_inbox')
          .select('id, contact_name, wa_phone, body, received_at, is_read, status')
          .order('received_at', { ascending: false })
          .limit(12),
        supabase.from('Order')
          .select('id, order_number, customer_name, customer_phone, total_amount, created_at, cancelled_reason')
          .eq('status', 'CANCELLED')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (cancelled) return;
      setUnread(unreadCount ?? 0);
      setTotalInbox(totalCount ?? 0);
      setCancelledToday(cancelTodayCount ?? 0);
      setMessages((inboxRows.data ?? []) as InboxMessage[]);
      setCancelled((cancelledOrders.data ?? []) as CancelledOrder[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Loading support inbox…</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <HomeHeader
        name={user?.name}
        role={user?.role}
        subtitle="Today's inbound — messages to answer, problems to fix."
        right={
          <QuickActions actions={[
            { to: '/customer-support',  label: 'Inbox',    icon: MessageSquare },
            { to: '/refunds-disputes',  label: 'Refunds',  icon: Wallet        },
            { to: '/customers',         label: 'Customers',icon: Activity      },
            { to: '/orders',            label: 'Orders',   icon: ShoppingBag   },
          ]} />
        }
      />

      {/* ─── KPI strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Unread Inbox"       value={unread        == null ? '—' : unread.toLocaleString('en-IN')}        icon={Inbox}         accent  tone={unread && unread > 0 ? 'warn' : 'good'} subtext="WhatsApp messages" />
        <KpiTile label="Open Tickets"       value="—"                                                                    icon={Mail}                                                              subtext="Tickets table not yet wired" />
        <KpiTile label="Cancelled Today"    value={cancelledToday== null ? '—' : cancelledToday.toLocaleString('en-IN')} icon={AlertTriangle} tone={cancelledToday && cancelledToday > 0 ? 'warn' : 'good'} subtext="May need investigation" />
        <KpiTile label="Total Inbox"        value={totalInbox    == null ? '—' : totalInbox.toLocaleString('en-IN')}     icon={MessageSquare}                                                     subtext="All-time messages" />
      </div>

      {/* ─── Inbox preview ─── */}
      <SectionCard title="Recent WhatsApp Messages" icon={MessageSquare}>
        {messages.length === 0 ? (
          <EmptyState
            title="Inbox is empty"
            hint="When customers message via WhatsApp, their conversations land here."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start justify-between gap-3 py-2.5 ${!m.is_read ? 'bg-amber-50/30 -mx-2 px-2 rounded' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                    {m.contact_name || m.wa_phone}
                    {!m.is_read && <span className="inline-block w-1.5 h-1.5 bg-[#B52725] rounded-full" />}
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

      {/* ─── Cancellations to investigate ─── */}
      <SectionCard title="Recent Cancellations" icon={AlertTriangle}>
        {cancelled.length === 0 ? (
          <EmptyState
            title="No cancellations to review"
            hint="Cancelled orders surface here so support can reach out and recover the customer."
            height={140}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {cancelled.map((o) => (
              <div key={o.id} className="flex items-start justify-between py-2.5 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Order {o.order_number ?? o.id.slice(0, 8)} — {fmtINR(o.total_amount)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {o.customer_name ?? 'Unknown'} · {o.customer_phone ?? 'no phone'}
                    {o.cancelled_reason && ` · ${o.cancelled_reason}`}
                  </p>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions moved to the header (2026-06-03) per founder request. */}
    </div>
  );
}
