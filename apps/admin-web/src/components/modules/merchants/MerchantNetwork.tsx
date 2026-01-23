import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { MerchantDirectory } from './MerchantDirectory';
import { KYCQueue } from './KYCQueue';
import { Store, ShieldCheck } from 'lucide-react';

export function MerchantNetwork() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merchant Network</h1>
          <p className="text-sm text-gray-500">Manage store partners and verify new applications.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="directory" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="directory" className="gap-2">
                <Store className="w-4 h-4" />
                Directory
              </TabsTrigger>
              <TabsTrigger value="kyc" className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                KYC Queue
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="directory" className="h-full m-0 p-6 overflow-auto">
              <MerchantDirectory />
            </TabsContent>
            <TabsContent value="kyc" className="h-full m-0 p-6 overflow-hidden">
              <KYCQueue />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
