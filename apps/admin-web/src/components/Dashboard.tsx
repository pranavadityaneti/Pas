import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { KPICard } from './KPICard';
import { PlatformCharts } from './PlatformCharts';
import { TopStoresList } from './TopStoresList';
import { DollarSign, ShoppingBag, Users, Store as StoreIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.rpc('get_super_admin_stats');
        
        if (error) {
          throw error;
        }
        
        setStats(data);
      } catch (err: any) {
        console.error('Error fetching dashboard stats:', err);
        toast.error('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 bg-primary/10 rounded-full animate-pulse">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <p className="text-gray-500 font-medium">Loading platform analytics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center">
        <p className="font-semibold text-lg">Failed to load statistics</p>
        <p className="text-sm mt-1">Please try refreshing the page or check your connection.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 slide-in-from-bottom-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Platform Analytics</h1>
        <p className="text-gray-500 mt-1">Holistic view of the PickAtStore ecosystem.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total GMV"
          value={`₹${stats.totalGmv.toLocaleString()}`}
          icon={DollarSign}
          showGraph
        />
        <KPICard
          title="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          icon={ShoppingBag}
        />
        <KPICard
          title="Active Consumers"
          value={stats.activeCustomers.toLocaleString()}
          icon={Users}
          showPulse
        />
        <KPICard
          title="Total Merchants"
          value={stats.totalMerchants.toLocaleString()}
          icon={StoreIcon}
        />
      </div>

      <PlatformCharts 
        dailyStats={stats.dailyStats} 
        statusBreakdown={stats.statusBreakdown} 
      />

      {/* "More Insights Coming" placeholder removed 2026-06-02. Top stores takes the full row. */}
      <TopStoresList stores={stats.topStores} />
    </div>
  );
}
