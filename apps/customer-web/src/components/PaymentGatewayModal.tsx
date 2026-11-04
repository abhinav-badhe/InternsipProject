import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Wallet,
  AlertCircle,
  Smartphone,
  CreditCard,
  Layers,
} from 'lucide-react';
import {
  initiateGatewayOrder,
  verifyGatewayPayment,
  initiateSplitPayment,
  confirmSplitPayment,
  GatewayOrderDetails,
  SplitPaymentInitiateResult,
} from '../api/client';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  walletBalance: number;
  onPaymentSuccess: (paymentId: string) => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  totalAmount,
  walletBalance,
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'UPI_QR' | 'RAZORPAY' | 'SPLIT'>('UPI_QR');
  const [gatewayData, setGatewayData] = useState<GatewayOrderDetails | null>(null);
  const [splitData, setSplitData] = useState<SplitPaymentInitiateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  // Split state
  const maxWalletUsable = Math.min(walletBalance, totalAmount);
  const [walletAmount, setWalletAmount] = useState<number>(maxWalletUsable > 0 ? Math.floor(maxWalletUsable) : 0);
  const remainingGatewayAmount = Math.max(0, Number((totalAmount - walletAmount).toFixed(2)));

  useEffect(() => {
    if (isOpen && orderId) {
      setError(null);
      setPaymentDone(false);
      setSplitData(null);
      loadGatewayOrder(totalAmount);
    }
  }, [isOpen, orderId, totalAmount]);

  const loadGatewayOrder = async (amt: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await initiateGatewayOrder(orderId, amt);
      setGatewayData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText('freshcart@icici');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayCheckoutModal = async () => {
    if (!gatewayData) return;
    try {
      setIsVerifying(true);
      setError(null);

      const hasLoaded = await loadRazorpayScript();
      if (hasLoaded && (window as any).Razorpay) {
        const options = {
          key: gatewayData.keyId || 'rzp_test_freshcart',
          amount: gatewayData.amountInPaise,
          currency: gatewayData.currency || 'INR',
          name: 'FreshCart Hyperlocal Grocery',
          description: `Order #${orderNumber}`,
          order_id: gatewayData.razorpayOrderId.startsWith('order_') ? gatewayData.razorpayOrderId : undefined,
          prefill: {
            name: gatewayData.customerName || 'Valued Customer',
            contact: gatewayData.customerPhone || '9876543210',
          },
          theme: { color: '#007a55' },
          handler: async function (response: any) {
            await verifyGatewayPayment({
              orderId,
              razorpayOrderId: response.razorpay_order_id || gatewayData.razorpayOrderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setPaymentDone(true);
            onPaymentSuccess(response.razorpay_payment_id);
          },
          modal: {
            ondismiss: function () {
              setIsVerifying(false);
            },
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        await handleVerifyDirectPayment();
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
      setIsVerifying(false);
    }
  };

  // Feature 21: Verify Gateway Payment (UPI / Sandbox)
  const handleVerifyDirectPayment = async () => {
    if (!gatewayData) return;
    try {
      setIsVerifying(true);
      setError(null);
      const simPaymentId = `pay_rzp_${Date.now()}`;
      const simSignature = `test_sig_${Date.now()}`;

      await verifyGatewayPayment({
        orderId,
        razorpayOrderId: gatewayData.razorpayOrderId,
        razorpayPaymentId: simPaymentId,
        razorpaySignature: simSignature,
      });

      setPaymentDone(true);
      onPaymentSuccess(simPaymentId);
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Feature 22: Initiate Split Payment
  const handleInitiateSplit = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await initiateSplitPayment({
        orderId,
        totalAmount,
        walletAmount,
        gatewayAmount: remainingGatewayAmount,
      });
      setSplitData(res);

      if (res.status === 'PAID') {
        // Entire order covered by wallet!
        setPaymentDone(true);
        onPaymentSuccess(`split_wallet_${res.splitId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate split payment');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm Split Payment after Gateway leg
  const handleConfirmSplitLeg = async () => {
    if (!splitData) return;
    try {
      setIsVerifying(true);
      setError(null);
      const simPaymentId = `pay_split_${Date.now()}`;
      await confirmSplitPayment({
        splitId: splitData.splitId,
        gatewayPaymentId: simPaymentId,
      });

      setPaymentDone(true);
      onPaymentSuccess(simPaymentId);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm split payment');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">FreshCart Secure Pay</h3>
              <p className="text-xs text-emerald-200">Order #{orderNumber || orderId.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Payable Amount</span>
            <div className="text-2xl font-black text-slate-900">₹{totalAmount.toFixed(2)}</div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            100% RBI Compliant
          </span>
        </div>

        {paymentDone ? (
          /* Payment Success State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">Payment Verified & Received!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Your order is confirmed and sent to dark store for instant picking.
              </p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-700" />
              <span>₹{(totalAmount * 0.05).toFixed(2)} Cashback will be credited to your wallet!</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Back to Storefront
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('UPI_QR')}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'UPI_QR'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI QR</span>
              </button>
              <button
                onClick={() => setActiveTab('RAZORPAY')}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'RAZORPAY'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Razorpay</span>
              </button>
              <button
                onClick={() => setActiveTab('SPLIT')}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'SPLIT'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split Pay</span>
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: Dynamic UPI QR */}
            {activeTab === 'UPI_QR' && (
              <div className="space-y-4 text-center">
                {isLoading ? (
                  <div className="py-12 text-slate-400 text-xs animate-pulse">
                    Generating dynamic merchant UPI QR...
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block shadow-inner mx-auto">
                      {gatewayData?.upiQrUrl ? (
                        <img
                          src={gatewayData.upiQrUrl}
                          alt="UPI QR Code"
                          className="w-44 h-44 object-contain mx-auto rounded-lg"
                        />
                      ) : (
                        <div className="w-44 h-44 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                          Loading QR...
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-center gap-2">
                      <span>UPI ID: <strong className="text-slate-800">freshcart@icici</strong></span>
                      <button
                        onClick={handleCopyUpi}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title="Copy UPI ID"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {copiedUpi && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Scan with any UPI App (Google Pay, PhonePe, Paytm, BHIM, CRED)
                    </p>

                    <button
                      onClick={handleVerifyDirectPayment}
                      disabled={isVerifying}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isVerifying ? 'Verifying Bank UTR...' : 'I Have Paid via UPI'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: Razorpay Gateway Card/NetBanking */}
            {activeTab === 'RAZORPAY' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Razorpay Checkout
                    </span>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                      Cards / NetBanking / Wallets
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700">
                    Direct integration with Visa, MasterCard, RuPay, NetBanking across 50+ Indian banks, and BNPL.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-600 border border-slate-200 rounded-xl p-3">
                  <div className="flex justify-between">
                    <span>Merchant</span>
                    <span className="font-semibold text-slate-900">FreshCart Technologies Pvt Ltd</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Key Mode</span>
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      rzp_test_freshcart
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Amount</span>
                    <span className="font-bold text-slate-900">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleRazorpayCheckoutModal}
                  disabled={isVerifying}
                  className="w-full py-2.5 bg-[#0c2340] hover:bg-[#1a365d] disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isVerifying ? 'Opening Razorpay Gateway...' : `Launch Razorpay Checkout (₹${totalAmount.toFixed(2)})`}</span>
                </button>
              </div>
            )}

            {/* TAB 3: Feature 22: Split Payment */}
            {activeTab === 'SPLIT' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-700" />
                      FreshCart Wallet Balance
                    </span>
                    <span className="font-black text-emerald-700">₹{walletBalance.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Pay part of the bill using your store wallet, and the rest using UPI / Razorpay!
                  </p>
                </div>

                {!splitData ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                        <span>Pay from Wallet:</span>
                        <span className="font-bold text-emerald-700">₹{walletAmount.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={maxWalletUsable}
                        step="1"
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(Number(e.target.value))}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Wallet Deduction</span>
                        <span className="font-medium text-emerald-700">-₹{walletAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                        <span>Remaining Gateway / UPI</span>
                        <span>₹{remainingGatewayAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleInitiateSplit}
                      disabled={isLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Layers className="w-4 h-4" />
                      <span>{isLoading ? 'Setting up Split...' : 'Confirm Split & Proceed'}</span>
                    </button>
                  </div>
                ) : (
                  /* Split Leg 2: Pay Remaining Amount via UPI */
                  <div className="space-y-3 text-center">
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 text-left">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>₹{splitData.walletAmount.toFixed(2)}</strong> deducted from Wallet. Now pay remainder:
                      </span>
                    </div>

                    {splitData.gateway?.upiQrUrl && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl inline-block mx-auto">
                        <img
                          src={splitData.gateway.upiQrUrl}
                          alt="Split UPI QR"
                          className="w-36 h-36 object-contain mx-auto rounded"
                        />
                      </div>
                    )}

                    <div className="text-xs text-slate-700 font-semibold">
                      Pay remaining: ₹{splitData.gatewayAmount.toFixed(2)}
                    </div>

                    <button
                      onClick={handleConfirmSplitLeg}
                      disabled={isVerifying}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isVerifying ? 'Confirming...' : 'Complete Split Payment'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

