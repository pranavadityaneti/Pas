import { useState, useEffect } from 'react';
import { Lock, Check, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle, Instagram, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import loginBg from '../assets/Admin Dashboard Login BG.jpg';
import pasLogo from '../assets/PAS_Logo-Horizontal-White.png';

const BRAND_RED = '#b42926';

export function Login() {
  const { login, sendAdminOtp, loginWithOtp, loading: authLoading } = useAuth();

  // Primary login method: WhatsApp OTP. Fallback: email/password.
  const [mode, setMode] = useState<'otp' | 'email'>('otp');

  // OTP state
  const [phone, setPhone] = useState('');     // 10 digits (no country code)
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Email fallback state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const fullPhone = () => `91${phone.replace(/\D/g, '')}`;
  const phoneComplete = phone.replace(/\D/g, '').length === 10;
  const otpComplete = otp.replace(/\D/g, '').length === 6;

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setIsSubmitting(true);
    const { error } = await sendAdminOtp(fullPhone());
    if (error) setError(error);
    else { setOtpSent(true); setResendTimer(30); }
    setIsSubmitting(false);
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (otp.replace(/\D/g, '').length < 6) {
      setError('Enter the 6-digit OTP sent to your WhatsApp');
      return;
    }
    setIsSubmitting(true);
    const { error } = await loginWithOtp(fullPhone(), otp.replace(/\D/g, ''));
    if (error) setError(error);
    setIsSubmitting(false);
  };

  // Routes Enter / form submit to the right action for the current stage.
  const handleOtpFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      if (phoneComplete) handleSendOtp();
    } else if (otpComplete) {
      handleVerifyOtp();
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(email, password);
    if (result.error) setError(result.error);
    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setResetError(error.message);
    else setResetSent(true);
    setResetLoading(false);
  };

  const onPhoneChange = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 10);
    setPhone(v);
    setError(null);
    if (otpSent) { setOtpSent(false); setOtp(''); setResendTimer(0); }
  };

  const backToLogin = () => {
    setShowForgotPassword(false);
    setResetSent(false);
    setResetEmail('');
    setResetError(null);
  };

  const switchMode = (next: 'otp' | 'email') => {
    setMode(next);
    setError(null);
    setOtpSent(false);
    setOtp('');
    setResendTimer(0);
  };

  // Shared field styling — rounded-square white field that floats on the photo.
  const pill =
    'h-[52px] rounded-2xl bg-white shadow-[0_10px_34px_rgba(0,0,0,0.22)] ' +
    'border border-white/50 outline-none text-[15px] text-gray-800 placeholder:text-gray-400 ' +
    'focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all';

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Blackened blur layer — subtle 15% darkening + blur over the photo */}
      <div className="absolute inset-0 bg-black/15 backdrop-blur-md" />

      {authLoading ? (
        <Loader2 className="w-9 h-9 animate-spin text-white relative z-10" />
      ) : (
        <div className="relative z-10 w-full max-w-3xl px-6 flex flex-col items-center">
          {/* Logo */}
          <img
            src={pasLogo}
            alt="Pick At Store"
            className="h-12 md:h-14 w-auto mb-14 drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] select-none"
            draggable={false}
          />

          {/* Inline error */}
          {error && (
            <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/90 backdrop-blur-sm shadow-lg">
              <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
              <p className="text-sm text-white font-medium">{error}</p>
            </div>
          )}

          {showForgotPassword ? (
            /* ---------- Forgot password ---------- */
            <div className="w-full max-w-md flex flex-col items-center">
              {resetSent ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/95 flex items-center justify-center mx-auto mb-5 shadow-lg">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2 drop-shadow">Check your email</h2>
                  <p className="text-white/80 mb-6 drop-shadow">
                    Reset link sent to <strong className="text-white">{resetEmail}</strong>
                  </p>
                  <button onClick={backToLogin} className="text-white font-medium underline underline-offset-4 hover:opacity-80">
                    Return to login
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-white mb-2 drop-shadow">Reset password</h2>
                  <p className="text-white/80 mb-7 text-center drop-shadow">We'll email you reset instructions.</p>
                  {resetError && <p className="mb-4 text-sm text-red-200">{resetError}</p>}
                  <form onSubmit={handleForgotPassword} className="w-full flex flex-col items-center gap-3">
                    <div className="relative w-full">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@pickatstore.io"
                        className={`${pill} w-full pl-12 pr-5`}
                        required
                        disabled={resetLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="h-[52px] w-full rounded-2xl text-white font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                      style={{ backgroundColor: BRAND_RED }}
                    >
                      {resetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                    </button>
                  </form>
                  <button onClick={backToLogin} className="mt-6 flex items-center gap-1.5 text-white/75 hover:text-white text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to login
                  </button>
                </>
              )}
            </div>
          ) : mode === 'otp' ? (
            /* ---------- WhatsApp OTP (primary) ---------- */
            <>
              <form onSubmit={handleOtpFormSubmit} className="flex items-center justify-center gap-3">
                {/* Phone pill */}
                <div className={`relative transition-all duration-500 ${phoneComplete ? 'w-52' : 'w-80'}`}>
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 text-[15px] select-none">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    placeholder="WhatsApp number"
                    className={`${pill} w-full pl-14 pr-5 tracking-wide`}
                    disabled={isSubmitting}
                  />
                </div>

                {/* OTP + submit — slides in once the number is complete */}
                <div
                  className={`flex items-center gap-3 transition-all duration-500 ${
                    phoneComplete
                      ? 'opacity-100 translate-x-0 max-w-[260px]'
                      : 'opacity-0 -translate-x-4 max-w-0 overflow-hidden pointer-events-none'
                  }`}
                >
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                    placeholder={otpSent ? 'Code' : 'OTP'}
                    className={`${pill} w-44 px-5 ${otp ? 'tracking-[0.35em]' : 'tracking-normal'} text-center placeholder:tracking-normal`}
                    disabled={!otpSent || isSubmitting}
                  />
                  <button
                    type="submit"
                    aria-label="Verify and log in"
                    disabled={!otpSent || !otpComplete || isSubmitting}
                    className="h-[52px] w-[52px] rounded-2xl flex items-center justify-center text-white shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all disabled:cursor-not-allowed"
                    style={{ backgroundColor: !otpSent || !otpComplete || isSubmitting ? 'rgba(255,255,255,0.35)' : BRAND_RED }}
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : otpComplete ? <Check className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
              </form>

              {/* Send / resend affordance */}
              <div className="h-6 mt-5 flex items-center justify-center">
                {phoneComplete && !otpSent && (
                  <button
                    onClick={() => handleSendOtp()}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 text-white font-semibold text-sm hover:opacity-80 disabled:opacity-50 drop-shadow"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                )}
                {otpSent && (
                  <p className="text-white/80 text-sm drop-shadow">
                    Code sent to +91 {phone}.{' '}
                    {resendTimer > 0 ? (
                      <span className="text-white/55">Resend in {resendTimer}s</span>
                    ) : (
                      <button onClick={() => handleSendOtp()} className="text-white font-semibold underline underline-offset-4 hover:opacity-80">
                        Resend
                      </button>
                    )}
                  </p>
                )}
              </div>

              {/* Email fallback */}
              <button
                onClick={() => switchMode('email')}
                className="mt-8 text-white/70 hover:text-white text-sm transition-colors drop-shadow"
              >
                Prefer email? <span className="underline underline-offset-4">Sign in with email</span>
              </button>
            </>
          ) : (
            /* ---------- Email / password (fallback) ---------- */
            <form onSubmit={handleEmailLogin} className="w-full max-w-md flex flex-col items-center gap-3">
              <div className="relative w-full">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pickatstore.io"
                  className={`${pill} w-full pl-12 pr-5`}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="relative w-full">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`${pill} w-full pl-12 pr-5`}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-[52px] w-full rounded-2xl text-white font-semibold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: BRAND_RED }}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log in'}
              </button>
              <div className="flex items-center gap-4 mt-2">
                <button type="button" onClick={() => switchMode('otp')} className="text-white/70 hover:text-white text-sm transition-colors drop-shadow">
                  Use WhatsApp OTP
                </button>
                <span className="text-white/40">·</span>
                <button type="button" onClick={() => setShowForgotPassword(true)} className="text-white/70 hover:text-white text-sm transition-colors drop-shadow">
                  Forgot password?
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-7 left-0 right-0 z-10 flex flex-col items-center gap-3">
        <a
          href="https://www.instagram.com/pickatstore.in/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pick At Store on Instagram"
          className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white/85 hover:bg-white/25 hover:text-white transition-all"
        >
          <Instagram className="w-4 h-4" />
        </a>
        <p className="text-white/65 text-xs tracking-wide drop-shadow">© 2026 PAS Retail Networks</p>
      </div>
    </div>
  );
}
