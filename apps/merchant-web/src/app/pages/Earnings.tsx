import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Calendar, Package, CreditCard, CheckCircle, Clock, Download } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../context/StoreContext';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

type TimePeriod = 'today' | 'yesterday' | 'this-week' | 'this-month';
type TransactionStatus = 'settled' | 'processing';

interface Transaction {
  id: string;
  date: string;
  orders: number;
  amount: number;
  status: TransactionStatus;
}

export default function Earnings() {
  const navigate = useNavigate();
  const { currentStore, orders } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this-week');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Period labels for display
  const periodLabels: Record<TimePeriod, string> = {
    'today': 'Today',
    'yesterday': 'Yesterday',
    'this-week': 'This Week',
    'this-month': 'This Month',
  };

  // Helper to parse currency string "₹4,200" -> 4200
  const parseCurrency = (str: string) => {
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
  };

  // Dynamic "Today" Data from Context
  const todayData = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const processingOrders = orders.filter(o => o.status === 'processing' || o.status === 'pending');
    
    // Create transaction entries from individual completed orders for "Today"
    // In a real app, these might be aggregated by settlement batches
    const transactions: Transaction[] = completedOrders.map(o => ({
        id: `TXN-${o.id}`,
        date: 'Today', // Simplified
        orders: 1,
        amount: o.pricing.total - o.pricing.platformFee,
        status: 'processing' // Recent orders usually processing
    }));

    return {
        ordersFulfilled: parseInt(currentStore.metrics.delivered) || 0,
        totalPayout: parseCurrency(currentStore.metrics.earnings),
        transactions: transactions.length > 0 ? transactions : [
            // Fallback if no orders yet, or show empty state. 
            // Keeping the mock one if empty just to show UI? No, let's show empty.
        ]
    };
  }, [orders, currentStore.metrics]);

  // Mock data for other periods
  const historicalData = {
    'yesterday': { ordersFulfilled: 18, totalPayout: 6800, transactions: [
      { id: 'TXN-002', date: '17 Jan 2026', orders: 18, amount: 6800, status: 'settled' as TransactionStatus },
    ]},
    'this-week': { ordersFulfilled: 145, totalPayout: 45200, transactions: [
      { id: 'TXN-003', date: '18 Jan 2026', orders: 12, amount: 4200, status: 'processing' as TransactionStatus },
      { id: 'TXN-004', date: '17 Jan 2026', orders: 18, amount: 6800, status: 'settled' as TransactionStatus },
      { id: 'TXN-005', date: '16 Jan 2026', orders: 22, amount: 8400, status: 'settled' as TransactionStatus },
      { id: 'TXN-006', date: '15 Jan 2026', orders: 28, amount: 9200, status: 'settled' as TransactionStatus },
      { id: 'TXN-007', date: '14 Jan 2026', orders: 31, amount: 8100, status: 'settled' as TransactionStatus },
      { id: 'TXN-008', date: '13 Jan 2026', orders: 19, amount: 5300, status: 'settled' as TransactionStatus },
      { id: 'TXN-009', date: '12 Jan 2026', orders: 15, amount: 3200, status: 'settled' as TransactionStatus },
    ]},
    'this-month': { ordersFulfilled: 542, totalPayout: 178900, transactions: [
      { id: 'TXN-010', date: '18 Jan 2026', orders: 145, amount: 45200, status: 'settled' as TransactionStatus },
      { id: 'TXN-011', date: '11 Jan 2026', orders: 168, amount: 52800, status: 'settled' as TransactionStatus },
      { id: 'TXN-012', date: '04 Jan 2026', orders: 229, amount: 80900, status: 'settled' as TransactionStatus },
    ]},
  };

  const currentData = selectedPeriod === 'today' ? todayData : historicalData[selectedPeriod];

  // Helper function to convert date string to DD-MM-YYYY format for URL
  const formatDateForUrl = (dateStr: string): string => {
    if (dateStr === 'Today') return '18-01-2026'; // Mock mapping for today
    
    // Expected format: "DD MMM YYYY" e.g., "18 Jan 2026"
    const parts = dateStr.split(' ');
    if (parts.length !== 3) return '';
    
    const day = parts[0].padStart(2, '0');
    const monthMap: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = monthMap[parts[1]];
    const year = parts[2];
    
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white pb-24 text-black">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 px-5 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 absolute left-1/2 -translate-x-1/2">Earnings</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          {/* Time Period Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex-1 flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 active:bg-gray-100 transition-colors">
                <span className="font-medium text-sm text-gray-900">{periodLabels[selectedPeriod]}</span>
                <ChevronDown size={18} className="text-gray-600" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="bg-white rounded-xl shadow-2xl border border-gray-200 p-2 min-w-[200px] z-50"
                sideOffset={5}
              >
                {(Object.keys(periodLabels) as TimePeriod[]).map((period) => (
                  <DropdownMenu.Item
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={clsx(
                      "px-4 py-3 rounded-lg cursor-pointer outline-none transition-colors",
                      selectedPeriod === period 
                        ? "bg-black text-white font-medium" 
                        : "hover:bg-gray-100 text-gray-900"
                    )}
                  >
                    {periodLabels[period]}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Calendar Button */}
          <button 
            onClick={() => setShowDatePicker(true)}
            className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 active:bg-gray-100 transition-colors"
          >
            <Calendar size={20} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Summary Section - Hero Cards */}
        <div className="px-5 py-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Orders Fulfilled */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Package size={20} className="text-white/80" />
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Orders</p>
              </div>
              <p className="text-4xl font-bold mb-1">{currentData.ordersFulfilled}</p>
              <p className="text-white/60 text-xs">Fulfilled</p>
            </div>

            {/* Card 2: Total Payout */}
            <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-2xl p-5 text-white shadow-lg shadow-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={20} className="text-white/80" />
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Payout</p>
              </div>
              <p className="text-3xl font-bold mb-1">₹{currentData.totalPayout.toLocaleString()}</p>
              <p className="text-white/70 text-[10px]">After commission</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-gray-900">Transaction History</h2>
          </div>

          <div className="space-y-3">
            {currentData.transactions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No completed transactions yet.</p>
            ) : (
                currentData.transactions.map((transaction) => {
                const dateUrl = formatDateForUrl(transaction.date);
                
                return (
                <button 
                    key={transaction.id}
                    onClick={() => dateUrl && navigate(`/earnings/detail/${dateUrl}`)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all text-left"
                >
                    <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                        <p className="font-bold text-sm text-gray-900 mb-1">{transaction.date}</p>
                        <p className="text-xs text-gray-500">{transaction.orders} Orders</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-green-600 mb-1">+ ₹{transaction.amount.toLocaleString()}</p>
                        {transaction.status === 'settled' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                            <CheckCircle size={12} className="text-green-600" />
                            <span className="text-[10px] font-bold text-green-700 uppercase">Settled</span>
                        </div>
                        ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                            <Clock size={12} className="text-yellow-600" />
                            <span className="text-[10px] font-bold text-yellow-700 uppercase">Processing</span>
                        </div>
                        )}
                    </div>
                    </div>

                    {/* Progress Bar (optional visual) */}
                    {transaction.status === 'processing' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Expected settlement: 2-3 business days</p>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-yellow-500 rounded-full animate-pulse" />
                        </div>
                    </div>
                    )}
                </button>
                )})
            )}
          </div>
        </div>

        {/* Download Statement */}
        <div className="px-5 pb-8">
          <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-100 active:scale-[0.98] transition-all">
            <Download size={18} />
            Download Statement (PDF)
          </button>
        </div>

        {/* Info Footer */}
        <div className="px-5 pb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-800 leading-relaxed">
              <span className="font-bold">💡 Reconciliation Tip:</span> Average order value is ₹{currentData.ordersFulfilled > 0 ? Math.round(currentData.totalPayout / currentData.ordersFulfilled) : 0}. Compare this with your expected margins to ensure accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* Date Picker Modal (Placeholder - would use a proper date picker library) */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-4">Custom Date Range</h3>
            <p className="text-sm text-gray-500 mb-6">Select a custom date range for your report</p>
            
            {/* Placeholder inputs */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">From Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">To Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowDatePicker(false)}
                className="flex-1 px-6 py-3 bg-gray-100 rounded-xl font-bold text-gray-900 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowDatePicker(false)}
                className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
