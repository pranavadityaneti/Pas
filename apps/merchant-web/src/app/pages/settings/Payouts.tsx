import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Building2, CreditCard, AlertCircle } from 'lucide-react';

export default function Payouts() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-white text-black pb-24">
      <div className="sticky top-0 bg-white z-10 px-4 py-4 shadow-sm border-b border-gray-100 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Payouts & Bank</h1>
      </div>

      <div className="p-5 flex-1">
        {/* Current Balance Card */}
        <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-2xl p-6 shadow-xl mb-8">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">Unsettled Balance</p>
            <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold">₹8,450.00</span>
                <span className="text-gray-500 text-sm">pending</span>
            </div>
            
            <div className="flex gap-3">
                <div className="flex-1 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-[10px] text-gray-400 uppercase">Next Payout</p>
                    <p className="font-bold text-sm mt-0.5">Tomorrow, 10 AM</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                    <p className="text-[10px] text-gray-400 uppercase">Frequency</p>
                    <p className="font-bold text-sm mt-0.5">Daily (T+1)</p>
                </div>
            </div>
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-4 px-1">Linked Bank Account</h3>
        
        <div className="bg-white border-2 border-green-500 bg-green-50/30 rounded-xl p-5 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                PRIMARY
            </div>
            
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-2">
                    <Building2 className="text-gray-700" />
                </div>
                <div>
                    <h4 className="font-bold text-gray-900">HDFC Bank</h4>
                    <p className="text-sm text-gray-500">**** **** **** 8821</p>
                </div>
            </div>
            
            <div className="flex gap-4 text-xs text-gray-500 border-t border-green-100 pt-3">
                <div>
                    <span className="block font-bold text-gray-700">IFSC Code</span>
                    <span>HDFC0001234</span>
                </div>
                <div>
                    <span className="block font-bold text-gray-700">Beneficiary</span>
                    <span>Rahul Sharma</span>
                </div>
            </div>
        </div>

        <button className="w-full border border-gray-300 rounded-xl py-4 flex items-center justify-center gap-2 font-bold text-gray-700 hover:bg-gray-50 transition-colors">
            <CreditCard size={18} />
            Change Bank Account
        </button>
        
        <div className="mt-6 flex gap-2 text-gray-400 text-xs px-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>Changing bank account requires OTP verification and may pause payouts for 24-48 hours for security verification.</p>
        </div>
      </div>
    </div>
  );
}