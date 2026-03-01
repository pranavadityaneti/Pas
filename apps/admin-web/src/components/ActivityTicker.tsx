import { useEffect, useState } from 'react';
import { CheckCircle, UserPlus, ShoppingBag, Store, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
  id: number;
  type: 'order' | 'signup' | 'cancel' | 'store';
  message: string;
  timestamp: string;
  icon: typeof CheckCircle;
}

const initialActivities: Activity[] = [
  {
    id: 1,
    type: 'order',
    message: 'Store A accepted Order #1245',
    timestamp: '2 min ago',
    icon: CheckCircle,
  },
  {
    id: 2,
    type: 'signup',
    message: 'User Rahul Kumar signed up',
    timestamp: '3 min ago',
    icon: UserPlus,
  },
  {
    id: 3,
    type: 'order',
    message: 'Order #1246 placed - ₹850',
    timestamp: '5 min ago',
    icon: ShoppingBag,
  },
  {
    id: 4,
    type: 'store',
    message: 'Store F went online',
    timestamp: '7 min ago',
    icon: Store,
  },
  {
    id: 5,
    type: 'cancel',
    message: 'Order #1240 cancelled by customer',
    timestamp: '10 min ago',
    icon: XCircle,
  },
  {
    id: 6,
    type: 'order',
    message: 'Store C accepted Order #1247',
    timestamp: '12 min ago',
    icon: CheckCircle,
  },
  {
    id: 7,
    type: 'signup',
    message: 'User Priya Sharma signed up',
    timestamp: '15 min ago',
    icon: UserPlus,
  },
  {
    id: 8,
    type: 'order',
    message: 'Order #1248 placed - ₹1,250',
    timestamp: '18 min ago',
    icon: ShoppingBag,
  },
];

export function ActivityTicker() {
  const [activities, setActivities] = useState(initialActivities);

  useEffect(() => {
    const interval = setInterval(() => {
      const newActivity: Activity = {
        id: Date.now(),
        type: ['order', 'signup', 'store'][Math.floor(Math.random() * 3)] as 'order' | 'signup' | 'store',
        message: `New activity at ${new Date().toLocaleTimeString()}`,
        timestamp: 'Just now',
        icon: CheckCircle,
      };
      
      setActivities((prev) => [newActivity, ...prev].slice(0, 8));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleActivityClick = (message: string) => {
    toast("Activity Details", {
      description: message
    });
  };

  const typeColors = {
    order: 'bg-green-100 text-green-600',
    signup: 'bg-blue-100 text-blue-600',
    cancel: 'bg-red-100 text-red-600',
    store: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Real-Time Activity Ticker</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-600">Live</span>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div
              key={activity.id}
              onClick={() => handleActivityClick(activity.message)}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              style={{
                animation: index === 0 ? 'fadeIn 0.5s ease-in' : 'none'
              }}
            >
              <div className={`p-2 rounded-lg ${typeColors[activity.type]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500 mt-0.5">{activity.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
