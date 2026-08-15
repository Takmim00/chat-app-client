'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { toast } from 'sonner';
import { Send, KeyRound, Mail, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

export const OtpLoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  const { setAuth } = useAuthStore();

  const handleRequestOtp = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (data.emailStatus && data.emailStatus.success === false) {
        if (data.emailStatus.isSandboxRestriction) {
          toast.warning('Resend test domain only sends to account email. Use the OTP code below.');
        } else {
          toast.warning(data.emailStatus.message || 'Email delivery failed. Use the OTP code below.');
        }
      } else {
        toast.success('Verification OTP code sent to your email!');
      }

      if (data.devOtp) {
        setDevOtpCode(data.devOtp);
      }
      setStep('otp');
      startResendTimer();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const startResendTimer = () => {
    setResendCountdown(60);
    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter a complete 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchApi('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp, rememberMe }),
      });

      toast.success('Successfully logged in! Welcome to Aurora Messenger.');
      setAuth(data.user, data.token);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed. Check your OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white">
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative blur elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30 overflow-hidden">
            <img src="/logo.png" alt="Aurora Messenger Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent">
            Aurora Messenger
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {step === 'email'
              ? 'Enter your email to receive a secure OTP login code'
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white text-sm placeholder-slate-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] font-semibold text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send OTP Code <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                One-Time OTP Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full pl-12 pr-4 py-3.5 tracking-[0.5em] text-center font-mono text-xl bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600"
                />
              </div>
              {devOtpCode && (
                <div className="mt-3 p-3 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
                  <span>Dev Mode OTP Code:</span>
                  <strong className="font-mono text-sm tracking-widest text-indigo-100">{devOtpCode}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                />
                Remember this session
              </label>

              <button
                type="button"
                disabled={resendCountdown > 0}
                onClick={handleRequestOtp}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 font-medium"
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] font-semibold text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Verify & Login <ShieldCheck className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Change Email Address
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
