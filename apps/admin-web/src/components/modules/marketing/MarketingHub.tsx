import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { CouponBuilder } from './CouponBuilder';
import { BannerManager } from './BannerManager';
import { Ticket, ImageIcon } from 'lucide-react';

export function MarketingHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand & Growth</h1>
          <p className="text-sm text-gray-500">Create promotions and manage app visuals.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="coupons" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="coupons" className="gap-2">
                <Ticket className="w-4 h-4" />
                Coupon Builder
              </TabsTrigger>
              <TabsTrigger value="banners" className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Banner Manager
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="coupons" className="h-full m-0 p-6 overflow-hidden">
              <CouponBuilder />
            </TabsContent>
            <TabsContent value="banners" className="h-full m-0 p-6 overflow-auto">
              <BannerManager />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
