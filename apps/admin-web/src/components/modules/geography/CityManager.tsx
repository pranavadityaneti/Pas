import { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Hand,
  PenTool,
  Search,
  Store,
  Settings2,
  Loader2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { ScrollArea } from '../../ui/scroll-area';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import { toast } from 'sonner';
import api from '@/lib/api';

interface City {
  id: string;
  name: string;
  active: boolean;
  stores: number;
  commission?: number; // Not in DB yet, using default
}

export function CityManager() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [activeTool, setActiveTool] = useState<'hand' | 'draw' | null>('hand');

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const response = await api.get('/cities');
      const data = response.data.map((c: any) => ({
        ...c,
        status: c.active ? 'active' : 'inactive',
        commission: 10 // Mock default until schema update
      }));
      setCities(data);
      if (data.length > 0) setSelectedCity(data[0]);
    } catch (error) {
      console.error('Failed to fetch cities', error);
      toast.error('Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#B52725]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">City & Zone Manager</h1>
          <p className="text-sm text-gray-500">Define service areas and configure regional settings.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex overflow-hidden">
        {/* Left Sidebar: City List */}
        <div className="w-[320px] border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Serviceable Cities</h3>
              <Button size="sm" className="h-8 gap-1 bg-[#121212] hover:bg-[#2d2d2d]">
                <Plus className="w-3.5 h-3.5" /> Add City
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <Input placeholder="Search city..." className="pl-9 h-9 text-sm" />
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {cities.map((city) => (
                <div
                  key={city.id}
                  onClick={() => setSelectedCity(city)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedCity?.id === city.id
                    ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-semibold ${selectedCity?.id === city.id ? 'text-blue-700' : 'text-gray-900'}`}>
                      {city.name}
                    </h4>
                    <Badge variant="secondary" className={city.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {city.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Store className="w-3 h-3" /> {city.stores} Stores
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: The Map */}
        <div className="flex-1 relative bg-gray-100 overflow-hidden group">
          {/* Map Image Background */}
          <div className="absolute inset-0 z-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1624209358861-4b0e0cf90692?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
              alt="Map View"
              className="w-full h-full object-cover opacity-80"
            />
          </div>

          {/* Polygon Overlay (Simulated Zone) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points="30,30 60,25 70,50 40,60"
                className="fill-blue-500/20 stroke-blue-600 stroke-2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Zone Label */}
              <foreignObject x="45" y="40" width="20" height="10">
                <div className="bg-white/90 px-2 py-1 rounded text-[10px] font-bold text-blue-800 text-center shadow-sm border border-blue-200">
                  Zone A: Core
                </div>
              </foreignObject>
            </svg>
          </div>

          {/* Floating Toolbar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg border border-gray-200 p-1.5 flex items-center gap-1 z-10">
            <Button
              variant={activeTool === 'hand' ? 'default' : 'ghost'}
              size="icon"
              className={`h-9 w-9 rounded-full ${activeTool === 'hand' ? 'bg-gray-900 text-white hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setActiveTool('hand')}
              title="Pan Map"
            >
              <Hand className="w-4 h-4" />
            </Button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <Button
              variant={activeTool === 'draw' ? 'default' : 'ghost'}
              size="icon"
              className={`h-9 w-9 rounded-full ${activeTool === 'draw' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
              onClick={() => setActiveTool('draw')}
              title="Draw Polygon Zone"
            >
              <PenTool className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-gray-500 hover:bg-gray-100"
              onClick={() => toast.info("Upload CSV containing pincodes")}
              title="Upload Pincodes"
            >
              <Upload className="w-4 h-4" />
            </Button>
          </div>

          {selectedCity && (
            <div className="absolute bottom-6 left-6 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-10 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-gray-500" />
                <h4 className="font-bold text-gray-900">{selectedCity.name} Settings</h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Discovery Radius</Label>
                    <p className="text-[10px] text-gray-500">Limit store visibility distance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Unlimited</span>
                    <Switch checked={true} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Base Commission Rate</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      defaultValue={selectedCity.commission || 10}
                      className="pr-8 text-right font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                  </div>
                </div>

                <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white h-8 text-xs">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
