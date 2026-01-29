import { useState } from 'react';
import { SettlementsManager } from './SettlementsManager';
import { InvoiceRepository } from './InvoiceRepository';
import { BadgeIndianRupee, ReceiptText, Wallet } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

export function FinanceHub() {
  const [activeTab, setActiveTab] = useState<'settlements' | 'invoices'>('settlements');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance & Settlements</h1>
            <p className="text-sm text-gray-500 font-medium">Manage merchant payouts and tax compliance.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'settlements'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-amber-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('settlements')}
          >
            <BadgeIndianRupee className="w-4 h-4" />
            Settlements
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'invoices'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-amber-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('invoices')}
          >
            <ReceiptText className="w-4 h-4" />
            Tax Invoices
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {activeTab === 'settlements' && <SettlementsManager />}
          {activeTab === 'invoices' && <div className="p-6 overflow-auto h-full"><InvoiceRepository /></div>}
        </div>
      </div>
    </div>
  );
}
