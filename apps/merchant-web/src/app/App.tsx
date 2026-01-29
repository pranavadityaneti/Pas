import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';

import Layout from '@/app/components/Layout';
import Login from '@/app/pages/Login';
import Signup from '@/app/pages/Signup';
import Dashboard from '@/app/pages/Dashboard';
import Orders from '@/app/pages/Orders';
import Inventory from '@/app/pages/Inventory';
import AddProducts from '@/app/pages/AddProducts';
import Settings from '@/app/pages/Settings';
import OrderDetail from '@/app/pages/OrderDetail';
import Earnings from '@/app/pages/Earnings';
import EarningsDetail from '@/app/pages/EarningsDetail';
import StoreTimings from '@/app/pages/settings/StoreTimings';
import PrinterSettings from '@/app/pages/settings/PrinterSettings';
import StaffManagement from '@/app/pages/settings/StaffManagement';
import Payouts from '@/app/pages/settings/Payouts';
import NotificationSounds from '@/app/pages/settings/NotificationSounds';
import HelpSupport from '@/app/pages/settings/HelpSupport';
import AboutLegal from '@/app/pages/settings/AboutLegal';
import { StoreProvider } from '@/app/context/StoreContext';
import { CatalogProvider } from '@/app/context/CatalogContext';

export default function App() {
  return (
    <StoreProvider>
      <CatalogProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative">
              <Routes>
                {/* Public Routes - No Bottom Nav */}
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected Routes - With Layout (Bottom Nav) */}
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/order/:id" element={<OrderDetail />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/inventory/add-products" element={<AddProducts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/store-timings" element={<StoreTimings />} />
                  <Route path="/settings/printer" element={<PrinterSettings />} />
                  <Route path="/settings/staff" element={<StaffManagement />} />
                  <Route path="/settings/payouts" element={<Payouts />} />
                  <Route path="/settings/notifications" element={<NotificationSounds />} />
                  <Route path="/settings/help" element={<HelpSupport />} />
                  <Route path="/settings/about" element={<AboutLegal />} />
                  <Route path="/earnings" element={<Earnings />} />
                  <Route path="/earnings/detail/:date" element={<EarningsDetail />} />
                </Route>
              </Routes>
            </div>
          </div>
          
          <Toaster position="top-center" richColors toastOptions={{
            className: 'bg-white text-black border border-gray-200 shadow-lg',
            style: { background: 'white', color: 'black', border: '1px solid #e5e7eb' },
          }} />
        </BrowserRouter>
      </CatalogProvider>
    </StoreProvider>
  );
}
