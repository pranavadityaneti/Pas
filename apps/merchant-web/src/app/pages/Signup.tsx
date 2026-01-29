import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Upload, 
  Check, 
  Clock, 
  Plus, 
  Trash2, 
  ChevronDown,
  ChevronRight,
  MapPin,
  Map as MapIcon,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useStore } from '../context/StoreContext';

type SignupStep = 1 | 2 | 3;

interface Branch {
  id: string;
  name: string;
  phone: string;
  address: string;
}

const MOCK_MAP_IMAGE = "https://images.unsplash.com/photo-1542382257-80dedb725088?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXR5JTIwbWFwJTIwdmlldyUyMHRvcCUyMGRvd258ZW58MXx8fHwxNzY4ODAyMzMwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export default function Signup() {
  const navigate = useNavigate();
  const { addStore } = useStore();
  const [step, setStep] = useState<SignupStep>(1);
  const [showMap, setShowMap] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '+91 98765 43210', // Simulating auto-filled
    homeAddress: '',
    storeName: '',
    storeType: 'Grocery',
    storeAddress: '',
    hasBranches: false,
    branches: [] as Branch[],
  });

  const [documents, setDocuments] = useState<Record<string, boolean>>({
    aadhar: false,
    pan: false,
    gst: false,
    udyam: false,
    other: false,
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addBranch = () => {
    setFormData(prev => ({
      ...prev,
      branches: [...prev.branches, { 
        id: Math.random().toString(), 
        name: '', 
        phone: '', 
        address: '' 
      }]
    }));
  };

  const updateBranch = (id: string, field: keyof Branch, value: string) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === id ? { ...b, [field]: value } : b)
    }));
  };

  const removeBranch = (id: string) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches.filter(b => b.id !== id)
    }));
  };

  const toggleDocument = (docKey: string) => {
    setDocuments(prev => ({ ...prev, [docKey]: !prev[docKey] }));
  };

  const handleNext = () => {
    setStep(prev => (prev < 3 ? prev + 1 : prev) as SignupStep);
  };

  const handleBack = () => {
    if (step === 1) navigate('/login');
    else setStep(prev => (prev - 1) as SignupStep);
  };

  const handleLocationConfirm = () => {
    setFormData(prev => ({
      ...prev,
      storeAddress: "Plot 102, Hitech City Main Rd, Hyderabad, Telangana 500081"
    }));
    setShowMap(false);
    toast.success("Location pinned successfully!");
  };

  const handleCompleteSignup = () => {
    // Add the new store to context
    const newStoreId = `store-${Date.now()}`;
    addStore({
      id: newStoreId,
      name: formData.storeName || 'New Store',
      type: formData.storeType,
      location: 'Hyderabad',
      isOnline: true,
      metrics: {
        sales: '₹0',
        orders: '0',
        pending: '0',
        processing: '0',
        delivered: '0',
        cancelled: '0',
        earnings: '₹0'
      },
      recentActivity: []
    });
    
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black overflow-hidden relative">
      {/* Header */}
      {step < 3 && !showMap && (
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white z-10">
          <button 
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold">
              {step === 1 ? 'Personal & Store Info' : 'KYC Verification'}
            </h1>
            <div className="flex gap-1 mt-1">
              <div className={clsx("h-1 w-8 rounded-full transition-colors", step >= 1 ? "bg-black" : "bg-gray-200")} />
              <div className={clsx("h-1 w-8 rounded-full transition-colors", step >= 2 ? "bg-black" : "bg-gray-200")} />
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      <AnimatePresence>
        {showMap && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="absolute inset-0 z-50 bg-white flex flex-col"
          >
            <div className="absolute top-4 left-4 z-10">
              <button 
                onClick={() => setShowMap(false)}
                className="p-3 bg-white shadow-md rounded-full"
              >
                <ArrowLeft size={24} />
              </button>
            </div>
            
            <div className="flex-1 relative bg-gray-200 overflow-hidden">
               <img 
                 src={MOCK_MAP_IMAGE} 
                 alt="Map" 
                 className="w-full h-full object-cover opacity-80"
               />
               
               {/* Center Pin */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-8 flex flex-col items-center">
                 <MapPin size={48} className="text-black fill-black drop-shadow-lg" />
                 <div className="w-3 h-3 bg-black/50 rounded-full blur-[2px] mt-[-2px]" />
               </div>

               {/* Mock Controls */}
               <div className="absolute bottom-32 right-4 flex flex-col gap-3">
                 <button className="p-3 bg-white shadow-lg rounded-full">
                   <Navigation size={24} className="text-blue-600" />
                 </button>
               </div>
            </div>

            <div className="p-6 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] -mt-6 relative z-10">
               <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
               <h3 className="font-bold text-lg mb-1">Select Store Location</h3>
               <p className="text-gray-500 text-sm mb-6">Move the map to place the pin on your store's entrance.</p>
               
               <button 
                 onClick={handleLocationConfirm}
                 className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
               >
                 Confirm Location
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* Step 1: Personal & Store Basic */}
          {step === 1 && !showMap && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 pb-32"
            >
              <h2 className="text-2xl font-bold mb-6">Tell us about your Business</h2>
              
              <div className="space-y-6">
                {/* Personal Info Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Your Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-black focus:border-black outline-none"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      readOnly
                      className="w-full p-4 bg-gray-100 border border-gray-200 rounded-xl font-medium text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Home Address</label>
                    <textarea
                      value={formData.homeAddress}
                      onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-black focus:border-black outline-none resize-none h-24"
                      placeholder="Enter your residential address"
                    />
                  </div>
                </div>

                <div className="h-px bg-gray-100 my-4" />

                {/* Store Info Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Store Name</label>
                    <input
                      type="text"
                      value={formData.storeName}
                      onChange={(e) => handleInputChange('storeName', e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:ring-1 focus:ring-black focus:border-black outline-none"
                      placeholder="e.g. Rahul's Supermarket"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Store Type</label>
                    <div className="relative">
                      <select
                        value={formData.storeType}
                        onChange={(e) => handleInputChange('storeType', e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium appearance-none focus:ring-1 focus:ring-black focus:border-black outline-none"
                      >
                        <option value="Grocery">Grocery & Kirana</option>
                        <option value="Restaurant">Restaurant & Cafe</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Fashion">Fashion & Clothing</option>
                        <option value="Pharmacy">Pharmacy</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Store Address</label>
                    <div className="relative">
                      <textarea
                        value={formData.storeAddress}
                        onChange={(e) => handleInputChange('storeAddress', e.target.value)}
                        className="w-full p-4 pb-12 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-black focus:border-black outline-none resize-none h-28"
                        placeholder="Enter your main store address"
                      />
                      <button 
                        onClick={() => setShowMap(true)}
                        className="absolute bottom-3 right-3 bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold text-black hover:bg-gray-50 transition-colors"
                      >
                        <MapIcon size={14} />
                        Locate on Map
                      </button>
                    </div>
                  </div>

                  {/* Multiple Branches Toggle */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">Do you have multiple branches?</span>
                      <button 
                        onClick={() => handleInputChange('hasBranches', !formData.hasBranches)}
                        className={clsx(
                          "w-12 h-7 rounded-full transition-colors relative",
                          formData.hasBranches ? "bg-black" : "bg-gray-300"
                        )}
                      >
                        <div className={clsx(
                          "w-5 h-5 bg-white rounded-full absolute top-1 transition-transform shadow-sm",
                          formData.hasBranches ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>
                    
                    {formData.hasBranches && (
                      <div className="mt-6 space-y-4">
                        {formData.branches.map((branch, idx) => (
                          <div key={branch.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-fade-in relative group">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Branch #{idx + 1}</span>
                              <button
                                onClick={() => removeBranch(branch.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={branch.name}
                                onChange={(e) => updateBranch(branch.id, 'name', e.target.value)}
                                placeholder="Branch Name (e.g. Gachibowli)"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-black outline-none"
                              />
                              <input
                                type="tel"
                                value={branch.phone}
                                onChange={(e) => updateBranch(branch.id, 'phone', e.target.value)}
                                placeholder="Branch Phone Number"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-black outline-none"
                              />
                              <textarea
                                value={branch.address}
                                onChange={(e) => updateBranch(branch.id, 'address', e.target.value)}
                                placeholder="Branch Address"
                                rows={2}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-black outline-none resize-none"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={addBranch}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-400 transition-all"
                        >
                          <Plus size={18} />
                          Add Branch
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: KYC Documents */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 pb-32"
            >
              <h2 className="text-2xl font-bold mb-2">Verify Your Business</h2>
              <p className="text-gray-500 mb-6">Upload clear photos of your documents.</p>

              <div className="space-y-4">
                {[
                  { id: 'aadhar', label: 'Aadhar Card (Front/Back)' },
                  { id: 'pan', label: 'PAN Card' },
                  { id: 'gst', label: 'GST Certificate' },
                  { id: 'udyam', label: 'UDYAM Registration' },
                  { id: 'other', label: 'Other Docs (Optional)' },
                ].map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => toggleDocument(doc.id)}
                    className={clsx(
                      "w-full p-4 rounded-xl border-2 border-dashed flex items-center gap-4 transition-all",
                      documents[doc.id] 
                        ? "bg-green-50 border-green-500" 
                        : "bg-gray-50 border-gray-300 hover:border-gray-400"
                    )}
                  >
                    <div className={clsx(
                      "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                      documents[doc.id] ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"
                    )}>
                      {documents[doc.id] ? <Check size={24} /> : <Camera size={24} />}
                    </div>
                    
                    <div className="flex-1 text-left">
                      <span className={clsx(
                        "block font-bold",
                        documents[doc.id] ? "text-green-800" : "text-gray-900"
                      )}>
                        {doc.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {documents[doc.id] ? "Uploaded successfully" : "Tap to upload"}
                      </span>
                    </div>

                    {!documents[doc.id] && <Upload size={20} className="text-gray-400" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center"
            >
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 animate-bounce-slow">
                <Clock size={48} />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
              <p className="text-gray-500 max-w-xs mx-auto mb-10">
                Your application is under review. We will verify your documents within 24 hours.
              </p>

              <button
                onClick={handleCompleteSignup}
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
              >
                Go to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Buttons */}
      {step < 3 && !showMap && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-10">
          <button
            onClick={handleNext}
            className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {step === 1 ? (
              <>
                Next: Upload Documents
                <ChevronRight size={20} />
              </>
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
