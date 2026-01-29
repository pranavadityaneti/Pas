import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './screens/Auth/LoginScreen';
import SignupWizard from './screens/Auth/SignupWizard';
import PendingApproval from './screens/Auth/PendingApproval';
import ApplicationRejected from './screens/Auth/ApplicationRejected';
import HomeScreen from './screens/Dashboard/HomeScreen';
import NotificationSettings from './screens/Settings/NotificationSettings';
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

                {/* Protected Dashboard (We assume LoginScreen checks for 'active' status before navigating here) */}
                {/* In a fuller app, we'd wrap this in a <ProtectedRoute> component that re-verifies session */}
                <Route path="/dashboard" element={<HomeScreen />} />
                <Route path="/settings/notifications" element={<NotificationSettings />} />
            </Routes>
        </Router>
    );
}

export default App;
