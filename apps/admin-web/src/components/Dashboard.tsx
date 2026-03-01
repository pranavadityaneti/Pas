import { Construction } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="p-6 bg-gray-100 rounded-full animate-pulse">
        <Construction className="w-16 h-16 text-gray-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard under analysis and development</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          We are currently rebuilding the dashboard to provide better insights and metrics. Please check back later.
        </p>
      </div>
    </div>
  );
}
