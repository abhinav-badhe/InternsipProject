import React, { useState } from 'react';
import { X, Lock, Mail, Phone, User, ShieldCheck, KeyRound, ArrowRight, CheckCircle2, Sparkles, Smartphone, ChevronRight } from 'lucide-react';
import {
  signInCustomer,
  verifyCustomerMfa,
  registerCustomer,
  sendCustomerPhoneOtp,
  verifyCustomerPhoneOtp,
  AuthSession,
} from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Login method: Mobile OTP (default) vs Password
  const [authMode, setAuthMode] = useState<'phone_otp' | 'password'>('phone_otp');
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'form' | 'verify_otp' | 'mfa'>('form');

  // Customer Phone Login Fields
  const [mobileNumber, setMobileNumber] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  const [optionalName, setOptionalName] = useState('');

  // Password Login Fields
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [passwordEmail, setPasswordEmail] = useState('');
  const [passwordPhone, setPasswordPhone] = useState('');
  const [password, setPassword] = useState('');
  const [enableMfa, setEnableMfa] = useState(false);

  // OTP Verification State
  const [otpTicket, setOtpTicket] = useState('');
  const [otpDestination, setOtpDestination] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // MFA State
  const [mfaTicket, setMfaTicket] = useState('');
  const [mfaDestination, setMfaDestination] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpTicket('');
    setOtpCode('');
    setDemoOtp(null);
    setMfaTicket('');
    setMfaOtp('');
  };

  // 1. Send OTP to Mobile Number
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = mobileNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await sendCustomerPhoneOtp({
        phone: cleanNumber,
        email: optionalEmail.trim() || undefined,
        fullName: optionalName.trim() || undefined,
      });

      setOtpTicket(data.ticket);
      setOtpDestination(data.destination);
      setDemoOtp(data.demoOtp || null);
      setStep('verify_otp');
      setSuccessMessage(`OTP sent to ${data.destination}!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Verify OTP and complete login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await verifyCustomerPhoneOtp({
        ticket: otpTicket,
        otp: otpCode,
      });

      setSuccessMessage(`Welcome back, ${session.user.fullName || 'Customer'}! Logging in...`);
      setTimeout(() => {
        onSuccess(session);
        onClose();
        resetState();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Password Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMessage('Please enter your email or phone and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInCustomer(identifier, password);
      if (result.mfaRequired && result.mfaTicket) {
        setMfaTicket(result.mfaTicket);
        setMfaDestination(result.destination || 'your registered contact');
        setDemoOtp(result.demoOtp || null);
        setStep('mfa');
      } else if (result.user && result.token) {
        setSuccessMessage(`Welcome, ${result.user.fullName}!`);
        setTimeout(() => {
          onSuccess({ user: result.user!, token: result.token! });
          onClose();
          resetState();
        }, 500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Password Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !password || (!passwordEmail && !passwordPhone)) {
      setErrorMessage('Full name, password, and at least an email or phone are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await registerCustomer({
        fullName,
        email: passwordEmail || undefined,
        phone: passwordPhone || undefined,
        password,
        enableMfa,
      });
      setSuccessMessage('Account created successfully! Logged in.');
      setTimeout(() => {
        onSuccess(session);
        onClose();
        resetState();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. A user with this contact may already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. MFA Verification
  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaOtp || mfaOtp.length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await verifyCustomerMfa(mfaTicket, mfaOtp);
      setSuccessMessage('Authentication verified!');
      setTimeout(() => {
        onSuccess(session);
        onClose();
        resetState();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60  transition-opacity"
        onClick={() => {
          onClose();
          resetState();
        }}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-y-contain shadow-2xl p-6 sm:p-7 z-10 border border-border">
        {/* Close Button */}
        <button
          onClick={() => {
            onClose();
            resetState();
          }}
          aria-label="Close sign in"
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-left mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-2.5">
            {step === 'verify_otp' || step === 'mfa' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : authMode === 'phone_otp' ? (
              <Smartphone className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">
            {step === 'verify_otp'
              ? 'Verify OTP'
              : step === 'mfa'
              ? 'Multi-Factor Verification'
              : authMode === 'phone_otp'
              ? 'Customer Mobile Login'
              : tab === 'signin'
              ? 'Customer Sign In'
              : 'Create Customer Account'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {step === 'verify_otp'
              ? `Enter the 6-digit verification code sent to ${otpDestination}`
              : step === 'mfa'
              ? `Enter the 6-digit code sent to ${mfaDestination}`
              : authMode === 'phone_otp'
              ? 'Sign in with your mobile number to manage orders and saved addresses.'
              : 'Access your orders, saved cart items, and quick checkout'}
          </p>
        </div>

        {/* Primary Auth Mode Switcher */}
        {step === 'form' && (
          <div className="flex rounded-lg bg-gray-100 p-1 mb-5 text-xs font-semibold">
            <button
              onClick={() => {
                setAuthMode('phone_otp');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'phone_otp'
                  ? 'bg-white text-gray-900 font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>Mobile OTP</span>

            </button>
            <button
              onClick={() => {
                setAuthMode('password');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'password'
                  ? 'bg-white text-gray-900 font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              <span>Email / Password</span>
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 1: MOBILE NUMBER LOGIN (OTP) - PRIMARY REQUESTED FEATURE */}
        {/* ============================================================== */}
        {authMode === 'phone_otp' && step === 'form' && (
          <form onSubmit={handleRequestOtp} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mobile Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="flex rounded-lg border border-gray-300 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary overflow-hidden bg-white">
                <span className="inline-flex items-center px-3 bg-gray-50 text-gray-600 text-xs font-bold border-r border-gray-200">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  required
                  autoFocus
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 text-xs bg-white focus:outline-none font-medium"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">We will send a 6-digit OTP code to verify your mobile number.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="e.g. name@example.com"
                  value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Optional — receive digital invoices and delivery receipts.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Your Name <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={optionalName}
                  onChange={(e) => setOptionalName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || mobileNumber.length < 10}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-3"
            >
              {isLoading ? 'Sending Code...' : 'Continue with Mobile Number'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* ============================================================== */}
        {/* STEP: VERIFY MOBILE OTP */}
        {/* ============================================================== */}
        {step === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-center">
                Enter 6-Digit OTP Code
              </label>
              <div className="relative max-w-[220px] mx-auto">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-9 pr-3 py-2.5 text-center text-lg tracking-widest font-mono font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {demoOtp && (
              <div
                onClick={() => setOtpCode(demoOtp)}
                className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center cursor-pointer hover:bg-emerald-100/70 transition-colors"
                title="Click to auto-fill sandbox verification code"
              >
                <span className="text-[11px] text-emerald-800">
                  Instant Test Code: <strong className="font-mono text-xs">{demoOtp}</strong> (Click to auto-fill)
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
              >
                Change Number
              </button>
              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* MODE 2: EMAIL / PASSWORD */}
        {/* ============================================================== */}
        {authMode === 'password' && step === 'form' && (
          <>
            <div className="flex rounded-md bg-gray-100 p-0.5 mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => { setTab('signin'); setErrorMessage(null); }}
                className={`flex-1 py-1 rounded transition-all cursor-pointer ${tab === 'signin' ? 'bg-white text-gray-900 font-bold' : 'text-gray-500'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMessage(null); }}
                className={`flex-1 py-1 rounded transition-all cursor-pointer ${tab === 'register' ? 'bg-white text-gray-900 font-bold' : 'text-gray-500'}`}
              >
                Create Account
              </button>
            </div>

            {tab === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email address or Phone
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. customer@example.com or +919876543210"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-4"
                >
                  {isLoading ? 'Verifying...' : 'Sign In'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="priya@example.com"
                      value={passwordEmail}
                      onChange={(e) => setPasswordEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={passwordPhone}
                      onChange={(e) => setPasswordPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-4"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Registration'}
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* STEP: PASSWORD 2FA / MFA CHALLENGE */}
        {/* ============================================================== */}
        {step === 'mfa' && (
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 text-center">
                6-Digit Security Code
              </label>
              <div className="relative max-w-[200px] mx-auto">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="123456"
                  value={mfaOtp}
                  onChange={(e) => setMfaOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-9 pr-3 py-2.5 text-center text-lg tracking-widest font-mono font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {demoOtp && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[11px] text-emerald-800">
                  Demo Sandbox OTP: <strong className="font-mono text-xs">{demoOtp}</strong>
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || mfaOtp.length < 6}
                className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
          </form>
        )}

        {/* Footer: Shopkeeper / Store Admin Notice */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-500">
            Store Owner or Shopkeeper?{' '}
            <a
              href={((import.meta as any).env?.VITE_SELLER_HUB_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://internsip-project-det6.vercel.app' : 'http://localhost:5174/'))}
              target="_blank"
              rel="noreferrer"
              className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Access Seller Hub</span>
              <ChevronRight className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
