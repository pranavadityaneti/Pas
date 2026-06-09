/**
 * Audit Log — wired to the real audit_log table via GET /admin/audit-log.
 *
 * Phase 3 (3H, 2026-06-08) — replaces the placeholder. Backed by:
 *   - Phase 1 Migration #2: audit_log table
 *   - Phase 2 sub-task 2C: writeAuditLog helper called from every coupon mutation
 *   - Phase 3 sub-task 3A: GET /admin/audit-log endpoint with pagination + filter
 *
 * Filter `coupon.*` (default) to see only coupon-related actions. Clear filter
 * to see everything once more writeAuditLog call sites are added in later work.
 */

import { useState, useEffect } from 'react';
import { ShieldAlert, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { fetchAuditLog, type AuditLogEntry } from '../../../lib/couponService';
import { toast } from 'sonner';

const PAGE_SIZE = 50;
const PRESET_FILTERS = [
  { label: 'All actions', value: '' },
  { label: 'Coupon actions', value: 'coupon.' },
  { label: 'Coupon create', value: 'coupon.create' },
  { label: 'Coupon update', value: 'coupon.update' },
  { label: 'Coupon archive', value: 'coupon.archive' },
  { label: 'Coupon reversals', value: 'coupon.redemption_reversed' },
];

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('coupon.');

  const load = async (p: number = page, f: string = filter) => {
    setLoading(true);
    try {
      const result = await fetchAuditLog({
        actionPrefix: f || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setEntries(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err: any) {
      toast.error('Failed to load audit log', { description: err?.response?.data?.error ?? err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, filter); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Security Audit Trail</h2>
          <p className="text-sm text-gray-500">
            Permanent record of sensitive admin actions. {total > 0 && <span>{total.toLocaleString()} entries</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {PRESET_FILTERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={() => load(page, filter)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-full p-10 text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-5">
              <ShieldAlert className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No audit entries</h3>
            <p className="text-sm text-gray-600 max-w-md">
              {filter
                ? `No actions matching "${filter}". Try a different filter or clear it.`
                : 'No admin actions logged yet. Make a coupon change to see it here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">When (IST)</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Actor</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Target</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Diff</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">{e.action}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.actorUserId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {e.targetType ? <span className="font-medium">{e.targetType}</span> : <span className="text-gray-400">—</span>}
                      {e.targetId ? <span className="font-mono text-gray-500 ml-1">{e.targetId.slice(0, 8)}…</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <details className="cursor-pointer">
                        <summary className="hover:text-gray-700">view</summary>
                        <div className="mt-2 max-w-md text-xs">
                          <div className="text-gray-400 mb-1">before</div>
                          <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-32">{JSON.stringify(e.beforeJson, null, 2) || 'null'}</pre>
                          <div className="text-gray-400 mb-1 mt-2">after</div>
                          <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-32">{JSON.stringify(e.afterJson, null, 2) || 'null'}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p, filter); }}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p, filter); }}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm hover:bg-gray-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
