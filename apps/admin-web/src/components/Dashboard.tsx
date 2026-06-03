/**
 * Dashboard — role-aware home router.
 *
 * 2026-06-03: refactored from a single platform-analytics view into a role
 * switchboard. Each admin-tier role lands on the home page that matches
 * their job, instead of every role seeing the same Super Admin view.
 *
 *   SUPER_ADMIN  → SuperAdminHome  (platform totals, charts, top stores)
 *   OPERATIONS   → OperationsHome  (pending orders, KYC queue, Wati inbox)
 *   FINANCE      → FinanceHome     (GMV, settlements, revenue trend)
 *   SUPPORT      → SupportHome     (inbox, open tickets, refunds)
 *
 * The legacy `isAdmin` flag is treated as SUPER_ADMIN-equivalent so existing
 * founder accounts keep their full platform view without re-provisioning.
 *
 * Any unknown / missing role falls back to SuperAdminHome (safest default —
 * if the role didn't load yet, show the most-permissive view, never
 * less-than-expected).
 */

import { useAuth } from '../context/AuthContext';
import { SuperAdminHome }  from './home/SuperAdminHome';
import { OperationsHome }  from './home/OperationsHome';
import { FinanceHome }     from './home/FinanceHome';
import { SupportHome }     from './home/SupportHome';

export function Dashboard() {
  const { user } = useAuth();

  // Legacy isAdmin → SUPER_ADMIN-equivalent.
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.isAdmin === true;

  if (isSuperAdmin)                        return <SuperAdminHome />;
  if (user?.role === 'OPERATIONS')         return <OperationsHome />;
  if (user?.role === 'FINANCE')            return <FinanceHome />;
  if (user?.role === 'SUPPORT')            return <SupportHome />;

  // Unknown role — degrade upward (show platform view).
  return <SuperAdminHome />;
}
