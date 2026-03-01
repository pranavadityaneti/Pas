import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import Layout from './Layout';
import { Dashboard } from './components/Dashboard';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { ForcePasswordChange } from './components/ForcePasswordChange';

// Modules
import { OrderManager } from './components/modules/orders/OrderManager';
import { MerchantNetwork } from './components/modules/merchants/MerchantNetwork';
import { MasterCatalog } from './components/modules/catalog/MasterCatalog';
import { CustomerDatabase } from './components/modules/customers/CustomerDatabase';
import { MarketingHub } from './components/modules/marketing/MarketingHub';
import { EngagementHub } from './components/modules/engagement/EngagementHub';
import { CityManager } from './components/modules/geography/CityManager';
import { FinanceHub } from './components/modules/finance/FinanceHub';
import { AnalyticsHub } from './components/modules/analytics/AnalyticsHub';
import { SettingsHub } from './components/modules/settings/SettingsHub';

export default function App() {
  const { isAuthenticated, loading, mustChangePassword, clearPasswordChangeFlag } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#B52725]" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Force password change for new admins
  if (mustChangePassword) {
    return <ForcePasswordChange onComplete={clearPasswordChangeFlag} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<MasterCatalog />} />
        <Route path="merchants" element={<MerchantNetwork />} />
        <Route path="orders" element={<OrderManager />} />
        <Route path="customers" element={<CustomerDatabase />} />
        <Route path="marketing" element={<MarketingHub />} />
        <Route path="engagement" element={<EngagementHub />} />
        <Route path="geography" element={<CityManager />} />
        <Route path="finance" element={<FinanceHub />} />
        <Route path="analytics" element={<AnalyticsHub />} />
        <Route path="settings" element={<SettingsHub />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
