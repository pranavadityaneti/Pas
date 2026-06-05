import { CouponBuilder } from './CouponBuilder';
import { MerchantSignupCoupons } from './MerchantSignupCoupons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { TrendingUp, Tag, Ticket } from 'lucide-react';

// 2026-06-02 — Banner Manager removed; not shipping in the June 6 build.
// File apps/admin-web/src/components/modules/marketing/BannerManager.tsx kept
// on disk (dead code, no importers) so we can revive it post-launch.
//
// 2026-06-04 (Phase 2.E2) — added Merchant Signup Coupons tab. Two coupon
// systems live here side-by-side because they're separate concerns:
//   - Consumer coupons (CouponBuilder)        → consumer-app checkout
//   - Merchant signup coupons (MerchantSignupCoupons) → merchant-app subscription step

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
          <p className="text-sm text-gray-500 font-medium">Create promotions and reach customers + partners.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="consumer" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-gray-200 px-6 pt-4">
            <TabsList>
              <TabsTrigger value="consumer" className="gap-2">
                <Ticket className="w-4 h-4" />
                Consumer Coupons
              </TabsTrigger>
              <TabsTrigger value="merchant-signup" className="gap-2">
                <Tag className="w-4 h-4" />
                Merchant Signup Coupons
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="consumer" className="flex-1 overflow-auto p-6 m-0">
            <CouponBuilder />
          </TabsContent>

          <TabsContent value="merchant-signup" className="flex-1 overflow-auto p-6 m-0">
            <MerchantSignupCoupons />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
