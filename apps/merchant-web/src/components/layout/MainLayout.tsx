import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const tabs = [
        { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard' },
        { id: 'orders', label: 'Orders', icon: ShoppingBag, path: '/orders' },
        { id: 'inventory', label: 'Catalog', icon: Package, path: '/inventory' },
        // { id: 'profile', label: 'Profile', icon: User, path: '/profile' }, // Future
    ];

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <div className="flex-1 overflow-hidden relative">
                <Outlet />
            </div>

            {/* Bottom Navigation */}
            <nav className="bg-white border-t border-gray-200 safe-area-bottom pb-safe">
                <div className="flex justify-around items-center h-16">
                    {tabs.map((tab) => {
                        const isActive = location.pathname.startsWith(tab.path);
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigate(tab.path)}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1",
                                    isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                <Icon className={cn("w-6 h-6", isActive && "fill-current opacity-20")} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-medium">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
