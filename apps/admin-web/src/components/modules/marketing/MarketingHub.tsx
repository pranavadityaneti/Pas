import { useState } from 'react';
import { CouponBuilder } from './CouponBuilder';
import { BannerManager } from './BannerManager';
import { Ticket, ImageIcon, TrendingUp } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

export function MarketingHub() {
  const [activeTab, setActiveTab] = useState<'coupons' | 'banners'>('coupons');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demand & Growth</h1>
            <p className="text-sm text-gray-500 font-medium">Create promotions and manage app visuals.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'coupons'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-rose-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('coupons')}
          >
            <Ticket className="w-4 h-4" />
            Coupon Builder
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'banners'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-rose-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('banners')}
          >
            <ImageIcon className="w-4 h-4" />
            Banner Manager
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'coupons' && <CouponBuilder />}
          {activeTab === 'banners' && <BannerManager />}
        </div>
      </div>
    </div>
  );
}
