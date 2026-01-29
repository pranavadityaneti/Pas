import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  ChevronDown, 
  Calendar, 
  ShoppingBag, 
  Truck, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  Store, 
  ClipboardList,
  AlertTriangle,
  XCircle,
  Moon,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '@/app/context/StoreContext';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import LogoImage from 'figma:asset/38120058e79c356abd582941dc8f05d4c092d032.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentStore, stores, setCurrentStoreId, toggleStoreStatus, orders } = useStore();
  
  // Local State
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  
  // Derived State: Pending Orders from Context
  const pendingOrders = orders
    .filter(o => o.status === 'pending')
    .map(o => ({
        id: o.id,
        customer: o.customer.name,
        items: o.items.length,
        total: o.pricing.total,
        timeLeft: o.time || 300 // default 5 mins if not set
    }));
  
  // Active Order Timer Logic - Track the oldest (most urgent) order
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (pendingOrders.length === 0) return;
    const minTime = Math.min(...pendingOrders.map(o => o.timeLeft));
    setTimeLeft(minTime);
    
    const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingOrders.length]); 

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleToggleStatus = () => {
    if (currentStore.isOnline) {
      // Trying to go offline -> Show confirmation
      setShowOfflineModal(true);
    } else {
      // Trying to go online -> Just do it
      toggleStoreStatus();
    }
  };

  const confirmOffline = () => {
    toggleStoreStatus();
    setShowOfflineModal(false);
  };

  const handleOrderClick = (orderStatus: string, orderId: string) => {
    if (orderStatus === 'Delivered') {
        navigate(`/order/${orderId}`);
    } else {
        navigate('/orders');
    }
  };

  return (
    <div className={clsx("flex flex-col min-h-screen pb-24 font-sans relative transition-colors duration-500", currentStore.isOnline ? "bg-white text-black" : "bg-gray-100 text-gray-500")}>
      
      {/* Offline Banner Overlay */}
      <AnimatePresence>
        {!currentStore.isOnline && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gray-800 text-white px-5 py-3 flex justify-between items-center"
            >
                <div className="flex items-center gap-2">
                    <Moon size={16} className="text-gray-300" />
                    <span className="font-bold text-sm">Store is currently Offline</span>
                </div>
                <button 
                    onClick={toggleStoreStatus}
                    className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                    Go Online
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className={clsx("px-5 pt-5 pb-2 flex justify-between items-center transition-opacity", !currentStore.isOnline && "opacity-60")}>
        {/* Left: Brand Logo */}
        <div className="h-10 flex items-center">
            <img src={LogoImage} alt="Pick At Store" className={clsx("h-full w-auto object-contain", !currentStore.isOnline && "grayscale")} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
            <button 
                onClick={() => navigate('/orders')}
                className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 active:bg-gray-50 transition-colors"
            >
                <ClipboardList size={20} />
            </button>
            <button className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 active:bg-gray-50 transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-black rounded-full border-2 border-white"></span>
            </button>
        </div>
      </div>

      <div className={clsx("px-5 mb-6 transition-opacity", !currentStore.isOnline && "opacity-60")}>
        <h2 className="text-xl font-light text-gray-500">Good Morning, <span className="text-black font-semibold">Rahul</span></h2>
      </div>

      {/* Store Selector & Status Row */}
      <div className="px-5 mb-6">
        <div className="flex gap-3 h-14">
            {/* Dropdown */}
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button className="flex-1 bg-white border border-gray-200 rounded-xl px-4 flex items-center justify-between active:bg-gray-50 transition-colors shadow-sm">
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Store Branch</span>
                            <span className="font-bold text-gray-900 truncate w-full text-left">{currentStore.name}</span>
                        </div>
                        <ChevronDown size={18} className="text-gray-400 ml-2 flex-shrink-0" />
                    </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="min-w-[220px] bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200" sideOffset={5}>
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
                                {currentStore.id === store.id && <CheckCircle size={14} />}
                            </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Online/Offline Toggle */}
            <button 
                onClick={handleToggleStatus}
                className={clsx(
                    "px-4 rounded-xl border flex flex-col justify-center items-center min-w-[80px] transition-all duration-300 shadow-sm",
                    currentStore.isOnline ? "bg-black border-black text-white" : "bg-white border-gray-200 text-gray-500"
                )}
            >
                <div className={clsx("w-2 h-2 rounded-full mb-1", currentStore.isOnline ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-gray-400")} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{currentStore.isOnline ? 'Online' : 'Offline'}</span>
            </button>
        </div>
      </div>

      <hr className={clsx("border-gray-200 mx-5 mb-6 transition-opacity", !currentStore.isOnline && "opacity-30")} />

      {/* Active Order Injection (Hidden when Offline) */}
      <AnimatePresence>
        {currentStore.isOnline && pendingOrders.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                className="px-5 mb-8"
            >
                {pendingOrders.length === 1 ? (
                    // Single Order Card - Full Details - URGENT YELLOW THEME
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-400/10 rounded-bl-full -mr-8 -mt-8 animate-pulse" />
                        
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
                                <span className="font-bold text-sm tracking-wide text-gray-900">NEW ORDER #{pendingOrders[0].id}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-red-100 border-red-200 text-red-600">
                                <Clock size={14} />
                                <span className="font-mono font-bold text-sm">
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="font-bold text-xl text-gray-900">{pendingOrders[0].customer}</p>
                                <p className="text-gray-600 text-sm font-medium mt-1">{pendingOrders[0].items} Items • Cash on Delivery</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-black">₹{pendingOrders[0].total}</p>
                                <p className="text-xs text-gray-500 font-medium uppercase mt-0.5">Total Bill</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate('/orders')}
                            className="w-full bg-black text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            View Order <ChevronRight size={18} />
                        </button>
                    </div>
                ) : (
                    // Multiple Orders Summary Card - Compact High Alert
                    <button
                        onClick={() => navigate('/orders')}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 shadow-lg active:scale-[0.98] transition-transform relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-12 -mt-12" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                                    <span className="text-2xl font-bold text-red-600">{pendingOrders.length}</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-bold text-lg">New Orders Pending</p>
                                    <p className="text-white/90 text-sm mt-0.5">Earliest expiry in <span className="font-mono font-bold">{formatTime(timeLeft)}</span></p>
                                </div>
                            </div>
                            <div className="text-white text-2xl font-light">&gt;</div>
                        </div>
                    </button>
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* Performance Section */}
      <div className={clsx("px-5 mb-8 transition-opacity", !currentStore.isOnline && "opacity-70 pointer-events-none")}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900">Performance</h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 active:bg-gray-100">
                <Calendar size={14} />
                Today
            </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Sales Card - Prominent */}
            <div className="col-span-2 bg-black text-white p-4 rounded-xl shadow-lg">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Sales</p>
                <p className="text-3xl font-bold">{currentStore.metrics.sales}</p>
            </div>

            {/* Metric Cards */}
            {[
                { label: 'Total Orders', value: currentStore.metrics.orders, icon: ShoppingBag, color: 'text-gray-400' },
                { label: 'Pending', value: currentStore.metrics.pending, icon: Clock, color: 'text-orange-400' },
                { label: 'Delivered', value: currentStore.metrics.delivered, icon: CheckCircle, color: 'text-green-500' },
                { label: 'Cancelled', value: currentStore.metrics.cancelled, icon: XCircle, color: 'text-red-500' },
            ].map((metric, idx) => (
                <div key={idx} className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col justify-between h-24 shadow-sm">
                    <div className="flex justify-between items-start">
                         <p className="text-gray-500 text-xs font-medium">{metric.label}</p>
                         <metric.icon size={16} className={metric.color} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{metric.value}</p>
                </div>
            ))}
            
            <button 
                onClick={() => navigate('/earnings')}
                className="col-span-2 bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center hover:bg-gray-50 active:scale-[0.98] transition-all group pointer-events-auto shadow-sm"
            >
                 <div className="text-left">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Daily Earnings</p>
                    <p className="text-xl font-bold text-gray-900">{currentStore.metrics.earnings}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <CreditCard className="text-gray-400" size={24} />
                    <span className="text-gray-400 text-xl group-hover:translate-x-1 transition-transform">&gt;</span>
                 </div>
            </button>
        </div>

        {/* Inventory Alert Strip - Smart Link to Filter */}
        <button 
            onClick={() => navigate('/inventory', { state: { filter: 'low-stock' } })}
            className="w-full bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center justify-between group active:bg-orange-100 transition-colors pointer-events-auto"
        >
            <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle size={16} className="fill-orange-700 text-orange-50" />
                <span className="text-sm font-semibold">4 Items Low on Stock</span>
            </div>
            <span className="text-orange-400 text-lg group-hover:translate-x-1 transition-transform">&gt;</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div className={clsx("px-5 flex-1 transition-opacity", !currentStore.isOnline && "opacity-60")}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900">Recent Activity</h3>
            <button className="text-xs font-semibold text-gray-500 underline">View All</button>
        </div>

        <div className="space-y-3">
            {currentStore.recentActivity.map((order) => (
                <button 
                    key={order.id}
                    onClick={() => handleOrderClick(order.status, order.id)}
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 border border-gray-200">
                            <ShoppingBag size={18} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-gray-900">Order #{order.id}</p>
                            <p className="text-xs text-gray-500">{order.items} Items • {order.time}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">₹{order.total}</p>
                        <p className="text-[10px] font-medium text-gray-500 uppercase mt-0.5">{order.status}</p>
                    </div>
                </button>
            ))}
        </div>
      </div>

      {/* Offline Confirmation Modal Overlay */}
      <AnimatePresence>
        {showOfflineModal && (
          <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowOfflineModal(false)}
                className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: '50%', x: '-50%' }}
                animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, y: '50%', x: '-50%' }}
                className="fixed top-1/2 left-1/2 w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl p-6 z-[70] origin-center"
            >
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600">
                    <Store size={24} />
                </div>
                
                <h3 className="text-xl font-bold text-center mb-2">Stop accepting orders?</h3>
                <p className="text-center text-gray-500 mb-8 text-sm leading-relaxed">
                    Your store will be shown as <span className="font-bold text-black">'Closed'</span> to customers. You won't receive new order notifications.
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowOfflineModal(false)}
                        className="flex-1 bg-gray-100 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmOffline}
                        className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all"
                    >
                        Go Offline
                    </button>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
