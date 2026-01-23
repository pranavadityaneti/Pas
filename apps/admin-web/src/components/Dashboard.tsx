import { KPICard } from './KPICard';
import { LiveMap } from './LiveMap';
import { ActionQueue } from './ActionQueue';
import { ActivityTicker } from './ActivityTicker';
import { OrdersChart } from './OrdersChart';
import { TrendingUp, ShoppingCart, CheckCircle, Store } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="h-full overflow-y-auto p-8 space-y-6 max-w-[1440px] mx-auto">
      {/* Top Row: KPI Cards */}
      <div className="grid grid-cols-4 gap-6">
        <KPICard
          title="Total GMV (Today)"
          value="₹1,45,000"
          icon={TrendingUp}
          trend="up"
          trendValue="+12.5%"
          showGraph
        />
        <KPICard
          title="Active Orders"
          value="42"
          icon={ShoppingCart}
          showPulse
        />
        <KPICard
          title="Fill Rate"
          value="98.5%"
          icon={CheckCircle}
          subtext="1.5% Cancelled"
        />
        <KPICard
          title="Active Stores"
          value="12/15 Online"
          icon={Store}
        />
      </div>

      {/* Middle Row: Live Map & Action Queue */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <LiveMap />
        </div>
        <div>
          <ActionQueue />
        </div>
      </div>

      {/* Bottom Row: Activity Ticker & Charts */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ActivityTicker />
        </div>
        <div>
          <OrdersChart />
        </div>
      </div>
    </div>
  );
}
