import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ArrowLeft } from 'lucide-react';

export default function VerifyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = location.state?.mobile || 'your number';
  const [otp, setOtp] = useState('');

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 4) {
      navigate('/branch-select');
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-white">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 left-4"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-6 h-6" />
      </Button>

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-xs mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Verify Details</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 4-digit OTP sent to <span className="font-semibold text-gray-900">+91 {mobile}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="w-full space-y-6">
          <div className="flex justify-center">
            <Input
              type="text"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-40 text-center text-3xl tracking-[1em] font-bold h-16 border-2 focus-visible:ring-0 focus-visible:border-blue-600"
              placeholder="••••"
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={otp.length !== 4}>
            Verify & Continue
          </Button>

          <div className="text-center">
            <Button variant="link" className="text-sm text-blue-600" type="button">
              Resend OTP
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
