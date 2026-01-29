import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AuthStep = 'gate' | 'phone' | 'otp';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep>('gate');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length >= 10) {
      setStep('otp');
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join('').length === 4) {
      navigate('/dashboard');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 3) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen p-6 bg-white text-black overflow-hidden relative">
      <AnimatePresence mode="wait">
        
        {/* Screen 1: The Gate */}
        {step === 'gate' && (
          <motion.div
            key="gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-between py-10"
          >
            <div className="mt-20 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center shadow-xl mb-6 rotate-3">
                <Store className="text-white" size={40} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Merchant Hub</h1>
              <p className="text-gray-500 mt-3 text-lg max-w-[200px]">Grow your business with our tools</p>
            </div>

            <div className="space-y-4 mb-8">
              <button
                onClick={() => setStep('phone')}
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Login
                <ArrowRight size={20} />
              </button>
              
              <button
                onClick={() => navigate('/signup')}
                className="w-full bg-white text-black border-2 border-black py-4 rounded-xl font-bold text-lg hover:bg-gray-50 active:scale-95 transition-all"
              >
                Create New Store Account
              </button>
            </div>
          </motion.div>
        )}

        {/* Screen 2: Login Flow - Phone Input */}
        {step === 'phone' && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full justify-center"
          >
            <button 
              onClick={() => setStep('gate')} 
              className="absolute top-6 left-6 p-2 -ml-2 text-gray-500 hover:text-black transition-colors"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
              <p className="text-gray-500">Enter your mobile number to login</p>
            </div>
            
            <form onSubmit={handlePhoneSubmit} className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Mobile Number</label>
                <div className="relative group">
                  <span className="absolute left-4 top-4 text-gray-500 font-medium text-lg border-r border-gray-300 pr-3">+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-20 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-lg font-bold placeholder:font-normal"
                    placeholder="98765 43210"
                    autoFocus
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
              >
                Get OTP
              </button>
            </form>
          </motion.div>
        )}

        {/* Screen 2: Login Flow - OTP Input */}
        {step === 'otp' && (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            <button 
              onClick={() => setStep('phone')} 
              className="absolute top-6 left-6 p-2 -ml-2 text-gray-500 hover:text-black transition-colors"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="mt-20 mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify OTP</h2>
              <p className="text-gray-500">We sent a code to <span className="font-bold text-black">+91 {phone}</span></p>
            </div>

            <form onSubmit={handleOtpSubmit} className="space-y-8">
              <div className="flex justify-between gap-3">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    className="w-16 h-20 text-center text-3xl font-bold bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-black focus:bg-white outline-none transition-all caret-black"
                  />
                ))}
              </div>

              <div className="text-center">
                 <p className="text-gray-500 text-sm">
                   Didn't receive code? <button type="button" className="text-black font-bold underline ml-1">Resend</button>
                 </p>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all mt-8"
              >
                Verify & Login
              </button>
            </form>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
