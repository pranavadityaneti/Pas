import { 
  Clock, 
  Printer, 
  Users, 
  ChevronRight, 
  LogOut, 
  CreditCard, 
  Bell, 
  HelpCircle, 
  FileText,
  Edit2,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const navigate = useNavigate();
  const { currentStore, stores, setCurrentStoreId } = useStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const MENU_ITEMS = [
    { 
      icon: TrendingUp, 
      label: 'Earnings & Reports', 
      sub: 'Track payments & reconciliation',
      path: '/earnings'
    },
    { 
      icon: Clock, 
      label: 'Store Timings', 
      sub: 'Manage opening & closing hours',
      path: '/settings/store-timings'
    },
    { 
      icon: Printer, 
      label: 'Printer Settings', 
      sub: 'Connect thermal printers',
      path: '/settings/printer'
    },
    { 
      icon: Users, 
      label: 'Staff Management', 
      sub: 'Add or remove employees',
      path: '/settings/staff'
    },
    { 
      icon: CreditCard, 
      label: 'Payouts & Bank Details', 
      sub: 'Manage payment accounts',
      path: '/settings/payouts'
    },
    { 
      icon: Bell, 
      label: 'Notification Sounds', 
      sub: 'Alert tones & preferences',
      path: '/settings/notifications'
    },
    { 
      icon: HelpCircle, 
      label: 'Help & Support', 
      sub: 'FAQs, chat, and contact',
      path: '/settings/help'
    },
    { 
      icon: FileText, 
      label: 'About & Legal', 
      sub: 'Terms, privacy & app info',
      path: '/settings/about'
    },
  ];

  const handleLogout = () => {
    // Navigate to login page
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-white pb-20 text-black">
      <div className="bg-white px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="p-5 space-y-6 overflow-y-auto flex-1">
        {/* Profile Card with Branch Switcher */}
        <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white font-bold text-2xl border-2 border-gray-200">
                R
              </div>
              <div>
                <h2 className="font-bold text-xl text-gray-900">Rahul Sharma</h2>
                <p className="text-gray-500 text-sm">Store Owner</p>
              </div>
            </div>
            <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
              <Edit2 size={16} />
            </button>
          </div>

          {/* Branch Switcher Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between active:bg-gray-50 transition-colors">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Switch Branch</span>
                  <span className="font-bold text-gray-900 text-sm mt-0.5">{currentStore.name}</span>
                </div>
                <ChevronDown size={18} className="text-gray-400" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content className="min-w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200" sideOffset={5}>
                {stores.map((store) => (
                  <DropdownMenu.Item 
                    key={store.id}
                    onSelect={() => setCurrentStoreId(store.id)}
                    className={clsx(
                      "flex items-center px-3 py-2.5 text-sm rounded-lg outline-none cursor-pointer",
                      currentStore.id === store.id ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{store.name}</p>
                      <p className={clsx("text-xs opacity-70", currentStore.id === store.id ? "text-gray-300" : "text-gray-500")}>{store.location}</p>
                    </div>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Menu List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {MENU_ITEMS.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0 text-left"
            >
              <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center mr-4 text-black border border-gray-200">
                <item.icon size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm">{item.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-white p-4 rounded-xl shadow-sm border border-red-200 flex items-center justify-center text-red-600 font-bold gap-2 hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          <LogOut size={20} />
          Log Out
        </button>

        <div className="text-center text-xs text-gray-400 pt-2 pb-4">
          v1.2.0 • Pick At Store Merchant
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: '50%', x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, y: '50%', x: '-50%' }}
              className="fixed top-1/2 left-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl p-6 z-[70]"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600">
                <LogOut size={24} />
              </div>
              
              <h3 className="text-xl font-bold text-center mb-2">Logout Confirmation</h3>
              <p className="text-center text-gray-500 mb-8 text-sm leading-relaxed">
                Are you sure you want to logout? You'll need to sign in again to access your account.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 bg-gray-100 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}