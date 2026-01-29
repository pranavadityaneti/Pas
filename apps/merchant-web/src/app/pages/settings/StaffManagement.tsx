import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffManagement() {
  const navigate = useNavigate();

  const handleAddStaff = () => {
    toast.info('Feature coming soon: Invite staff members via SMS');
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
        <h1 className="text-xl font-bold">Staff Management</h1>
      </div>

      <div className="p-5 flex-1">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3">
            <Shield className="text-blue-600 flex-shrink-0" size={24} />
            <div>
                <h3 className="font-bold text-blue-900 text-sm">Owner Access</h3>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">You are logged in as the Store Owner. You have full access to all settings and financial data.</p>
            </div>
        </div>

        <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="font-bold text-lg text-gray-900">Staff Members</h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">2 Active</span>
        </div>

        <div className="space-y-3">
            {[
                { name: 'Raju Kumar', role: 'Store Manager', phone: '+91 98XXX XXXXX' },
                { name: 'Suresh P.', role: 'Delivery Associate', phone: '+91 87XXX XXXXX' }
            ].map((staff, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm">
                            {staff.name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.role} • {staff.phone}</p>
                        </div>
                    </div>
                    <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div className="p-5">
        <button 
            onClick={handleAddStaff}
            className="w-full bg-black text-white h-14 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
            <UserPlus size={20} />
            Add New Staff
        </button>
      </div>
    </div>
  );
}