import { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
  trendValue?: string;
  showGraph?: boolean;
  showPulse?: boolean;
  subtext?: string;
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  showGraph, 
  showPulse,
  subtext 
}: KPICardProps) {
  const handleClick = () => {
    toast.info(`Metric: ${title}`, {
      description: `Current Value: ${value}. Detailed analytics view coming in Phase 2.`
    });
  };

  return (
    <div 
      onClick={handleClick}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer active:scale-95 duration-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            showPulse ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            <Icon className={`w-5 h-5 ${
              showPulse ? 'text-green-600' : 'text-blue-600'
            }`} />
          </div>
          {showPulse && (
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
            </div>
          )}
        </div>
        {trend && trendValue && (
          <span className={`text-sm font-medium ${
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trendValue}
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      
      {subtext && (
        <p className="text-xs text-gray-500">{subtext}</p>
      )}
      
      {showGraph && (
        <div className="mt-4 h-12">
          <svg className="w-full h-full" viewBox="0 0 200 50" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              points="0,40 20,35 40,30 60,28 80,25 100,20 120,18 140,15 160,12 180,10 200,8"
            />
            <polyline
              fill="url(#gradient)"
              stroke="none"
              points="0,40 20,35 40,30 60,28 80,25 100,20 120,18 140,15 160,12 180,10 200,8 200,50 0,50"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
}
