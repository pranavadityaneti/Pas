import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function StoreTimings() {
  const navigate = useNavigate();
  const [timings, setTimings] = useState({
    open: '09:00',
    close: '21:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  });

  const handleSave = () => {
    toast.success('Store timings updated successfully');
    navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black pb-24">
      <div className="sticky top-0 bg-white z-10 px-4 py-4 shadow-sm border-b border-gray-100 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
            <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Store Timings</h1>
      </div>

      <div className="p-5 flex-1">
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
                    <Clock size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Operating Hours</h3>
                    <p className="text-xs text-gray-500">Set your store's opening and closing time</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Opens At</label>
                    <input 
                        type="time" 
                        value={timings.open}
                        onChange={(e) => setTimings({...timings, open: e.target.value})}
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-bold text-lg focus:outline-none focus:border-black transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Closes At</label>
                    <input 
                        type="time" 
                        value={timings.close}
                        onChange={(e) => setTimings({...timings, close: e.target.value})}
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-bold text-lg focus:outline-none focus:border-black transition-colors"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">Open Days</label>
                <div className="flex flex-wrap gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <button
                            key={day}
                            className="w-10 h-10 rounded-lg bg-black text-white font-bold text-xs flex items-center justify-center shadow-sm"
                        >
                            {day[0]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      <div className="p-5">
        <button 
            onClick={handleSave}
            className="w-full bg-black text-white h-14 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
            <Save size={20} />
            Save Changes
        </button>
      </div>
    </div>
  );
}