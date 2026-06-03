/**
 * useCustomers — consumer-list hook for the admin Customers page.
 *
 * 2026-06-03: rewrite to stop showing fake data.
 *   - REAL city via the customer's most recent order's branch city
 *     (previously hardcoded "Hyderabad" for every customer)
 *   - REAL status from `User.status` (previously hardcoded "active")
 *   - REAL email (previously the details sheet faked `<id>@example.com`)
 *   - Orders join now uses `total_amount` (authoritative) instead of the
 *     occasionally-zero `amount` Decimal column.
 *   - Orders sorted client-side so `last_order_at` is the actual last one.
 *   - blockCustomer / unblockCustomer wired to PATCH /admin/users/:id
 *     (the endpoint already exists from the RBAC v1 work).
 *
 *   Adds derived fields used by the new columns + detail sheet:
 *     order_count · aov · last_order_at · days_since_last_order · days_since_signup
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import api from '../lib/api';

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  ltv: number;
  status: 'active' | 'suspended';
  avatar_url: string | null;
  created_at: string;
  // Phase 2 enrichments
  order_count: number;
  aov: number;
  last_order_at: string | null;
  days_since_last_order: number | null;
  days_since_signup: number;
};

interface RawOrder {
  total_amount: number | null;
  created_at: string;
  branch_id: string | null;
}

interface RawUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  createdAt: string;
  orders: RawOrder[] | null;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // 1. Pull consumers + their orders. PostgREST embedded resource via FK.
      const { data: users, error } = await supabase
        .from('User')
        .select(`
          id,
          name,
          email,
          phone,
          status,
          "createdAt",
          orders (
            total_amount,
            created_at,
            branch_id
          )
        `)
        .eq('role', 'CONSUMER');

      if (error) throw error;

      // 2. Batch-resolve city: collect every unique branch_id from every customer's orders
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

      // 3. Map to Customer shape with derived fields
      const now = Date.now();
      const mapped: Customer[] = (users ?? []).map((rawU: any) => {
        const u: RawUser = rawU;
        const sortedOrders = [...(u.orders ?? [])]
          .filter(o => o?.created_at)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const lastOrder       = sortedOrders[0];
        const lastBranchId    = lastOrder?.branch_id ?? null;
        const city            = (lastBranchId && branchCityMap[lastBranchId]) || 'Unknown';
        const orderCount      = sortedOrders.length;
        const ltv             = sortedOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
        const aov             = orderCount > 0 ? ltv / orderCount : 0;
        const daysSinceLast   = lastOrder
          ? Math.floor((now - new Date(lastOrder.created_at).getTime()) / 86400000)
          : null;
        const daysSinceSignup = Math.floor((now - new Date(u.createdAt).getTime()) / 86400000);

        return {
          id:                    u.id,
          name:                  (u.name && u.name.trim()) || (u.email ? u.email.split('@')[0] : 'Customer'),
          email:                 u.email ?? '',
          phone:                 u.phone ?? 'N/A',
          city,
          ltv,
          status:                (u.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
          avatar_url:            null,        // User table has no avatar column; honest null
          created_at:            u.createdAt,
          order_count:           orderCount,
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

  // ─── Suspend / un-suspend via the existing PATCH /admin/users/:id endpoint ──

  const blockCustomer = async (id: string, reason?: string) => {
    // Optimistic UI
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'suspended' as const } : c));
    try {
      await api.patch(`/admin/users/${id}`, {
        status: 'suspended',
        suspendedReason: reason ?? 'Suspended from Customers admin',
      });
      toast.success('Customer suspended');
    } catch (err: any) {
      // Roll back optimistic state
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
