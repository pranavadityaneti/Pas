import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, ListOrdered, Package, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileLayout() {
  const location = useLocation();
  // Hide bottom nav on auth screens
  const hideNav = ['/login', '/verify', '/branch-select'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className={cn("flex-1 overflow-y-auto pb-20", hideNav && "pb-0")}>
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 max-w-md mx-auto">
          <ul className="flex justify-around items-center h-16">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium text-gray-500 transition-colors",
                    isActive && "text-blue-600"
                  )
                }
              >
                <Home size={24} />
                <span>Home</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium text-gray-500 transition-colors",
                    isActive && "text-blue-600"
                  )
                }
              >
                <ListOrdered size={24} />
                <span>Orders</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/inventory"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium text-gray-500 transition-colors",
                    isActive && "text-blue-600"
                  )
                }
              >
                <Package size={24} />
                <span>Catalog</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium text-gray-500 transition-colors",
                    isActive && "text-blue-600"
                  )
                }
              >
                <Settings size={24} />
                <span>Settings</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
