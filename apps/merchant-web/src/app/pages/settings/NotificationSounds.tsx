import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2, Bell, Smartphone } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export default function NotificationSounds() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    newOrder: true,
    payment: true,
    vibration: true,
    volume: 80
  });

  return (
    <div className="flex flex-col min-h-screen bg-white text-black pb-24">
      <div className="sticky top-0 bg-white z-10 px-4 py-4 shadow-sm border-b border-gray-100 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Sounds & Alerts</h1>
      </div>

      <div className="p-5 flex-1 space-y-8">
        
        {/* Volume Slider */}
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
                <Volume2 className="text-gray-900" size={24} />
                <h3 className="font-bold text-gray-900">Master Volume</h3>
            </div>
            <input 
                type="range" 
                min="0" 
                max="100" 
                value={settings.volume} 
                onChange={(e) => setSettings({...settings, volume: parseInt(e.target.value)})}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <div className="flex justify-between mt-2 text-xs font-bold text-gray-500 uppercase">
                <span>Mute</span>
                <span>{settings.volume}%</span>
            </div>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
            <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <Bell size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">New Order Alert</p>
                        <p className="text-xs text-gray-500">Loud ringtone for incoming orders</p>
                    </div>
                </div>
                <button 
                    onClick={() => setSettings({...settings, newOrder: !settings.newOrder})}
                    className={clsx(
                        "w-12 h-7 rounded-full transition-colors relative",
                        settings.newOrder ? "bg-green-500" : "bg-gray-200"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all",
                        settings.newOrder ? "left-6" : "left-1"
                    )} />
                </button>
            </div>

            <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <Volume2 size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Payment Success</p>
                        <p className="text-xs text-gray-500">"Cha-ching" sound on payment</p>
                    </div>
                </div>
                <button 
                    onClick={() => setSettings({...settings, payment: !settings.payment})}
                    className={clsx(
                        "w-12 h-7 rounded-full transition-colors relative",
                        settings.payment ? "bg-green-500" : "bg-gray-200"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all",
                        settings.payment ? "left-6" : "left-1"
                    )} />
                </button>
            </div>

            <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                        <Smartphone size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Vibration</p>
                        <p className="text-xs text-gray-500">Vibrate on new notifications</p>
                    </div>
                </div>
                <button 
                    onClick={() => setSettings({...settings, vibration: !settings.vibration})}
                    className={clsx(
                        "w-12 h-7 rounded-full transition-colors relative",
                        settings.vibration ? "bg-green-500" : "bg-gray-200"
                    )}
                >
                    <div className={clsx(
                        "w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all",
                        settings.vibration ? "left-6" : "left-1"
                    )} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}