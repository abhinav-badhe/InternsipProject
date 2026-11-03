import React, { useState, useEffect } from 'react';
import {
  X,
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Coins,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ReferralDetails,
  fetchMyReferralCode,
  claimReferralCode,
} from '../api/client';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed?: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  onRewardClaimed,
}) => {
  const [details, setDetails] = useState<ReferralDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadReferrals();
    }
  }, [isOpen]);

  const loadReferrals = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMyReferralCode();
      setDetails(data);
    } catch (err) {
      console.error('Failed to load referral details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!details) return;
    navigator.clipboard.writeText(details.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!details) return;
    const msg = encodeURIComponent(
      `🛒 Shop on FreshCart with my link and get ₹100 FREE Wallet Credit on your groceries!\n\nUse code: *${details.referralCode}*\n${details.shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setIsClaiming(true);
    setClaimStatus(null);
    try {
      const res = await claimReferralCode(inputCode.trim());
      setClaimStatus({
        success: true,
        message: res.message || '🎉 ₹100 welcome reward unlocked!',
      });
      setInputCode('');
      if (onRewardClaimed) onRewardClaimed();
    } catch (err: any) {
      setClaimStatus({
        success: false,
        message: err.message || 'Invalid or already redeemed referral code',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5 text-amber-200" />
            <span className="text-xs uppercase tracking-wider font-bold text-amber-100">
              Refer & Earn Program
            </span>
          </div>

          <h3 className="text-2xl font-extrabold tracking-tight">
            Give ₹100, Get ₹100
          </h3>
          <p className="text-xs text-amber-100 mt-1">
            Invite your friends & neighbors to FreshCart. They get ₹100 off their first order, and you get ₹100 wallet cashback!
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[11px] text-amber-900 font-medium">Friends Invited</span>
                <span className="text-lg font-black text-amber-950">
                  {details ? details.friendsInvited : 0}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[11px] text-emerald-900 font-medium">Wallet Earned</span>
                <span className="text-lg font-black text-emerald-950">
                  ₹{details ? details.totalEarned.toFixed(0) : '0'}
                </span>
              </div>
            </div>
          </div>

          {/* User's Referral Code Card */}
          <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 space-y-3">
            <span className="block text-xs font-bold text-slate-700">Your Exclusive Referral Code</span>
            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-amber-200 shadow-2xs">
              <span className="font-mono text-base font-extrabold tracking-wider text-slate-900">
                {isLoading ? 'Loading...' : details?.referralCode}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Code on WhatsApp</span>
            </button>
          </div>

          {/* Redeem Friend's Code Section */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="block text-xs font-bold text-slate-800">
              Have a Friend's Referral Code?
            </span>
            <form onSubmit={handleClaim} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter referral code (e.g. FC8899)"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-mono uppercase"
              />
              <button
                type="submit"
                disabled={isClaiming || !inputCode.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isClaiming ? 'Claiming...' : 'Redeem'}
              </button>
            </form>

            {claimStatus && (
              <div
                className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  claimStatus.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {claimStatus.success ? (
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{claimStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unlimited Referral Bonus • Instant Payout</span>
          </div>
          <button
            onClick={onClose}
            className="font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
