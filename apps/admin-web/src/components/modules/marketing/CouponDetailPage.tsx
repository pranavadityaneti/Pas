/**
 * Per-coupon detail + analytics page.
 *
 * Phase 3 (3F, 2026-06-08) — KPIs, time series, breakdowns, redemption ledger.
 * Backed by GET /admin/coupons/:id/analytics + GET /admin/coupons/:id/redemptions.
 *
 * Minimal but functional — admin sees real numbers; visual polish in a follow-up.
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchCouponAnalytics,
  fetchCouponRedemptions,
  type CouponAnalytics,
  type RedemptionLedgerEntry,
} from '../../../lib/couponService';

const REDEMPTIONS_PAGE_SIZE = 50;

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function CouponDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [analytics, setAnalytics] = useState<CouponAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [redemptions, setRedemptions] = useState<RedemptionLedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCouponAnalytics(id)
      .then(setAnalytics)
      .catch((err) => toast.error('Failed to load coupon analytics', { description: err?.response?.data?.error ?? err?.message }))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchCouponRedemptions(id, page, REDEMPTIONS_PAGE_SIZE)
      .then((r) => {
        setRedemptions(r.data);
        setTotalPages(r.totalPages);
        setTotal(r.total);
      })
      .catch((err) => toast.error('Failed to load redemptions', { description: err?.response?.data?.error ?? err?.message }));
  }, [id, page]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
    );
  }
  if (!analytics) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500">Coupon not found.</p>
        <Link to="/marketing" className="text-blue-600 underline mt-4 inline-block">Back to coupons</Link>
      </div>
    );
  }

  const { coupon, kpis, timeSeries, topStores, topUsers, orderTypeBreakdown } = analytics;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const isArchived = !!coupon.deletedAt;

  return (
    <div className="h-full overflow-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/marketing" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to coupons
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{coupon.code}</h2>
            <span className={`text-xs px-2 py-1 rounded ${isArchived ? 'bg-gray-100 text-gray-600' : coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {isArchived ? 'Archived' : coupon.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${coupon.fundingSource === 'PLATFORM' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
              {coupon.fundingSource} funded
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {coupon.discountType} {coupon.discountValue ?? ''} {coupon.usedCount ?? 0}/{coupon.usageLimit ?? '∞'} used
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard label="Redemptions" value={kpis.totalRedemptions.toLocaleString('en-IN')} />
        <KpiCard label="Discount given" value={fmt(kpis.totalDiscountValue)} />
        <KpiCard label="PAS funded" value={fmt(kpis.platformFundedTotal)} />
        <KpiCard label="Merchant funded" value={fmt(kpis.merchantFundedTotal)} />
        <KpiCard label="Unique customers" value={kpis.uniqueCustomers.toLocaleString('en-IN')} />
        <KpiCard label="Avg per order" value={fmt(kpis.avgDiscountPerOrder)} />
      </div>

      {/* Time series — simple table view (chart polish in follow-up) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-3">Daily redemptions (IST)</h3>
        {timeSeries.length === 0 ? (
          <p className="text-sm text-gray-400">No redemptions yet.</p>
        ) : (
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Redemptions</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Discount given</th>
                </tr>
              </thead>
              <tbody>
                {timeSeries.map((d) => (
                  <tr key={d.date} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{d.date}</td>
                    <td className="px-3 py-2 font-medium">{d.redemptions}</td>
                    <td className="px-3 py-2 text-gray-700">{fmt(d.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Top stores</h3>
          {topStores.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
            <ul className="space-y-1 text-sm">
              {topStores.map((s) => (
                <li key={s.storeId} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-700">{s.storeName ?? s.storeId.slice(0, 8)}</span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Top customers</h3>
          {topUsers.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
            <ul className="space-y-1 text-sm">
              {topUsers.map((u) => (
                <li key={u.userId} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-700">{u.name ?? u.phone ?? u.userId.slice(0, 8)}</span>
                  <span className="font-medium">{u.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Order type</h3>
          {Object.keys(orderTypeBreakdown).length === 0 ? <p className="text-sm text-gray-400">—</p> : (
            <ul className="space-y-1 text-sm">
              {Object.entries(orderTypeBreakdown).map(([k, v]) => (
                <li key={k} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-700 capitalize">{k}</span>
                  <span className="font-medium">{v as number}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Redemption ledger */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Redemption ledger</h3>
          <span className="text-xs text-gray-500">{total.toLocaleString('en-IN')} total</span>
        </div>
        {redemptions.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No redemptions yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">When (IST)</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Order</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Store</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Discount</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Funded by</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{r.user?.name || r.user?.phone || r.userId.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.order?.orderNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{r.order?.store_name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{r.discountAmount ? fmt(Number(r.discountAmount)) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${r.fundingSource === 'PLATFORM' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.fundingSource ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-50 flex items-center gap-1 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-50 flex items-center gap-1 hover:bg-gray-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
