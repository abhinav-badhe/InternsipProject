import React, { useState } from 'react';
import { X, ShieldCheck, Lock, Mail, User, Phone, CheckCircle2, AlertCircle, KeyRound, LogIn, UserPlus } from 'lucide-react';
import { signInAdmin, verifyAdminMfa, registerAdmin, AdminSession } from './api/adminClient';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AdminSession) => void;
  currentSession: AdminSession | null;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSession,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STORE_ADMIN' | 'FULFILLMENT_STAFF'>('STORE_ADMIN');

  // MFA State
  const [mfaTicket, setMfaTicket] = useState('');
  const [destination, setDestination] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep('credentials');
    setError(null);
    setOtpCode('');
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInAdmin(email.trim(), password);
      if (result.session) {
        onSuccess(result.session);
        onClose();
      } else if (result.mfaRequired && result.mfaTicket) {
        setMfaTicket(result.mfaTicket);
        setDestination(result.destination || email);
        setDemoOtp(result.demoOtp || '');
        setStep('mfa');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const session = await registerAdmin({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
        enableMfa: true,
      });
      onSuccess(session);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setError('Please enter the complete 6-digit OTP verification code.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const session = await verifyAdminMfa(mfaTicket, otpCode.trim());
      onSuccess(session);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired 2FA code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50  animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden relative">
        {/* Header Bar */}
        <div className="bg-primary px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-white">Merchant & Staff Portal</h3>
              <p className="text-[11px] text-emerald-100">PostgreSQL Identity & Two-Factor Auth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Session Info if exists */}
        {currentSession && step === 'credentials' && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Signed in as: <strong>{currentSession.user.fullName}</strong> ({currentSession.user.role})</span>
            </div>
            <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded font-medium">MFA Verified</span>
          </div>
        )}

        {/* Step 1: Credentials (Sign In or Register) */}
        {step === 'credentials' ? (
          <div className="p-6">
            {/* Mode Switch Tabs */}
            <div className="flex border-b border-gray-200 mb-5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'signin'
                    ? 'border-b-2 border-primary text-primary font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 pb-2.5 flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'register'
                    ? 'border-b-2 border-primary text-primary font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Staff</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="adminshopkepper@gmail.com"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-[11px] text-gray-600 space-y-2">
                  <div className="font-semibold text-gray-700">Quick Login Presets:</div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-gray-200">
                    <div>
                      <span className="font-medium text-emerald-800">Shopkeeper:</span>{' '}
                      <code className="text-gray-800 font-mono text-[10px]">adminshopkepper@gmail.com</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('adminshopkepper@gmail.com');
                        setPassword('Shopkeeper@123');
                      }}
                      className="text-primary hover:underline font-semibold text-xs ml-2"
                    >
                      Fill
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-gray-200">
                    <div>
                      <span className="font-medium text-gray-700">Default Admin:</span>{' '}
                      <code className="text-gray-800 font-mono text-[10px]">admin@grocery.local</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('admin@grocery.local');
                        setPassword('adminpassword123');
                      }}
                      className="text-gray-600 hover:underline font-semibold text-xs ml-2"
                    >
                      Fill
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Continue with MFA</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rahul@mystore.com"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="STORE_ADMIN">Store Administrator (Full Permissions)</option>
                    <option value="FULFILLMENT_STAFF">Fulfillment & Packing Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Password (Min 8 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create secure password"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>Enforces 2FA verification for all merchant identities</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Creating Identity...' : 'Register Account'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Step 2: Multi-Factor Authentication OTP Challenge */
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-emerald-100 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Two-Factor Security Verification</h4>
              <p className="text-xs text-gray-600 mt-1">
                Enter the 6-digit one-time code sent to <strong>{destination}</strong>
              </p>
            </div>

            {demoOtp && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <div className="flex items-center justify-between font-semibold">
                  <span>Demo Environment OTP:</span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(demoOtp)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Auto-Fill
                  </button>
                </div>
                <div className="font-mono text-base tracking-widest font-bold text-gray-900 mt-1">
                  {demoOtp}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-2 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="flex-1 py-2 px-3 bg-primary hover:bg-primary-hover text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enter'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

