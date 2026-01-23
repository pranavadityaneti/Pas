import { Search, Bell, ChevronRight, User } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export function Header() {
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

  const handleProfileClick = () => {
    toast("Admin Profile", {
      description: "Logged in as Super Admin (admin@pickatstore.com)",
      icon: <User className="w-4 h-4" />
    });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Home</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">Dashboard</span>
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
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50 transition-all"
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
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Admin Profile */}
          <button 
            onClick={handleProfileClick}
            className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors text-left"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
              SA
            </div>
            <div className="text-sm">
              <p className="font-medium text-gray-900">Super Admin</p>
              <p className="text-gray-500 text-xs">admin@pickatstore.com</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
