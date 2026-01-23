import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { NotificationManager } from './NotificationManager';
import { AdManager } from './AdManager';
import { Bell, Megaphone } from 'lucide-react';

export function EngagementHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engagement & Revenue</h1>
          <p className="text-sm text-gray-500">Manage push campaigns and sponsored ad slots.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="notifications" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                Push Campaigns
              </TabsTrigger>
              <TabsTrigger value="ads" className="gap-2">
                <Megaphone className="w-4 h-4" />
                Sponsored Ads
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="notifications" className="h-full m-0 p-6 overflow-hidden">
              <NotificationManager />
            </TabsContent>
            <TabsContent value="ads" className="h-full m-0 p-6 overflow-hidden">
              <AdManager />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}