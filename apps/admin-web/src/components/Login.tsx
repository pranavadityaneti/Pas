import { useState } from 'react';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function Login() {
  const { login, loading: authLoading } = useAuth();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
    }

    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setResetError(error.message);
    } else {
      setResetSent(true);
    }

    setResetLoading(false);
  };

  const backToLogin = () => {
    setShowForgotPassword(false);
    setResetSent(false);
    setResetEmail('');
    setResetError(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100 p-4 lg:p-6">
      {/* Left Panel - Gradient with Brand (with padding and rounded corners) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden rounded-3xl m-2"
        style={{
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 25%, #ffcc33 50%, #ff6b35 75%, #e55d30 100%)',
        }}
      >
        {/* Decorative blur circles */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-orange-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-yellow-200/15 rounded-full blur-2xl"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl font-bold">P</span>
            </div>
            <span className="text-2xl font-semibold">PickAtStore</span>
          </div>

          {/* Tagline */}
          <div className="max-w-lg">
            <p className="text-white/80 text-base mb-4">Super Admin Portal</p>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Command your retail ecosystem with precision.
            </h1>
            <p className="text-white/70 text-xl">
              Manage merchants, monitor orders, and drive growth from one powerful dashboard.
            </p>
          </div>

          {/* Footer */}
          <p className="text-white/60 text-sm">
            © 2024 PickAtStore. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white rounded-3xl m-2 shadow-sm">
        <div className="w-full max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">P</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900">PickAtStore</span>
          </div>

          {showForgotPassword ? (
            // Forgot Password Form
            <div>
              <button
                onClick={backToLogin}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to login</span>
              </button>

              {resetSent ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Check your email</h2>
                  <p className="text-gray-500 text-lg mb-8">
                    We've sent a password reset link to<br />
                    <strong className="text-gray-700">{resetEmail}</strong>
                  </p>
                  <button
                    onClick={backToLogin}
                    className="text-orange-600 hover:text-orange-700 font-medium text-lg"
                  >
                    Return to login
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mb-8">
                    <Mail className="w-7 h-7 text-white" />
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Forgot password?</h2>
                  <p className="text-gray-500 text-lg mb-10">
                    No worries, we'll send you reset instructions.
                  </p>

                  {resetError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{resetError}</p>
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-3">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="admin@pickatstore.com"
                          className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50/50 transition-all"
                          required
                          disabled={resetLoading}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-gray-900 text-white py-4 rounded-xl hover:bg-gray-800 transition-all font-medium text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send reset link'
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            // Login Form
            <>
              {/* Icon */}
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mb-8">
                <span className="text-2xl">✦</span>
              </div>

              {/* Heading */}
              <h2 className="text-4xl font-bold text-gray-900 mb-3">Welcome back</h2>
              <p className="text-gray-500 text-lg mb-10">
                Log in to access your admin dashboard
              </p>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-3">
                    Your email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@pickatstore.com"
                      className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50/50 transition-all"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-3">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-gray-50/50 transition-all"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 text-white py-4 rounded-xl hover:bg-gray-800 transition-all font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Log in'
                  )}
                </button>
              </form>

              {/* Forgot Password */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="text-base text-orange-600 hover:text-orange-700 font-medium"
                >
                  Forgot your password?
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
