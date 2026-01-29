import { useState } from 'react';
import { MerchantDirectory } from './MerchantDirectory';
import { KYCQueue } from './KYCQueue';
import { Store, ShieldCheck, Building2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

export function MerchantNetwork() {
  const [activeTab, setActiveTab] = useState<'directory' | 'kyc'>('directory');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Merchant Network</h1>
            <p className="text-sm text-gray-500 font-medium">Manage store partners and verify new applications.</p>
          </div>
        </div>

        {/* Right Actions Toolbar - Same style as Master Catalog */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'directory'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('directory')}
          >
            <Store className="w-4 h-4" />
            Directory
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'kyc'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-emerald-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('kyc')}
          >
            <ShieldCheck className="w-4 h-4" />
            KYC Queue
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'directory' && <MerchantDirectory />}
          {activeTab === 'kyc' && <KYCQueue />}
        </div>
      </div>
    </div>
  );
}
