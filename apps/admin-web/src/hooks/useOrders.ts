/**
 * useOrders — order-list hook for the admin /orders page.
 *
 * 2026-06-03 (LATE night): switched from Supabase direct .from() to the
 * admin API endpoints (`GET /admin/orders` and `PATCH /admin/orders/:id`)
 * for the same reason as useCustomers — PostgREST cache / RLS / table-
 * name surprises made direct reads fragile. Now uses Prisma server-side
 * via the API, gated by requireRole. See the apps/api/src/index.ts
 * comment block "Admin reads — proper architecture".
 *
 * Realtime subscription dropped — was subscribing to a Supabase channel
 * that doesn't reflect Prisma writes by default. If you want push-based
 * order updates later, the cleanest path is server-sent events from the
 * API or a polling refresh button (already wired).
 *
 *   API endpoints used:
 *     GET   /admin/orders           — list (optional ?userId=X)
 *     PATCH /admin/orders/:id       — Force Complete / Force Cancel
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';
import { supabase } from '../lib/supabaseClient';

export type OrderStatus =
  | 'PENDING'          // payment captured, store not yet confirmed
  | 'CONFIRMED'        // store accepted
  | 'PREPARING'        // store actively preparing the order
  | 'READY'            // ready for pickup
  | 'COMPLETED'        // picked up / closed out
  | 'CANCELLED'        // cancelled (by either side)
  | 'RETURN_REQUESTED' // customer asked to return
  | 'RETURN_APPROVED'  // return greenlit
  | 'RETURN_REJECTED'  // return denied
  | 'REFUNDED';        // refund issued

/** Active-tab grouping — pre-fulfillment statuses that need ops attention. */
export const ACTIVE_STATUSES: ReadonlyArray<OrderStatus> = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'READY',
];

/** Returns-tab grouping — anything in the return lifecycle (pre-refund). */
export const RETURN_STATUSES: ReadonlyArray<OrderStatus> = [
  'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
];

export type Order = {
  id:               string;
  order_number:     string | null;
  customer_name:    string | null;
  customer_phone:   string | null;
  store_id:         string | null;
  store_name:       string | null;
  user_id:          string | null;
  branch_id:        string | null;
  status:           OrderStatus;
  total_amount:     number;
  items_count:      number | null;
  order_type:       string | null;
  cancelled_reason: string | null;
  created_at:       string;
};

export function useOrders(userIdFilter?: string | null) {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (userIdFilter) params.userId = userIdFilter;
      const { data } = await api.get<{ orders: Order[]; count: number }>('/admin/orders', { params });
      setOrders(data.orders ?? []);
    } catch (err: any) {
      console.error('useOrders error:', err);
      toast.error('Failed to load orders', {
        description: err?.response?.data?.error ?? err?.message ?? 'Network error.',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userIdFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Realtime: live updates when orders are inserted / updated / deleted ──
  //
  // Subscribes to Postgres CDC on the lowercase `orders` table (the real
  // production table that Prisma `Order` maps to via @@map). Supabase
  // Realtime listens to the WAL regardless of who wrote the row — so
  // Prisma writes from the consumer/merchant apps still emit events.
  //
  // Caveat: Realtime payloads are RLS-filtered. If the admin's JWT does
  // not have a SELECT policy on `orders`, the event arrives with `new`/
  // `old` set to {} and we ignore it. Manual Refresh is the authoritative
  // fallback in that case (button already wired). When admin RLS policies
  // are added later, this code starts streaming live without further changes.
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          const isEmpty = (o: any) => !o || typeof o !== 'object' || Object.keys(o).length === 0;

          if (payload.eventType === 'INSERT' && !isEmpty(payload.new)) {
            // Respect server-side userId filter — don't surface other customers' orders.
            if (userIdFilter && payload.new.user_id !== userIdFilter) return;
            setOrders(prev => [payload.new as Order, ...prev]);
            const label = payload.new?.order_number ?? String(payload.new?.id ?? '').slice(0, 8);
            toast.info('New order received', { description: `#${label}` });
          } else if (payload.eventType === 'UPDATE' && !isEmpty(payload.new)) {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? (payload.new as Order) : o));
          } else if (payload.eventType === 'DELETE' && !isEmpty(payload.old)) {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userIdFilter]);

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    // Optimistic UI
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    try {
      await api.patch(`/admin/orders/${id}`, { status });
      toast.success(`Order updated → ${status}`);
    } catch (err: any) {
      // Roll back optimistic state by re-fetching authoritative data
      fetchOrders();
      toast.error('Failed to update order', {
        description: err?.response?.data?.error ?? err?.message ?? 'Try again.',
      });
    }
  };

  return { orders, loading, fetchOrders, updateOrderStatus };
}
