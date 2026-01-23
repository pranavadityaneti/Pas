import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Login } from './components/Login';
import Layout from './Layout';
import { Dashboard } from './components/Dashboard';

// Modules
import { OrderManager } from './components/modules/orders/OrderManager';
import { MerchantNetwork } from './components/modules/merchants/MerchantNetwork';
import { MasterCatalog } from './components/modules/catalog/MasterCatalog';
import { ConsumerDatabase } from './components/modules/consumers/ConsumerDatabase';
import { MarketingHub } from './components/modules/marketing/MarketingHub';
import { EngagementHub } from './components/modules/engagement/EngagementHub';
import { CityManager } from './components/modules/geography/CityManager';
import { FinanceHub } from './components/modules/finance/FinanceHub';
import { AnalyticsHub } from './components/modules/analytics/AnalyticsHub';
import { SettingsHub } from './components/modules/settings/SettingsHub';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<MasterCatalog />} />
        <Route path="merchants" element={<MerchantNetwork />} />
        <Route path="orders" element={<OrderManager />} />
        <Route path="consumers" element={<ConsumerDatabase />} />
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
