import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Share2, HelpCircle, CheckCircle, MapPin, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../context/StoreContext';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useStore();

  // Retrieve passed order data from location state
  const passedOrderData = location.state?.orderData;

  const orderData = useMemo(() => {
    // 1. Try passed data (fastest)
    let sourceData = passedOrderData;
    
    // 2. Try lookup in context if passed data is missing
    if (!sourceData && id) {
        sourceData = orders.find(o => o.id === id);
    }

    // 3. If we have data from either source, format it
    if (sourceData) {
        // Map passed items to receipt items structure
        const items = sourceData.items.map((item: any, index: number) => ({
            id: index,
            name: item.name,
            desc: item.desc || (item.unit === 'weight' ? `${item.weightAmount}${item.weightUnit}` : `${item.quantity} units`),
            qty: item.quantity,
            price: item.price, 
            originalPrice: item.price, 
            img: item.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'
        }));

        const billing = sourceData.pricing;
        
        return {
            id: sourceData.id,
            date: sourceData.placedAt || 'Today',
            deliveredAt: sourceData.completedAt || 'Just now',
            status: sourceData.status === 'completed' ? 'Delivered' : 'Pending', // Simplified status for receipt
            items,
            billing: {
                itemTotal: billing.subtotal,
                tax: billing.gst,
                grandTotal: billing.total,
                platformFee: billing.platformFee,
                netEarnings: billing.total - billing.platformFee,
                paymentStatus: 'Settled',
                method: sourceData.paymentMethod || 'UPI',
                transactionId: `TXN_${Math.floor(Math.random() * 10000000)}`
            },
            customer: sourceData.customer
        };
    }

    // 4. Fallback Mock Data (Only if ID not found in context either)
    const items = [
      { 
        id: 1, 
        name: 'Fresh Farm Milk', 
        desc: '500ml pouch, full cream', 
        qty: 2, 
        price: 32, 
        originalPrice: 32, 
        img: 'https://images.unsplash.com/photo-1635436322965-48ff696e7392?w=100&h=100&fit=crop' 
      },
      { 
        id: 2, 
        name: 'Whole Wheat Bread', 
        desc: '400g loaf, sliced, freshly baked', 
        qty: 1, 
        price: 40, 
        originalPrice: 50, 
        img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop' 
      }
    ];

    const itemTotal = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const tax = Math.round(itemTotal * 0.05);
    const grandTotal = itemTotal + tax;
    const platformFee = Math.round(grandTotal * 0.02);
    const netEarnings = grandTotal - platformFee;

    return {
      id: id || '1023',
      date: 'Oct 24, 2023 at 10:30 AM',
      deliveredAt: 'Oct 24, 2023 at 11:15 AM',
      status: 'Delivered',
      items,
      billing: {
        itemTotal,
        tax,
        grandTotal,
        platformFee,
        netEarnings,
        paymentStatus: 'Settled',
        method: 'UPI',
        transactionId: 'TXN_88392011'
      },
      customer: {
        name: 'Aditya Kumar',
        phone: '+91 98765 43210',
        address: 'Flat 402, Sunshine Apts, Kondapur'
      }
    };
  }, [id, passedOrderData, orders]);

  const handleDownload = () => {
    toast.success('Downloading Invoice...', {
        description: `Invoice_${orderData.id}.pdf has been saved.`
    });
  };

  const handleShare = () => {
    toast.success('Share Link Copied', {
        description: 'Receipt link copied to clipboard.'
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-black">
      
      {/* Header */}
      <div className="sticky top-0 bg-white z-30 px-4 py-4 shadow-sm border-b border-gray-100 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold">Order Summary</h1>
        <button 
            onClick={handleShare}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <Share2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Status Banner */}
        <div className="bg-green-600 text-white px-5 py-6 rounded-b-[2rem] shadow-lg mx-[-1px]">
            <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
                    <CheckCircle className="text-white" size={24} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold mb-1">Order {orderData.status}</h2>
                <p className="text-green-100 text-sm font-medium">{orderData.deliveredAt}</p>
            </div>
        </div>

        <div className="px-4 -mt-6">
            {/* Net Earnings Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 mb-5">
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Net Earnings</p>
                        <p className="text-3xl font-bold text-gray-900">₹{orderData.billing.netEarnings}</p>
                    </div>
                    <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border border-green-100">
                        {orderData.billing.paymentStatus}
                    </div>
                </div>
                
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                        <span>Order Value</span>
                        <span>₹{orderData.billing.grandTotal}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>Platform Fee (2%)</span>
                        <span className="text-red-500">- ₹{orderData.billing.platformFee}</span>
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" />
                    Customer Details
                </h3>
                <div className="pl-6">
                    <p className="font-bold text-gray-900">{orderData.customer.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{orderData.customer.address || 'Address not provided'}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{orderData.customer.phone}</p>
                </div>
            </div>

            {/* Order Items */}
            <div className="mb-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 px-1">Items Ordered ({orderData.items.length})</h3>
                <div className="space-y-3">
                    {orderData.items.map((item) => (
                        <div key={item.id} className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                <img src={item.img} alt={item.name} className="w-full h-full object-cover grayscale" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-semibold text-gray-900 text-sm truncate pr-2">{item.name}</h4>
                                    <p className="font-bold text-gray-900 text-sm">₹{item.price * item.qty}</p>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                    <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">x{item.qty}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-700">Payment Details</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">#{orderData.billing.transactionId}</span>
                </div>
                <div className="p-4 space-y-3">
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Item Total</span>
                        <span className="font-medium">₹{orderData.billing.itemTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taxes</span>
                        <span className="font-medium">₹{orderData.billing.tax}</span>
                    </div>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <div className="flex justify-between text-base font-bold">
                        <span className="text-gray-900">Paid via {orderData.billing.method}</span>
                        <span className="text-gray-900">₹{orderData.billing.grandTotal}</span>
                    </div>
                </div>
            </div>
            
            {/* Help Link */}
            <div className="flex justify-center mb-6">
                 <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors">
                    <HelpCircle size={16} />
                    <span>Report an issue with this order</span>
                 </button>
            </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-[64px] left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-bottom z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
         <div className="max-w-md mx-auto">
            <button 
                onClick={handleDownload}
                className="w-full bg-black text-white h-14 rounded-xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 hover:opacity-90"
            >
                <Download size={20} />
                Download Invoice
            </button>
         </div>
      </div>
    </div>
  );
}
