import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Package, Settings } from 'lucide-react';
import clsx from 'clsx';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Hub', icon: Home, path: '/dashboard' },
    { name: 'Orders', icon: ClipboardList, path: '/orders' },
    { name: 'Inventory', icon: Package, path: '/inventory' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  // Don't show nav on login or signup pages
  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1",
                isActive ? "text-black" : "text-gray-400"
              )}
            >
              <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
