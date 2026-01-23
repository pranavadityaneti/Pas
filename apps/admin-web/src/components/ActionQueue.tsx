import { AlertCircle, AlertTriangle, Flag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const actions = [
  {
    id: 1,
    title: '3 Pending KYC Requests',
    description: 'New merchant verifications waiting',
    priority: 'critical',
    icon: AlertCircle,
  },
  {
    id: 2,
    title: '5 Price Disputes',
    description: 'Customer complaints on pricing',
    priority: 'high',
    icon: AlertTriangle,
  },
  {
    id: 3,
    title: '2 Flagged Transactions',
    description: 'Suspicious payment activity detected',
    priority: 'critical',
    icon: Flag,
  },
  {
    id: 4,
    title: '7 Product Approvals',
    description: 'New items pending catalog approval',
    priority: 'medium',
    icon: AlertCircle,
  },
  {
    id: 5,
    title: '1 Store Offline > 2hrs',
    description: 'Store L - Tech Hub unresponsive',
    priority: 'high',
    icon: AlertTriangle,
  },
];

export function ActionQueue() {
  const handleActionClick = (title: string) => {
    toast(`Opening Action: ${title}`, {
      description: "Redirecting to detailed workflow view..."
    });
  };

  const handleViewAll = () => {
    toast.info("Loading Task Manager", {
      description: "Fetching full list of 18 pending actions..."
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-[500px] flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Requires Attention</h2>
        <p className="text-sm text-gray-600">{actions.length} pending actions</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const priorityColors = {
            critical: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-50',
            high: 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-50',
            medium: 'bg-yellow-100 text-yellow-600 border-yellow-200 hover:bg-yellow-50',
          };

          return (
            <div
              key={action.id}
              onClick={() => handleActionClick(action.title)}
              className={`p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${
                priorityColors[action.priority as keyof typeof priorityColors]
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm mb-1">
                    {action.title}
                  </p>
                  <p className="text-xs text-gray-600">
                    {action.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={handleViewAll}
        className="mt-4 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium active:bg-blue-100"
      >
        View All Tasks
      </button>
    </div>
  );
}
