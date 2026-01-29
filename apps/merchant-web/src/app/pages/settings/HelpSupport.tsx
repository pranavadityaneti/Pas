import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Phone, Mail, FileText, ChevronRight } from 'lucide-react';

export default function HelpSupport() {
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
        <h1 className="text-xl font-bold">Help & Support</h1>
      </div>

      <div className="p-5 flex-1">
        <div className="bg-black text-white rounded-2xl p-6 mb-8 text-center shadow-lg">
            <h2 className="text-xl font-bold mb-2">How can we help?</h2>
            <p className="text-gray-400 text-sm mb-6">Our support team is available 24/7 to assist you with any issues.</p>
            <button className="bg-white text-black px-6 py-3 rounded-xl font-bold text-sm w-full flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <MessageCircle size={18} />
                Start Live Chat
            </button>
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-4 px-1">Contact Us</h3>
        
        <div className="space-y-3 mb-8">
            <a href="tel:+919876543210" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Phone size={20} className="text-gray-700" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-gray-900">Call Support</p>
                    <p className="text-xs text-gray-500">+91 98765 43210</p>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
            </a>

            <a href="mailto:support@pickatstore.com" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Mail size={20} className="text-gray-700" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-gray-900">Email Us</p>
                    <p className="text-xs text-gray-500">support@pickatstore.com</p>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
            </a>
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-4 px-1">Common Topics</h3>
        <div className="space-y-2">
            {['Payment Settlements', 'Order Cancellation Policy', 'Updating Store Menu', 'Device Issues'].map((topic, i) => (
                <button key={i} className="w-full text-left p-4 border-b border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-medium text-gray-700">{topic}</span>
                    <ChevronRight size={16} className="text-gray-300" />
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}