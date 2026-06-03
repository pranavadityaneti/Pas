/**
 * useCustomers — Customers page data source.
 *
 * 2026-06-03 (LATE night): rewritten to call the admin API instead of
 * Supabase PostgREST directly.
 *
 * Why the rewrite: tonight's debugging showed PostgREST direct reads are
 * fragile — schema-cache misses, RLS-blocked rows, case-sensitive table
 * names mapped via Prisma's @@map all create confusing "table not found"
 * or "zero data" failures. Admin reads are now routed through the
 * `GET /admin/customers` endpoint which uses Prisma (direct PG connection
 * with service_role-equivalent grants) gated by requireRole. Cleaner,
 * matches the rest of the admin write paths, no PostgREST surprises.
 *
 * Block / Unblock still go via `PATCH /admin/users/:id` (existing endpoint
 * from the RBAC sprint).
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';

export type Customer = {
  id: string;
  /** Real name from User.name (with profiles.full_name fallback applied server-side). NULL when neither is set. */
  name: string | null;
  email: string;
  phone: string;
  city: string;
  ltv: number;
  status: 'active' | 'suspended';
  /** User.role — typically CONSUMER but MERCHANT-tier users who also placed orders surface here too. */
  role: string;
  avatar_url: string | null;
  created_at: string;
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

interface RawApiUser {
  id:        string;
  name:      string | null;
  email:     string | null;
  phone:     string | null;
  status:    string | null;
  role:      string | null;
  createdAt: string;
  orders:    RawOrder[];
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
      // Single API call — server does the User + Order + MerchantBranch joins
      // via Prisma, returns a stable shape.
      const { data } = await api.get<{
        customers:     RawApiUser[];
        branchCityMap: Record<string, string>;
      }>('/admin/customers');

      const usersArr      = data.customers ?? [];
      const branchCityMap = data.branchCityMap ?? {};

      const now = Date.now();
      const mapped: Customer[] = usersArr.map(u => {
        const allOrders    = (u.orders ?? []).filter(o => o?.created_at);
        const sortedOrders = [...allOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const lastOrder    = sortedOrders[0];
        const lastBranchId = lastOrder?.branch_id ?? null;
        const city         = (lastBranchId && branchCityMap[lastBranchId]) || 'Unknown';

        const orderCount     = sortedOrders.length;
        const completedCount = sortedOrders.filter(o => o.status === 'COMPLETED').length;
        const cancelledCount = sortedOrders.filter(o => o.status === 'CANCELLED').length;

        const ltv = sortedOrders
          .filter(o => o.status !== 'CANCELLED')
          .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
        const nonCancelledCount = orderCount - cancelledCount;
        const aov = nonCancelledCount > 0 ? ltv / nonCancelledCount : 0;

        const daysSinceLast = lastOrder
          ? Math.floor((now - new Date(lastOrder.created_at).getTime()) / 86400000)
          : null;
        const daysSinceSignup = Math.floor((now - new Date(u.createdAt).getTime()) / 86400000);

        const cleanName = (u.name && u.name.trim().length > 0) ? u.name.trim() : null;

        return {
          id:                    u.id,
          name:                  cleanName,
          email:                 u.email ?? '',
          phone:                 u.phone ?? '',
          city,
          ltv,
          status:                (u.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
          role:                  u.role ?? 'CONSUMER',
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
        description: err?.response?.data?.error ?? err?.message ?? 'Network error.',
      });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Suspend / un-suspend via the existing PATCH /admin/users/:id endpoint.
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
