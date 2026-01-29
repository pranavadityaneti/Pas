import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Share2, Download, CreditCard, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

type PaymentMode = 'UPI' | 'Card';
type OrderStatus = 'received' | 'pending';

interface OrderTransaction {
  orderId: string;
  customerName: string;
  time: string;
  amount: number;
  paymentMode: PaymentMode;
  status: OrderStatus;
}

export default function EarningsDetail() {
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const [showExportModal, setShowExportModal] = useState(false);

  // Parse DD-MM-YYYY format to display date
  const formatDisplayDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Mock data - would come from API based on date
  const dailyOrderData: Record<string, { orders: OrderTransaction[], totalOrders: number, totalAmount: number, status: 'settled' | 'processing' }> = {
    '18-01-2026': {
      totalOrders: 12,
      totalAmount: 4200,
      status: 'processing',
      orders: [
        { orderId: 'RD-4022', customerName: 'Rahul M.', time: '10:30 AM', amount: 450, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4023', customerName: 'Priya S.', time: '11:15 AM', amount: 320, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4024', customerName: 'Amit K.', time: '11:45 AM', amount: 580, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4025', customerName: 'Sneha R.', time: '12:20 PM', amount: 290, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4026', customerName: 'Vikram P.', time: '1:10 PM', amount: 410, paymentMode: 'UPI', status: 'pending' },
        { orderId: 'RD-4027', customerName: 'Neha D.', time: '2:00 PM', amount: 350, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4028', customerName: 'Karan J.', time: '2:45 PM', amount: 480, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4029', customerName: 'Anjali V.', time: '3:30 PM', amount: 270, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4030', customerName: 'Rohan T.', time: '4:15 PM', amount: 390, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4031', customerName: 'Divya M.', time: '5:00 PM', amount: 310, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4032', customerName: 'Arjun B.', time: '5:45 PM', amount: 180, paymentMode: 'UPI', status: 'pending' },
        { orderId: 'RD-4033', customerName: 'Pooja K.', time: '6:20 PM', amount: 170, paymentMode: 'Card', status: 'received' },
      ]
    },
    '17-01-2026': {
      totalOrders: 18,
      totalAmount: 6800,
      status: 'settled',
      orders: [
        { orderId: 'RD-3990', customerName: 'Sanjay L.', time: '9:00 AM', amount: 420, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3991', customerName: 'Kavita S.', time: '9:30 AM', amount: 380, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-3992', customerName: 'Rajesh N.', time: '10:15 AM', amount: 340, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-3993', customerName: 'Meena G.', time: '10:45 AM', amount: 290, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3994', customerName: 'Suresh P.', time: '11:20 AM', amount: 450, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3995', customerName: 'Lakshmi R.', time: '12:00 PM', amount: 310, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3996', customerName: 'Deepak M.', time: '12:40 PM', amount: 390, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-3997', customerName: 'Swati T.', time: '1:30 PM', amount: 280, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3998', customerName: 'Anil K.', time: '2:15 PM', amount: 510, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-3999', customerName: 'Rina B.', time: '3:00 PM', amount: 330, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4000', customerName: 'Manoj V.', time: '3:45 PM', amount: 470, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4001', customerName: 'Geeta D.', time: '4:20 PM', amount: 360, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4002', customerName: 'Naveen S.', time: '5:00 PM', amount: 400, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4003', customerName: 'Seema W.', time: '5:30 PM', amount: 290, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4004', customerName: 'Harish P.', time: '6:00 PM', amount: 380, paymentMode: 'Card', status: 'received' },
        { orderId: 'RD-4005', customerName: 'Nisha K.', time: '6:30 PM', amount: 320, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4006', customerName: 'Ramesh J.', time: '7:00 PM', amount: 410, paymentMode: 'UPI', status: 'received' },
        { orderId: 'RD-4007', customerName: 'Anita M.', time: '7:30 PM', amount: 270, paymentMode: 'Card', status: 'received' },
      ]
    },
    '16-01-2026': {
      totalOrders: 22,
      totalAmount: 8400,
      status: 'settled',
      orders: Array.from({ length: 22 }, (_, i) => ({
        orderId: `RD-${3968 + i}`,
        customerName: `Customer ${i + 1}`,
        time: `${9 + Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'} ${i < 10 ? 'AM' : 'PM'}`,
        amount: 300 + Math.floor(Math.random() * 300),
        paymentMode: ['UPI', 'Card'][i % 2] as PaymentMode,
        status: 'received' as OrderStatus
      }))
    }
  };

  const currentDayData = date ? dailyOrderData[date] : null;

  if (!currentDayData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black p-5">
        <p className="text-gray-500 text-sm mb-4">No data available for this date</p>
        <button 
          onClick={() => navigate('/earnings')}
          className="px-6 py-3 bg-black text-white rounded-xl font-bold"
        >
          Back to Earnings
        </button>
      </div>
    );
  }

  const handleExport = (format: 'pdf' | 'excel') => {
    // Trigger download
    const displayDate = formatDisplayDate(date);
    const fileName = `earnings-${date}.${format}`;
    
    // Create a simple text blob for demonstration
    const content = `Earnings Report - ${displayDate}\n\nTotal Orders: ${currentDayData.totalOrders}\nTotal Amount: ₹${currentDayData.totalAmount}\nStatus: ${currentDayData.status}\n\nOrders:\n${currentDayData.orders.map(o => `${o.orderId} - ${o.customerName} - ₹${o.amount} - ${o.paymentMode}`).join('\n')}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowExportModal(false);
  };

  const paymentModeConfig = {
    UPI: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Card: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 px-5 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/earnings')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{formatDisplayDate(date)}</h1>
          <button 
            onClick={() => setShowExportModal(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <Share2 size={20} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Summary Banner */}
        <div className={clsx(
          "mx-5 mt-5 mb-6 p-4 rounded-xl border-2",
          currentDayData.status === 'settled' 
            ? "bg-green-50 border-green-200" 
            : "bg-yellow-50 border-yellow-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentDayData.status === 'settled' ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : (
                <Clock size={24} className="text-yellow-600" />
              )}
              <div>
                <p className={clsx(
                  "text-xs font-bold uppercase tracking-wide mb-0.5",
                  currentDayData.status === 'settled' ? "text-green-600" : "text-yellow-600"
                )}>
                  {currentDayData.status === 'settled' ? 'Settled' : 'Processing'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-bold">{currentDayData.totalOrders} Orders</span> • Total ₹{currentDayData.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order List */}
        <div className="px-5">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Order Details</h2>
          <div className="space-y-3">
            {currentDayData.orders.map((order) => (
              <button
                key={order.orderId}
                onClick={() => navigate(`/order/${order.orderId}`)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all text-left"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Order #{order.orderId}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{order.customerName} • {order.time}</p>
                  </div>
                  {order.status === 'received' ? (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle size={16} className="fill-green-600 text-white" />
                      <span className="text-xs font-bold">Received</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-yellow-600">
                      <Clock size={16} />
                      <span className="text-xs font-bold">Pending</span>
                    </div>
                  )}
                </div>

                {/* Payment & Amount Row */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className={clsx(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold",
                    paymentModeConfig[order.paymentMode].bg,
                    paymentModeConfig[order.paymentMode].text,
                    paymentModeConfig[order.paymentMode].border
                  )}>
                    <CreditCard size={12} />
                    {order.paymentMode}
                  </div>
                  <p className="text-lg font-bold text-gray-900">₹{order.amount}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-[70] max-w-md mx-auto"
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              
              <h3 className="text-xl font-bold text-center mb-2">Export Report</h3>
              <p className="text-center text-gray-500 mb-6 text-sm">
                Download earnings report for {formatDisplayDate(date)}
              </p>

              <div className="space-y-3 mb-4">
                <button 
                  onClick={() => handleExport('pdf')}
                  className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download as PDF
                </button>
                
                <button 
                  onClick={() => handleExport('excel')}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download as Excel
                </button>
              </div>

              <button 
                onClick={() => setShowExportModal(false)}
                className="w-full bg-gray-100 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}