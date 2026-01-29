import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginScreen from './screens/Auth/LoginScreen';
import SignupWizard from './screens/Auth/SignupWizard';
import PendingApproval from './screens/Auth/PendingApproval';
import ApplicationRejected from './screens/Auth/ApplicationRejected';
import HomeScreen from './screens/Dashboard/HomeScreen';
import OrdersScreen from './screens/Orders/OrdersScreen';
import InventoryScreen from './screens/Inventory/InventoryScreen';
import NotificationSettings from './screens/Settings/NotificationSettings';
import MainLayout from './components/layout/MainLayout';
import { Toaster } from 'sonner';

function App() {
    return (
        <Router>
            <Toaster position="top-center" />
            <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />

                {/* Public Auth */}
                <Route path="/auth" element={<LoginScreen />} />
                <Route path="/signup" element={<SignupWizard />} />

                {/* Status Screens */}
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/application-rejected" element={<ApplicationRejected />} />

                {/* Main App Layout */}
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<HomeScreen />} />
                    <Route path="/orders" element={<OrdersScreen />} />
                    <Route path="/inventory" element={<InventoryScreen />} />
                    <Route path="/settings/notifications" element={<NotificationSettings />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
