import {
  LayoutDashboard,
  Package,
  Store,
  ShoppingCart,
  Users,
  Megaphone,
  Wallet,
  Settings,
  Map,
  BarChart3,
  Bell
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Master Catalog', path: '/catalog' },
  { icon: Store, label: 'Merchant Network', path: '/merchants' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
  { icon: Users, label: 'Consumers', path: '/consumers' },
  { icon: Megaphone, label: 'Marketing', path: '/marketing' },
  { icon: Bell, label: 'Engagement', path: '/engagement' },
  { icon: Map, label: 'Geography', path: '/geography' },
  { icon: Wallet, label: 'Finance', path: '/finance' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  return (
    <div className="w-[260px] bg-slate-900 text-white flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">PickAtStore Admin</h1>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-6">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-gray-800">
        <p className="text-sm text-gray-500">Version 1.0.4</p>
      </div>
    </div>
  );
}
