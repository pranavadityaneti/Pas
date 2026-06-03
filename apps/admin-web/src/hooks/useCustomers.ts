/**
 * useCustomers — consumer-list hook for the admin Customers page.
 *
 * 2026-06-03 (afternoon): Phase 1-3 wired real status / city / actions.
 *
 * 2026-06-03 (night): SMOKING-GUN FIX — the orders embed was hitting the
 * LOWERCASE legacy `orders` table (created by apps/api/create_orders.sql for
 * an old demo) instead of the production `"Order"` table written by Prisma.
 * The legacy table has no `user_id` FK, so PostgREST resolved `u.orders` to
 * an empty array for every customer — that's why Orders/AOV/LTV/Location
 * were all zero/Unknown despite founders + the team having placed ~70-115
 * real orders over the testing period.
 *
 * Fix: target `Order` explicitly with the FK hint `!fk_orders_user`. Now
 * the embed pulls real rows. Location now derives from the most recent
 * order's branch city as designed.
 *
 * Also: stop displaying garbage as the "name". Wati-OTP signups synthesize
 * `<phone>@phone.pickatstore.in` and older signups have `<uuid>@…` emails,
 * so `email.split('@')[0]` was rendering phone numbers and UUIDs in the
 * Customer column. New behavior: keep real name when present, else expose
 * `name: null` and let the UI show a muted "(no name)" tag.
 *
 *   Adds derived fields:
 *     order_count       — total orders placed (any status)
 *     completed_count   — orders with status COMPLETED
 *     cancelled_count   — orders with status CANCELLED
 *     ltv               — sum of total_amount over non-cancelled orders
 *     aov               — ltv / non-cancelled-count
 *     last_order_at     — most recent order's created_at (any status)
 *     days_since_last_order
 *     days_since_signup
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import api from '../lib/api';

export type Customer = {
  id: string;
  /** Real name from User.name. NULL when the user has not set a profile name. */
  name: string | null;
  /** Real email — but for phone-OTP users this is the synthesized
   *  `<phone>@phone.pickatstore.in` filler that Supabase Auth requires.
   *  We KEEP it on the type for search, but the UI does NOT display it. */
  email: string;
  phone: string;
  city: string;
  ltv: number;
  status: 'active' | 'suspended';
  avatar_url: string | null;
  created_at: string;
  // Derived
  order_count:            number;
  completed_count:        number;
  cancelled_count:        number;
  aov:                    number;
  last_order_at:          string | null;
  days_since_last_order:  number | null;
  days_since_signup:      number;
};

interface RawOrder {
  total_amount: number | null;
  created_at:   string;
  branch_id:    string | null;
  status:       string | null;
}

interface RawUser {
  id:          string;
  name:        string | null;
  email:       string | null;
  phone:       string | null;
  status:      string | null;
  createdAt:   string;
  orders:      RawOrder[] | null;
}

