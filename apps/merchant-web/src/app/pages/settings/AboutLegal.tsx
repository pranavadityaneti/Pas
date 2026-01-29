import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, ExternalLink } from 'lucide-react';

export default function AboutLegal() {
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
        <h1 className="text-xl font-bold">About & Legal</h1>
      </div>

      <div className="p-5 flex-1">
        <div className="flex flex-col items-center mb-10 mt-4">
            <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-xl">
                PAS
            </div>
            <h2 className="text-xl font-bold text-gray-900">Pick At Store</h2>
            <p className="text-gray-500 text-sm">Merchant App v1.2.0</p>
        </div>

        <div className="space-y-4">
            {[
                { label: 'Terms of Service', link: '#' },
                { label: 'Privacy Policy', link: '#' },
                { label: 'Merchant Agreement', link: '#' },
                { label: 'Open Source Licenses', link: '#' },
            ].map((item, idx) => (
                <a 
                    key={idx}
                    href={item.link}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <FileText size={18} className="text-gray-500" />
                        <span className="font-bold text-gray-700 text-sm">{item.label}</span>
                    </div>
                    <ExternalLink size={16} className="text-gray-400" />
                </a>
            ))}
        </div>

        <div className="mt-12 text-center">
            <p className="text-xs text-gray-400">© 2026 Pick At Store Inc.</p>
            <p className="text-xs text-gray-400 mt-1">Made with ❤️ in Hyderabad</p>
        </div>
      </div>
    </div>
  );
}