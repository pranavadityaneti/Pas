import { CouponBuilder } from './CouponBuilder';
import { TrendingUp } from 'lucide-react';

// Banner Manager removed 2026-06-02 — not shipping in the June 6 build.
// File apps/admin-web/src/components/modules/marketing/BannerManager.tsx kept on disk
// (dead code, no importers) so we can revive it post-launch if needed.

export function MarketingHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header — brand red */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand & Growth</h1>
          <p className="text-sm text-gray-500 font-medium">Create promotions and reach customers.</p>
        </div>
      </div>

      {/* Coupon Builder (only Marketing surface for this build) */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <CouponBuilder />
        </div>
      </div>
    </div>
  );
}
