import { useState } from 'react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { GlobalConfig } from './GlobalConfig';
import { AuditLog } from './AuditLog';
import { BarChart3, Settings2, ShieldAlert, LineChart } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

export function AnalyticsHub() {
  const [activeTab, setActiveTab] = useState<'reports' | 'config' | 'audit'>('reports');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
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
                : "text-gray-600 hover:text-cyan-600 hover:bg-gray-50"
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
              activeTab === 'config'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-cyan-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('config')}
          >
            <Settings2 className="w-4 h-4" />
            Global Config
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'audit'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-cyan-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('audit')}
          >
            <ShieldAlert className="w-4 h-4" />
            Audit Logs
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'reports' && <AnalyticsDashboard />}
          {activeTab === 'config' && <GlobalConfig />}
          {activeTab === 'audit' && <AuditLog />}
        </div>
      </div>
    </div>
  );
}