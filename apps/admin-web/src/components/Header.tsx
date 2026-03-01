import { Search, Bell, ChevronRight, User, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

import { SidebarTrigger } from './ui/sidebar';
import { Separator } from './ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function Header() {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      toast.info(`Searching for: "${searchQuery}"`, {
        description: "Global search functionality is simulated."
      });
    }
  };

  const handleNotificationClick = () => {
    toast.success("No new notifications", {
      description: "You're all caught up!"
    });
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
      <div className="flex items-center justify-between h-full">
        {/* Left: Trigger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Home</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">Dashboard</span>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search for Orders, Users, or Stores... Cmd+K"
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#B52725] focus:border-[#B52725] outline-none bg-gray-50 transition-all"
            />
          </div>
        </div>

        {/* Right: Notifications & Profile */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button
            onClick={handleNotificationClick}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#B52725] rounded-full"></span>
          </button>

          {/* Admin Profile with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-left">
                <div className="w-10 h-10 bg-gradient-to-br from-[#B52725] to-[#FFCC05] rounded-full flex items-center justify-center text-white font-medium">
                  {(user?.name || user?.email || 'SA').charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user?.name || 'Super Admin'}</p>
                  <p className="text-gray-500 text-xs">{user?.email || 'admin@pickatstore.com'}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 text-[#B52725] focus:text-[#B52725]"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
