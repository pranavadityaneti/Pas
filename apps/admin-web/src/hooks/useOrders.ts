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
