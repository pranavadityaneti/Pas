import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { SettlementsManager } from './SettlementsManager';
import { InvoiceRepository } from './InvoiceRepository';
import { BadgeIndianRupee, ReceiptText } from 'lucide-react';

export function FinanceHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance & Settlements</h1>
          <p className="text-sm text-gray-500">Manage merchant payouts and tax compliance.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="settlements" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="settlements" className="gap-2">
                <BadgeIndianRupee className="w-4 h-4" />
                Settlements
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <ReceiptText className="w-4 h-4" />
                Tax Invoices
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="settlements" className="h-full m-0 overflow-hidden">
              <SettlementsManager />
            </TabsContent>
            <TabsContent value="invoices" className="h-full m-0 p-6 overflow-hidden">
              <InvoiceRepository />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
