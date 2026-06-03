/**
 * Audit Log — placeholder until the real `audit_log` table + middleware ship.
 *
 * 2026-06-02: hardcoded fake admins (Rahul / Sneha) removed per founder request.
 * Real wiring is queued as Tier C (multi-day) — needs:
 *   - `audit_log` table (Prisma migration)
 *   - Middleware on every API mutation route
 *   - Backfill strategy for historical actions (probably "leave history blank")
 */

import { ShieldAlert } from 'lucide-react';

export function AuditLog() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Security Audit Trail</h2>
        <p className="text-sm text-gray-500">Monitor sensitive actions and system changes.</p>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col items-center justify-center text-center p-10">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-5">
          <ShieldAlert className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Audit logging not yet active</h3>
        <p className="text-sm text-gray-600 max-w-md leading-relaxed">
          Admin actions (KYC decisions, coupon changes, refunds, role assignments) will be
          recorded here once the audit logging middleware is wired across the API.
        </p>
        <p className="text-xs text-gray-500 mt-4">
          Planned for a post-launch session — needs a new <code className="bg-gray-100 px-1 py-0.5 rounded">audit_log</code> table + per-route instrumentation.
        </p>
      </div>
    </div>
  );
}
