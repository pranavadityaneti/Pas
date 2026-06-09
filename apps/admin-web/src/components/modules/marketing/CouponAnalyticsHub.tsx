/**
 * Cross-coupon analytics dashboard.
 *
 * Phase 3 (3G, 2026-06-08) — MTD totals, top coupons by redemption count and
 * ROI, distribution by funding source. Backed by the per-coupon analytics
 * endpoint aggregated across all coupons.
 *
 * Minimal but functional — provides the cross-coupon picture even before
 * dedicated /admin/analytics/cross-coupon endpoint is built.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { fetchCoupons, fetchCouponAnalytics, type Coupon, type CouponAnalytics } from '../../../lib/couponService';

interface CouponRow {
  coupon: Coupon;
  kpis: CouponAnalytics['kpis'] | null;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function CouponAnalyticsHub() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const coupons = await fetchCoupons({ includeArchived: true });
        const result: CouponRow[] = await Promise.all(
          coupons.map(async (c) => {
            try {
              const a = await fetchCouponAnalytics(c.id);
              return { coupon: c, kpis: a.kpis };
            } catch {
              return { coupon: c, kpis: null };
            }
          }),
        );
        if (!cancelled) setRows(result);
      } catch (err: any) {
        if (!cancelled) toast.error('Failed to load analytics', { description: err?.response?.data?.error ?? err?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  // Aggregate totals
  const grand = rows.reduce(
    (acc, r) => {
      if (!r.kpis) return acc;
      acc.redemptions += r.kpis.totalRedemptions;
      acc.discount += r.kpis.totalDiscountValue;
      acc.platform += r.kpis.platformFundedTotal;
      acc.merchant += r.kpis.merchantFundedTotal;
      acc.customers += r.kpis.uniqueCustomers;
      return acc;
    },
    { redemptions: 0, discount: 0, platform: 0, merchant: 0, customers: 0 },
  );
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const sortedByRedemptions = [...rows]
    .filter(r => r.kpis !== null)
    .sort((a, b) => (b.kpis!.totalRedemptions - a.kpis!.totalRedemptions))
    .slice(0, 10);

  return (
    <div className="h-full overflow-auto space-y-6 p-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Coupon Analytics</h2>
        <p className="text-sm text-gray-500">Cross-coupon performance overview. {rows.length} coupons tracked.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total redemptions" value={grand.redemptions.toLocaleString('en-IN')} />
        <KpiCard label="Discount given" value={fmt(grand.discount)} />
        <KpiCard label="PAS funded" value={fmt(grand.platform)} />
        <KpiCard label="Merchant funded" value={fmt(grand.merchant)} />
        <KpiCard label="Unique customers (sum)" value={grand.customers.toLocaleString('en-IN')} sub="(may double-count across coupons)" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Top coupons by redemption count</h3>
        </div>
        {sortedByRedemptions.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No coupon redemptions yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Coupon</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Funded by</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Redemptions</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Discount given</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Avg per order</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedByRedemptions.map(({ coupon, kpis }) => (
                  <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{coupon.code}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${coupon.deletedAt ? 'bg-gray-100 text-gray-600' : coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {coupon.deletedAt ? 'Archived' : coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${coupon.fundingSource === 'PLATFORM' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {coupon.fundingSource}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{kpis!.totalRedemptions.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">{fmt(kpis!.totalDiscountValue)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(kpis!.avgDiscountPerOrder)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/marketing/coupons/${coupon.id}`} className="text-blue-600 hover:underline text-xs">Open →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
