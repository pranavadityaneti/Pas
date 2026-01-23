import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { GlobalConfig } from './GlobalConfig';
import { AuditLog } from './AuditLog';
import { BarChart3, Settings2, ShieldAlert } from 'lucide-react';

export function AnalyticsHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intelligence & Control</h1>
          <p className="text-sm text-gray-500">Platform analytics, global configuration, and security logs.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="reports" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[600px] grid-cols-3">
              <TabsTrigger value="reports" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Global Config
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <ShieldAlert className="w-4 h-4" />
                Audit Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="reports" className="h-full m-0 p-6 overflow-hidden">
              <AnalyticsDashboard />
            </TabsContent>
            <TabsContent value="config" className="h-full m-0 p-6 overflow-auto">
              <GlobalConfig />
            </TabsContent>
            <TabsContent value="audit" className="h-full m-0 p-6 overflow-hidden">
              <AuditLog />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}