/** Helper used by the UI: is this a synthesized auth-filler email (not a real one)? */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.endsWith('@phone.pickatstore.in') || /^[0-9a-f-]{36}@/.test(email);
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // ── 1. Fetch consumers (no embed). ──────────────────────────────────
      // Earlier attempt used PostgREST embed `orders:Order!fk_orders_user(...)`
      // and the API errored with "Could not find a relationship between 'User'
      // and 'Order' in the schema cache". That's PostgREST's relationship
      // cache missing the FK — happens when constraints were created out of
      // band or the cache hasn't reloaded. Rather than chase the cache, we
      // do two clean queries and join in JS. Bulletproof + zero magic.
      const { data: usersRaw, error: uErr } = await supabase
        .from('User')
        .select('id, name, email, phone, status, "createdAt"')
        .eq('role', 'CONSUMER');
      if (uErr) throw uErr;
      const usersArr: any[] = usersRaw ?? [];

      // ── 2. Fetch orders only for these user IDs. ────────────────────────
      const userIds = usersArr.map(u => u.id);
      const ordersByUser: Record<string, RawOrder[]> = {};
      if (userIds.length > 0) {
        const { data: ordersRaw, error: oErr } = await supabase
          .from('Order')
          .select('user_id, total_amount, created_at, branch_id, status')
          .in('user_id', userIds);
        if (oErr) throw oErr;
        (ordersRaw ?? []).forEach((o: any) => {
          const uid = o.user_id;
          if (!uid) return;
          if (!ordersByUser[uid]) ordersByUser[uid] = [];
          ordersByUser[uid].push({
            total_amount: o.total_amount,
            created_at:   o.created_at,
            branch_id:    o.branch_id,
            status:       o.status,
          });
        });
      }

      // Attach orders onto each user (preserves the rest of the mapping logic).
      const users = usersArr.map(u => ({ ...u, orders: ordersByUser[u.id] ?? [] }));

      // ── 3. Batch-resolve city: collect every branch_id, look up city ──
      const branchIds = new Set<string>();
      (users ?? []).forEach((u: any) => {
        (u.orders ?? []).forEach((o: RawOrder) => {
          if (o?.branch_id) branchIds.add(o.branch_id);
        });
      });

      const branchCityMap: Record<string, string> = {};
      if (branchIds.size > 0) {
        const { data: branches, error: bErr } = await supabase
          .from('merchant_branches')
          .select('id, city')
          .in('id', Array.from(branchIds));
        if (!bErr) {
          (branches ?? []).forEach((b: any) => {
            if (b?.id && b?.city) branchCityMap[b.id] = b.city;
          });
        }
      }

      // ── 3. Map to Customer shape + compute derived fields ──────────────
      const now = Date.now();
      const mapped: Customer[] = (users ?? []).map((rawU: any) => {
        const u: RawUser = rawU;

        const allOrders = (u.orders ?? []).filter(o => o?.created_at);
        const sortedOrders = [...allOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const lastOrder       = sortedOrders[0];
        const lastBranchId    = lastOrder?.branch_id ?? null;
        const city            = (lastBranchId && branchCityMap[lastBranchId]) || 'Unknown';

        const orderCount      = sortedOrders.length;
        const completedCount  = sortedOrders.filter(o => o.status === 'COMPLETED').length;
        const cancelledCount  = sortedOrders.filter(o => o.status === 'CANCELLED').length;

        // LTV: count non-cancelled (i.e., money the customer actually committed).
        const ltv = sortedOrders
          .filter(o => o.status !== 'CANCELLED')
          .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
        const nonCancelledCount = orderCount - cancelledCount;
        const aov = nonCancelledCount > 0 ? ltv / nonCancelledCount : 0;

        const daysSinceLast = lastOrder
          ? Math.floor((now - new Date(lastOrder.created_at).getTime()) / 86400000)
          : null;
        const daysSinceSignup = Math.floor((now - new Date(u.createdAt).getTime()) / 86400000);

        // Name: keep real name; explicit null when missing so the UI can show "(no name)"
        // instead of rendering phone numbers / UUIDs as if they were names.
        const cleanName = (u.name && u.name.trim().length > 0) ? u.name.trim() : null;

        return {
          id:                    u.id,
          name:                  cleanName,
          email:                 u.email ?? '',
          phone:                 u.phone ?? '',
          city,
          ltv,
          status:                (u.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
          avatar_url:            null,
          created_at:            u.createdAt,
          order_count:           orderCount,
          completed_count:       completedCount,
          cancelled_count:       cancelledCount,
          aov,
          last_order_at:         lastOrder?.created_at ?? null,
          days_since_last_order: daysSinceLast,
          days_since_signup:     daysSinceSignup,
        };
      });

      setCustomers(mapped);
    } catch (err: any) {
      console.error('useCustomers error:', err);
      toast.error('Failed to load customers', {
        description: err?.message ?? 'Check your network connection and try again.',
      });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Suspend / un-suspend via the existing PATCH /admin/users/:id endpoint ──

  const blockCustomer = async (id: string, reason?: string) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'suspended' as const } : c));
    try {
      await api.patch(`/admin/users/${id}`, {
        status: 'suspended',
        suspendedReason: reason ?? 'Suspended from Customers admin',
      });
      toast.success('Customer suspended');
    } catch (err: any) {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'active' as const } : c));
      toast.error('Failed to suspend', {
        description: err?.response?.data?.error ?? err?.message ?? 'Try again.',
      });
    }
  };

  const unblockCustomer = async (id: string) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'active' as const } : c));
    try {
      await api.patch(`/admin/users/${id}`, { status: 'active' });
      toast.success('Customer reactivated');
    } catch (err: any) {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'suspended' as const } : c));
      toast.error('Failed to reactivate', {
        description: err?.response?.data?.error ?? err?.message ?? 'Try again.',
      });
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  return { customers, loading, fetchCustomers, blockCustomer, unblockCustomer };
}
