import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { TeamManagement } from './TeamManagement';
import { VersionControl } from './VersionControl';
import { Users, Cog } from 'lucide-react';

export function SettingsHub() {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings & Control</h1>
          <p className="text-sm text-gray-500">Configure access, app versions, and system status.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <Tabs defaultValue="team" className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-gray-100">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="team" className="gap-2">
                <Users className="w-4 h-4" />
                Team & RBAC
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-2">
                <Cog className="w-4 h-4" />
                App Control
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-0">
            <TabsContent value="team" className="h-full m-0 p-6 overflow-auto">
              <TeamManagement />
            </TabsContent>
            <TabsContent value="system" className="h-full m-0 p-6 overflow-auto">
              <VersionControl />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
