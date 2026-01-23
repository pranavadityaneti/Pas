import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const stores = [
  { id: 1, name: 'Store A - Electronics Hub', status: 'active', x: 25, y: 30 },
  { id: 2, name: 'Store B - Fresh Groceries', status: 'active', x: 60, y: 45 },
  { id: 3, name: 'Store C - Fashion Central', status: 'active', x: 45, y: 60 },
  { id: 4, name: 'Store D - Home Essentials', status: 'offline', x: 70, y: 25 },
  { id: 5, name: 'Store E - Pharmacy Plus', status: 'active', x: 35, y: 75 },
  { id: 6, name: 'Store F - Books & More', status: 'active', x: 80, y: 55 },
  { id: 7, name: 'Store G - Sports Corner', status: 'active', x: 15, y: 50 },
  { id: 8, name: 'Store H - Pet Supplies', status: 'active', x: 55, y: 35 },
  { id: 9, name: 'Store I - Beauty Bar', status: 'active', x: 40, y: 20 },
  { id: 10, name: 'Store J - Tech Gadgets', status: 'active', x: 65, y: 70 },
  { id: 11, name: 'Store K - Organic Market', status: 'active', x: 30, y: 55 },
  { id: 12, name: 'Store L - Quick Mart', status: 'active', x: 75, y: 40 },
  { id: 13, name: 'Store M - Bakery Bliss', status: 'offline', x: 50, y: 80 },
  { id: 14, name: 'Store N - Toy World', status: 'offline', x: 20, y: 65 },
  { id: 15, name: 'Store O - Auto Parts', status: 'active', x: 85, y: 30 },
];

export function LiveMap() {
  const [activeStoresCount] = useState(stores.filter(s => s.status === 'active').length);
  const [isResetting, setIsResetting] = useState(false);
  
  const handleCenterView = () => {
    setIsResetting(true);
    toast.success("Map View Reset", {
      description: "Recalibrated to city center coordinates (12.9716° N, 77.5946° E)"
    });
    setTimeout(() => setIsResetting(false), 500);
  };

  const handleStoreClick = (storeName: string, status: string) => {
    if (status === 'offline') {
      toast.error(`${storeName} is Offline`, {
        description: "Last ping: 2 hours ago. Check connectivity."
      });
    } else {
      toast.success(storeName, {
        description: "Status: Online. 15 active orders in queue."
      });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Live Operations Map</h2>
          <p className="text-sm text-gray-600">
            {activeStoresCount} Active / {stores.length} Total Stores
          </p>
        </div>
        <button 
          onClick={handleCenterView}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors active:scale-95 duration-150"
        >
          <Navigation className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
          Center View
        </button>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg relative overflow-hidden border border-gray-200 group">
        {/* Grid background */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}></div>

        {/* Store Pins */}
        {stores.map((store) => (
          <div
            key={store.id}
            onClick={() => handleStoreClick(store.name, store.status)}
            className="absolute cursor-pointer hover:z-20 transition-transform hover:scale-110"
            style={{
              left: `${store.x}%`,
              top: `${store.y}%`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className={`relative ${
              store.status === 'active' ? 'animate-bounce' : ''
            }`}>
              <MapPin
                className={`w-8 h-8 drop-shadow-md ${
                  store.status === 'active' 
                    ? 'text-green-500 fill-green-100' 
                    : 'text-gray-400 fill-gray-100'
                }`}
              />
              {store.status === 'active' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
              )}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 transition-opacity z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
                {store.name}
                <div className={`text-xs ${
                  store.status === 'active' ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {store.status === 'active' ? '● Online' : '○ Offline'}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-lg p-3 shadow-lg border border-gray-100">
          <div className="text-xs font-medium text-gray-700 mb-2">Status</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500 fill-green-100" />
              <span className="text-xs text-gray-600">Active Store</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400 fill-gray-100" />
              <span className="text-xs text-gray-600">Offline Store</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
