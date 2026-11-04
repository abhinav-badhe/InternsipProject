import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Gift,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  CustomerWalletData,
  fetchCustomerWallet,
  topupCustomerWallet,
} from '../api/client';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onBalanceUpdated,
}) => {
  const [wallet, setWallet] = useState<CustomerWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadWallet();
    }
  }, [isOpen]);

  const loadWallet = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCustomerWallet();
      setWallet(data);
      if (onBalanceUpdated) {
        onBalanceUpdated(data.balance);
      }
    } catch (err) {
      console.error('Failed to load wallet', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopup = async (amount: number) => {
    if (amount <= 0) return;
    setIsToppingUp(true);
    setSuccessMessage(null);
    try {
      const updated = await topupCustomerWallet(amount);
      setWallet(updated);
      if (onBalanceUpdated) {
        onBalanceUpdated(updated.balance);
      }
      setSuccessMessage(`Successfully added ₹${amount} to your FreshCart Wallet!`);
      setCustomAmount('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Top-up failed');
    } finally {
      setIsToppingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60  flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden ">
        {/* Header */}
        <div className="bg-primary p-5 text-white relative">
          <button
            onClick={onClose}
            aria-label="Close wallet"
            className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-white/80" />
            <span className="text-xs font-semibold text-white/80">
              FreshCart Wallet & Cashback
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <span className="text-xs text-emerald-100">Available Balance</span>
              <div className="text-3xl font-bold tracking-tight mt-0.5">
                ₹{wallet ? wallet.balance.toFixed(2) : '0.00'}
              </div>
            </div>
            <div className="bg-emerald-400/20 border border-emerald-300/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>5% Cashback on All Orders</span>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-medium text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Quick Top-Up Section */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              Add Money to Wallet
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Instant 1-Tap UPI / Cards</span>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[100, 200, 500, 1000].map((amt) => (
              <button
                key={amt}
                disabled={isToppingUp}
                onClick={() => handleTopup(amt)}
                className="py-2 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs transition-colors hover:border-emerald-300 cursor-pointer disabled:opacity-50"
              >
                +₹{amt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Custom amount (e.g. 750)"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            <button
              disabled={isToppingUp || !customAmount || parseFloat(customAmount) <= 0}
              onClick={() => handleTopup(parseFloat(customAmount))}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isToppingUp ? 'Adding...' : 'Add Funds'}
            </button>
          </div>
        </div>

        {/* Passbook / Transactions List */}
        <div className="p-6 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800">Passbook History</span>
            <span className="text-[10px] text-slate-400">Recent Transactions</span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading passbook...</div>
          ) : !wallet?.transactions || wallet.transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No transactions recorded yet</div>
          ) : (
            <div className="space-y-2">
              {wallet.transactions.map((tx) => {
                const isCredit =
                  tx.type === 'TOPUP' ||
                  tx.type === 'CASHBACK' ||
                  tx.type === 'WELCOME_BONUS' ||
                  tx.type === 'REFUND';

                return (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-white flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCredit
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isCredit ? (
                          tx.type === 'CASHBACK' ? (
                            <Gift className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                          )
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 line-clamp-1">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          •{' '}
                          {new Date(tx.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold ${
                          isCredit ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${tx.amount.toFixed(2)}`}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Bal: ₹{tx.balanceAfter.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% RBI & Bank-Grade Encrypted</span>
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

