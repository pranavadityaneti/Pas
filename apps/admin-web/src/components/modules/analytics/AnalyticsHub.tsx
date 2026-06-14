import { useState } from 'react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AuditLog } from './AuditLog';
import { GlobalConfig } from './GlobalConfig';
import { BarChart3, ShieldAlert, LineChart, Settings } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

/**
 * Global Config tab hidden 2026-06-03. The GlobalConfig.tsx form was 100%
 * mock UI — hardcoded defaultValues for COD limits / fees / referral bonuses
 * with a Save button that only showed a toast, no backend persistence.
 * Re-introduce once a `platform_settings` table + GET/PATCH routes exist
 * AND the values are actually consumed by the consumer/merchant apps.
 */

export function AnalyticsHub() {
  const [activeTab, setActiveTab] = useState<'reports' | 'audit' | 'config'>('reports');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 2026-06-03: replaced cyan→blue decorative gradient with solid brand red. */}
          <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-lg">
            <LineChart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Intelligence & Control</h1>
            <p className="text-sm text-gray-500 font-medium">Platform analytics, global configuration, and security logs.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'reports'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-[#B52725] hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 className="w-4 h-4" />
            Reports
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'audit'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-[#B52725] hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('audit')}
          >
            <ShieldAlert className="w-4 h-4" />
            Audit Logs
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'config'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-[#B52725] hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('config')}
          >
            <Settings className="w-4 h-4" />
            Config
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'reports' && <AnalyticsDashboard />}
          {activeTab === 'audit'   && <AuditLog />}
          {activeTab === 'config'  && <GlobalConfig />}
        </div>
      </div>
    </div>
  );
}