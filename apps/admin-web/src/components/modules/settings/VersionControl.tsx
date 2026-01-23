import { useState } from 'react';
import { 
  Smartphone, 
  Store, 
  AlertTriangle,
  Save,
  Power
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Label } from '../../ui/label';
import { Separator } from '../../ui/separator';
import { toast } from 'sonner';
import { Badge } from '../../ui/badge';

export function VersionControl() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleSave = (section: string) => {
    toast.success(`${section} Updated`, {
      description: 'New version configurations have been pushed.'
    });
  };

  const handleMaintenanceToggle = (checked: boolean) => {
    setMaintenanceMode(checked);
    if (checked) {
      toast.error('System Maintenance Enabled', {
        description: 'All apps are now showing the maintenance screen.',
        duration: 5000
      });
    } else {
      toast.success('System Online', {
        description: 'Maintenance mode disabled. Apps are now live.'
      });
    }
  };

  return (
    <div className="h-full space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">App Version & Control</h2>
          <p className="text-sm text-gray-500">Manage app updates and system availability.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Consumer App Config */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Consumer App Config</CardTitle>
                <CardDescription>iOS & Android (User Facing)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Version</Label>
                <Input defaultValue="1.2.0" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Min Force Update</Label>
                <Input defaultValue="1.1.5" className="font-mono" />
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show 'Update Required'</Label>
                <p className="text-xs text-gray-500">Block usage below min version</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSave('Consumer App')}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Merchant App Config */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Store className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base">Merchant App Config</CardTitle>
                <CardDescription>Partner Dashboard App</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Version</Label>
                <Input defaultValue="2.4.1" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Min Force Update</Label>
                <Input defaultValue="2.3.0" className="font-mono" />
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show 'Update Required'</Label>
                <p className="text-xs text-gray-500">Block usage below min version</p>
              </div>
              <Switch defaultChecked />
            </div>

            <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleSave('Merchant App')}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-red-900">System Maintenance Mode</CardTitle>
              <CardDescription className="text-red-700/80">
                Critical control switch for emergency downtime.
              </CardDescription>
            </div>
            <div className="ml-auto">
               {maintenanceMode && (
                 <Badge variant="destructive" className="animate-pulse bg-red-600">ACTIVE</Badge>
               )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-100 shadow-sm">
            <div className="space-y-1">
              <Label className="text-base font-semibold text-gray-900 flex items-center gap-2">
                Enable Maintenance Mode
              </Label>
              <p className="text-sm text-gray-500 max-w-lg">
                When enabled, all consumer and merchant apps will display a "Under Maintenance" screen. 
                APIs will reject non-admin requests. Use with caution.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-red-600 uppercase tracking-wider">
                {maintenanceMode ? 'ENABLED' : 'DISABLED'}
              </span>
              <Switch 
                checked={maintenanceMode}
                onCheckedChange={handleMaintenanceToggle}
                className="data-[state=checked]:bg-red-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
