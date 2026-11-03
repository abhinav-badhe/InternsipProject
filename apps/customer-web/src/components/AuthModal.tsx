import React, { useState } from 'react';
import { X, Lock, Mail, Phone, User, ShieldCheck, KeyRound, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { signInCustomer, verifyCustomerMfa, registerCustomer, AuthSession } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [enableMfa, setEnableMfa] = useState(false);

  // MFA State
  const [mfaTicket, setMfaTicket] = useState('');
  const [mfaDestination, setMfaDestination] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('credentials');
    setErrorMessage(null);
    setSuccessMessage(null);
    setMfaTicket('');
    setMfaOtp('');
    setDemoOtp(null);
  };

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
        onSuccess({ user: result.user, token: result.token });
        onClose();
        resetState();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !password || (!email && !phone)) {
      setErrorMessage('Full name, password, and at least an email or phone are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await registerCustomer({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
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
      setSuccessMessage('Two-Factor Authentication verified!');
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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          onClose();
          resetState();
        }}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 sm:p-7 z-10 border border-gray-100 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => {
            onClose();
            resetState();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#007a55]/10 text-[#007a55] mb-2.5">
            {step === 'mfa' ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">
            {step === 'mfa'
              ? 'Multi-Factor Authentication (MFA)'
              : tab === 'signin'
              ? 'Sign in to FreshCart'
              : 'Create Customer Account'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {step === 'mfa'
              ? `Enter the 6-digit security code sent to ${mfaDestination}`
              : tab === 'signin'
              ? 'Access your orders, fast 30-min checkout, and saved preferences'
              : 'Join FreshCart for verified FEFO fresh groceries & WhatsApp sync'}
          </p>
        </div>

        {/* Tab Switcher (Only visible in credentials step) */}
        {step === 'credentials' && (
          <div className="flex rounded-lg bg-gray-100 p-1 mb-5 text-xs font-semibold">
            <button
              onClick={() => {
                setTab('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                tab === 'signin'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Create Account
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

        {/* STEP 1: CREDENTIALS */}
        {step === 'credentials' && (
          <>
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
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
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
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-4"
                >
                  {isLoading ? 'Verifying...' : 'Sign In'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="priya@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Phone Number (for WhatsApp Orders)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
                    />
                  </div>
                </div>

                {/* MFA Option Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableMfa}
                      onChange={(e) => setEnableMfa(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#007a55] focus:ring-[#007a55] cursor-pointer"
                    />
                    <div className="text-xs text-gray-700">
                      <span className="font-semibold block text-gray-900">Enable Two-Factor Authentication (MFA / 2FA)</span>
                      <span className="text-[11px] text-gray-500">
                        Requires a 6-digit verification code on sign in for enhanced protection.
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-4"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Registration'}
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </>
        )}

        {/* STEP 2: MFA OTP VERIFICATION */}
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
                  className="w-full pl-9 pr-3 py-2.5 text-center text-lg tracking-widest font-mono font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55]"
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
                onClick={() => setStep('credentials')}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || mfaOtp.length < 6}
                className="flex-1 py-2 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

