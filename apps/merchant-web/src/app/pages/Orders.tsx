import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { Clock, Printer, CheckCircle, XCircle, ChevronRight, ChevronDown, Package, AlertCircle, AlertTriangle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useStore } from '@/app/context/StoreContext';
import { useNavigate } from 'react-router-dom';
import type { Order } from '@/app/context/StoreContext';

function Countdown({ seconds }: { seconds: number }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <span className="font-mono">
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

const REJECTION_REASONS = [
    "Item out of stock",
    "Store closing soon",
    "Too busy to fulfill",
    "Other"
];

export default function Orders() {
  const { currentStore, orders, updateOrderStatus } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'processing' | 'ready' | 'history'>('pending');
  
  // Local UI State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [inputOtp, setInputOtp] = useState('');
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Rejection Modal State
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    // 1. Tab Filter
    let matchesTab = false;
    if (activeTab === 'history') {
      matchesTab = o.status === 'completed' || o.status === 'rejected';
    } else {
      matchesTab = o.status === activeTab;
    }

    // 2. Search Filter
    if (!matchesTab) return false;
    if (!search) return true;

    const searchLower = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(searchLower) ||
      o.customer.name.toLowerCase().includes(searchLower) ||
      o.customer.phone.includes(search)
    );
  });

  const handleStatusChangeWrapper = (id: string, newStatus: Order['status'], reason?: string) => {
    updateOrderStatus(id, newStatus, reason);
    
    if (newStatus === 'rejected') {
        toast.error(`Order #${id} has been rejected`);
    } else if (newStatus !== 'completed') {
        toast.success(`Order #${id} moved to ${newStatus}`);
    }
  };

  const initiateRejection = (id: string) => {
      setOrderToReject(id);
      setSelectedRejectionReason(null);
      setRejectionModalOpen(true);
  };

  const confirmRejection = () => {
      if (orderToReject && selectedRejectionReason) {
          handleStatusChangeWrapper(orderToReject, 'rejected', selectedRejectionReason);
          setRejectionModalOpen(false);
          setOrderToReject(null);
      }
  };

  const handleVerifyOtp = () => {
    const order = orders.find((o) => o.id === selectedOrderId);
    if (order && order.customerOtp === inputOtp) {
      toast.success('Order Completed Successfully!');
      
      handleStatusChangeWrapper(selectedOrderId!, 'completed');
      
      setOtpModalOpen(false);
      setInputOtp('');
      setActiveTab('history');
    } else {
      toast.error('Invalid OTP');
    }
  };

  const viewOrderReceipt = (order: Order) => {
      navigate(`/order/${order.id}`, { state: { orderData: order } });
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black">
        {/* Header */}
        <div className="bg-white sticky top-0 z-10 px-4 pt-6 pb-0 shadow-sm border-b border-gray-100">
            <div className="text-center mb-2">
                <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                    <p className="text-sm text-gray-500">{currentStore.name} - {currentStore.branch || 'Main Branch'}</p>
                    <div className="flex items-center gap-1 ml-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-xs font-medium text-green-600">Online</span>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    placeholder="Search Order ID, Customer Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                />
            </div>

            <div className="flex mt-4 overflow-x-auto scrollbar-hide">
                {['pending', 'processing', 'ready', 'history'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={clsx(
                            "flex-1 pb-3 text-sm font-medium capitalize relative transition-colors min-w-[80px]",
                            activeTab === tab ? "text-black" : "text-gray-400"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div 
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" 
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-28 space-y-4 overflow-y-auto flex-1">
            <AnimatePresence mode='popLayout'>
                {filteredOrders.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-gray-400"
                    >
                        {search ? (
                            <>
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Search size={24} className="text-gray-400" />
                                </div>
                                <p>No orders matching "{search}"</p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <p>No orders in {activeTab}</p>
                            </>
                        )}
                    </motion.div>
                ) : (
                    filteredOrders.map((order) => (
                        <motion.div
                            key={order.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={clsx(
                                "relative bg-white rounded-xl p-4 shadow-md border-2",
                                activeTab === 'processing' ? "border-l-4 border-l-green-500 border-gray-200" : "border-gray-200",
                                order.status === 'rejected' ? "opacity-75" : "opacity-100"
                            )}
                        >
                            {/* Order Card Content */}
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-lg text-gray-900">Order #{order.id}</h3>
                                {activeTab === 'pending' && <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white">APPROVAL NEEDED</span>}
                                {activeTab === 'processing' && <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-600 text-white shadow-lg shadow-green-200">PAID - START PACKING</span>}
                                {activeTab === 'history' && (
                                    <div className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded-full border", order.status === 'completed' ? "text-green-600 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100")}>
                                        {order.status === 'completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        <span className="text-[10px] font-bold uppercase">{order.status === 'completed' ? 'Delivered' : 'Rejected'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                                    <span className="font-medium text-gray-900">{order.customer.name}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600">{order.customer.phone}</span>
                                </div>
                                {activeTab === 'history' ? (
                                     <span className="text-xs text-gray-500">{order.completedAt}</span>
                                ) : (
                                    order.placedAt && <span className="text-xs text-gray-500">Placed at {order.placedAt}</span>
                                )}
                            </div>

                            {/* Timer */}
                            {order.status === 'pending' && order.time && (
                                <div className="mb-4">
                                    <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg", order.time <= 30 ? "bg-red-50" : order.time <= 60 ? "bg-yellow-50" : "bg-green-50")}>
                                        <Clock size={16} className={clsx("flex-shrink-0", order.time <= 30 ? "text-red-600" : order.time <= 60 ? "text-yellow-600" : "text-green-600")} />
                                        <span className={clsx("text-sm font-bold flex-1", order.time <= 30 ? "text-red-700" : order.time <= 60 ? "text-yellow-700" : "text-green-700")}>
                                            Auto-rejects in <Countdown seconds={order.time} />
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Rejection Reason Display */}
                            {order.status === 'rejected' && (
                                <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2">
                                    <AlertCircle size={16} className="text-red-500 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-red-700 uppercase mb-0.5">Rejected</p>
                                        <p className="text-sm text-red-600 leading-snug">{order.rejectionReason || "Order was rejected by the store."}</p>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div className="mb-4 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <Package size={16} className="text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-700">Items ({order.items.length})</span>
                                </div>
                                <div className="space-y-2.5">
                                    {order.items.slice(0, activeTab === 'history' ? 2 : undefined).map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 flex-1">
                                                {activeTab !== 'history' && (
                                                    <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", item.stockStatus === 'in-stock' ? "bg-green-500" : item.stockStatus === 'low-stock' ? "bg-orange-500 animate-pulse" : "bg-red-500")} />
                                                )}
                                                <span className={clsx("text-sm text-gray-900", item.stockStatus === 'out-of-stock' && activeTab !== 'history' && "line-through text-gray-400")}>
                                                     {item.unit === 'weight' ? `${item.weightAmount}${item.weightUnit} ${item.name}` : `${item.quantity}× ${item.name}`}
                                                </span>
                                                {activeTab !== 'history' && item.stockStatus !== 'out-of-stock' && (
                                                    <span className={clsx("text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap", item.stockStatus === 'low-stock' ? "text-orange-700 bg-orange-100 font-bold" : "text-green-600 bg-green-50")}>
                                                        {item.stockStatus === 'low-stock' ? `⚠️ Low` : `Stock: ${item.stockCount}`}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 ml-2 flex-shrink-0">₹{item.price}</span>
                                        </div>
                                    ))}
                                    {activeTab === 'history' && order.items.length > 2 && (
                                        <p className="text-xs text-gray-400 italic pl-6">+ {order.items.length - 2} more items...</p>
                                    )}
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-lg text-gray-900">{activeTab === 'pending' ? 'Estimated Value:' : 'Total Bill:'} ₹{order.pricing.total}</span>
                                    <button onClick={() => setExpandedBreakdown(expandedBreakdown === order.id ? null : order.id)} className="text-xs text-gray-600 flex items-center gap-1 hover:text-black transition-colors">
                                        View Breakup <ChevronDown size={14} className={clsx("transition-transform", expandedBreakdown === order.id ? "rotate-180" : "")} />
                                    </button>
                                </div>
                                <AnimatePresence>
                                    {expandedBreakdown === order.id && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm border border-gray-200">
                                                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="text-gray-900 font-medium">₹{order.pricing.subtotal}</span></div>
                                                {order.pricing.gst > 0 && <div className="flex justify-between"><span className="text-gray-600">Tax</span><span className="text-gray-900 font-medium">₹{order.pricing.gst}</span></div>}
                                                <div className="pt-2 border-t border-gray-300 flex justify-between"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-gray-900">₹{order.pricing.total}</span></div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end items-center pt-3 border-t border-gray-100">
                                {activeTab === 'pending' && (
                                    <div className="flex gap-2 w-full">
                                        <button onClick={() => initiateRejection(order.id)} className="flex-[0.3] px-4 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 active:scale-95 transition-all">Reject</button>
                                        <button onClick={() => handleStatusChangeWrapper(order.id, 'processing')} className="flex-[0.7] px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">Accept Order</button>
                                    </div>
                                )}
                                {activeTab === 'processing' && (
                                    <div className="flex gap-2 w-full">
                                        <button className="flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-100 text-black rounded-lg border border-gray-200 active:bg-gray-200 text-sm font-semibold"><Printer size={18} /> Print KOT</button>
                                        <button onClick={() => handleStatusChangeWrapper(order.id, 'ready')} className="flex-1 px-5 py-3 bg-black text-white rounded-lg text-sm font-bold active:scale-95 transition-transform">Mark Ready</button>
                                    </div>
                                )}
                                {activeTab === 'ready' && (
                                    <button onClick={() => { setSelectedOrderId(order.id); setOtpModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold active:scale-95 transition-transform">Enter OTP <ChevronRight size={16} /></button>
                                )}
                                {activeTab === 'history' && order.status === 'completed' && (
                                    <button onClick={() => viewOrderReceipt(order)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-200 transition-colors">
                                        <FileText size={16} /> View Digital Receipt
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </AnimatePresence>
        </div>

        {/* OTP Modal */}
        <AnimatePresence>
            {otpModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-4 sm:p-0">
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="bg-white w-full max-w-md rounded-2xl text-black shadow-2xl overflow-hidden">
                        <div className="p-6 pb-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Pickup Verification</h3>
                                <button onClick={() => setOtpModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100"><XCircle className="text-gray-400" size={24} /></button>
                            </div>
                            <p className="text-gray-500 mb-8 text-sm leading-relaxed text-center">Ask the customer for the 4-digit PIN to mark this order as completed.</p>
                            <div className="mb-8 flex justify-center">
                                <div className="relative">
                                    <input type="text" value={inputOtp} readOnly className="w-full text-center text-4xl font-bold tracking-[1rem] py-4 border-b-2 border-gray-200 focus:border-black outline-none bg-transparent" />
                                    {!inputOtp && <span className="absolute left-1/2 -translate-x-1/2 top-4 text-4xl font-bold tracking-[1rem] text-gray-200 pointer-events-none">••••</span>}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <button key={num} onClick={() => inputOtp.length < 4 && setInputOtp(prev => prev + num)} className="h-14 bg-gray-50 rounded-xl text-xl font-semibold active:bg-black active:text-white transition-all hover:bg-gray-100">{num}</button>
                                ))}
                                <button onClick={() => setInputOtp('')} className="h-14 bg-red-50 text-red-500 rounded-xl font-semibold active:bg-red-500 active:text-white transition-all hover:bg-red-100">CLR</button>
                                <button onClick={() => inputOtp.length < 4 && setInputOtp(prev => prev + '0')} className="h-14 bg-gray-50 rounded-xl text-xl font-semibold active:bg-black active:text-white transition-all hover:bg-gray-100">0</button>
                                <button onClick={() => setInputOtp(prev => prev.slice(0, -1))} className="h-14 bg-gray-50 rounded-xl font-semibold active:bg-black active:text-white transition-all hover:bg-gray-100 flex items-center justify-center"><ChevronRight className="rotate-180" size={20} /></button>
                            </div>
                            <button onClick={handleVerifyOtp} disabled={inputOtp.length !== 4} className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-[0.98] transition-all">Verify & Complete</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* Rejection Reason Modal */}
        <AnimatePresence>
            {rejectionModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center backdrop-blur-sm p-4 sm:p-0">
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="bg-white w-full max-w-md rounded-2xl text-black shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                    <AlertTriangle size={24} /> Reject Order
                                </h3>
                                <button onClick={() => setRejectionModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100"><XCircle className="text-gray-400" size={24} /></button>
                            </div>
                            <p className="text-gray-600 mb-6 text-sm font-medium">Please select a reason for rejecting this order. This will be shared with the customer.</p>
                            
                            <div className="space-y-3 mb-8">
                                {REJECTION_REASONS.map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => setSelectedRejectionReason(reason)}
                                        className={clsx(
                                            "w-full p-4 rounded-xl text-left border-2 transition-all flex justify-between items-center",
                                            selectedRejectionReason === reason 
                                                ? "border-red-500 bg-red-50 text-red-700 font-bold" 
                                                : "border-gray-100 bg-white text-gray-700 hover:bg-gray-50"
                                        )}
                                    >
                                        {reason}
                                        {selectedRejectionReason === reason && <CheckCircle size={18} className="text-red-600" />}
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={confirmRejection}
                                disabled={!selectedRejectionReason}
                                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-xl active:scale-[0.98] transition-all"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}
