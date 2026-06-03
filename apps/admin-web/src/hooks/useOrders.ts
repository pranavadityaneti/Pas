/**
 * useOrders — order-list hook for the admin Orders page (/orders).
 *
 * 2026-06-03 (night): SECOND smoking-gun fix from the founder audit.
 *
 * Same bug class as useCustomers: this hook was querying the LOWERCASE
 * `orders` table (a stale demo seed from apps/api/create_orders.sql)
 * instead of the production `"Order"` table where every real order lives.
 *
 * What changed:
 *   - `.from('orders')` → `.from('Order')` — production table.
 *   - Order type rebuilt against the real schema:
 *       order_number, total_amount, user_id, branch_id, items_count,
 *       cancelled_reason, order_type, and the real OrderStatus enum
 *       (PENDING / CONFIRMED / READY / COMPLETED / CANCELLED / REFUNDED).
 *   - sla_minutes + the lowercase `disputed` status removed entirely.
 *     Production has no SLA tracking and no `disputed` status — refund/
 *     dispute workflows live on /refunds-disputes.
 *   - Realtime subscription channel updated to `public:Order`.
 *   - updateOrderStatus writes to `"Order"` with UPPERCASE enum values.
 *
 * NOT touched: the consumer-side `POST /orders` flow in apps/api/src/
 * index.ts, including the 4-layer FK-race hardening landed 2026-05-29.
 * This file is admin-read/admin-write only — no production-create paths
 * altered.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export type OrderStatus =
  | 'PENDING'    // payment captured, store not yet confirmed
  | 'CONFIRMED'  // store accepted
  | 'READY'      // ready for pickup
  | 'COMPLETED'  // picked up / closed out
  | 'CANCELLED'  // cancelled (by either side)
  | 'REFUNDED';  // refund issued

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

export function useOrders() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();

    // Realtime: subscribe to the REAL Order table, not the legacy lowercase one.
    const subscription = supabase
      .channel('public:Order')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order' },
        (payload) => handleRealtimeUpdate(payload),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Order')
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          store_id,
          store_name,
          user_id,
          branch_id,
          status,
          total_amount,
          items_count,
          order_type,
          cancelled_reason,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(500);  // admin view — cap to avoid pulling thousands at once

      if (error) throw error;
      setOrders((data ?? []) as Order[]);
    } catch (error: any) {
      console.error('useOrders error:', error);
      toast.error('Failed to load orders', {
        description: error?.message ?? 'Network or permission error.',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setOrders(prev => [payload.new as Order, ...prev]);
      const ordNum = payload.new?.order_number ?? String(payload.new?.id ?? '').slice(0, 8);
      toast.info('New order received', { description: `#${ordNum}` });
    } else if (payload.eventType === 'UPDATE') {
      setOrders(prev => prev.map(o => o.id === payload.new.id ? (payload.new as Order) : o));
    } else if (payload.eventType === 'DELETE') {
      setOrders(prev => prev.filter(o => o.id !== payload.old.id));
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    // Optimistic UI
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    try {
      const { error } = await supabase
        .from('Order')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Order updated → ${status}`);
    } catch (error: any) {
      // Roll back optimistic state by re-fetching authoritative data
      fetchOrders();
      toast.error('Failed to update order status', {
        description: error?.message ?? 'Try again.',
      });
    }
  };

  return { orders, loading, fetchOrders, updateOrderStatus };
}
