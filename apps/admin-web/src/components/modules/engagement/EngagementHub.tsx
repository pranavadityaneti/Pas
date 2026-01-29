import { useState } from 'react';
import { NotificationManager } from './NotificationManager';
import { AdManager } from './AdManager';
import { Bell, Megaphone, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

export function EngagementHub() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'ads'>('notifications');

  return (
    <div className="h-full flex flex-col bg-gray-50 px-6 pt-10 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Engagement & Revenue</h1>
            <p className="text-sm text-gray-500 font-medium">Manage push campaigns and sponsored ad slots.</p>
          </div>
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'notifications'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-violet-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell className="w-4 h-4" />
            Push Campaigns
          </Button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-lg transition-all",
              activeTab === 'ads'
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-md"
                : "text-gray-600 hover:text-violet-600 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('ads')}
          >
            <Megaphone className="w-4 h-4" />
            Sponsored Ads
          </Button>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'notifications' && <NotificationManager />}
          {activeTab === 'ads' && <AdManager />}
        </div>
      </div>
    </div>
  );
}