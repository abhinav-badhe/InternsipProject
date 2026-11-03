import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Check,
  Pause,
  Play,
  Trash2,
  Sparkles,
  Milk,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import {
  CustomerSubscription,
  fetchCustomerSubscriptions,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from '../api/client';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionChanged?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscriptionChanged,
}) => {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'MY_SUBS' | 'NEW_SUB'>('MY_SUBS');

  // New Subscription Form State
  const [selectedProduct, setSelectedProduct] = useState({
    sku: 'AMUL-TZ-500ML',
    productName: 'Amul Taaza Homogenised Milk',
    variantName: '500 ml',
    unitPrice: 27.0,
  });
  const [frequency, setFrequency] = useState<'DAILY' | 'ALTERNATE_DAYS' | 'WEEKDAYS_ONLY' | 'WEEKLY'>('DAILY');
  const [quantity, setQuantity] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSubscriptions();
    }
  }, [isOpen]);

  const loadSubscriptions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCustomerSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error('Failed to load subscriptions', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setStatusMessage(null);
    try {
      await createSubscription({
        sku: selectedProduct.sku,
        productName: selectedProduct.productName,
        variantName: selectedProduct.variantName,
        quantity,
        unitPrice: selectedProduct.unitPrice,
        frequency,
        deliverySlot: '07:00 AM - 09:00 AM',
      });
      setStatusMessage(`🎉 Subscribed to ${selectedProduct.productName}! Next morning delivery scheduled.`);
      loadSubscriptions();
      setActiveTab('MY_SUBS');
      if (onSubscriptionChanged) onSubscriptionChanged();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to start subscription');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePause = async (sub: CustomerSubscription) => {
    try {
      if (sub.status === 'ACTIVE') {
        await pauseSubscription(sub.id);
      } else {
        await resumeSubscription(sub.id);
      }
      loadSubscriptions();
      if (onSubscriptionChanged) onSubscriptionChanged();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this recurring delivery?')) return;
    try {
      await cancelSubscription(id);
      loadSubscriptions();
      if (onSubscriptionChanged) onSubscriptionChanged();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  if (!isOpen) return null;

  const discountedPrice = selectedProduct.unitPrice * 0.9;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Milk className="w-5 h-5 text-blue-200" />
            <span className="text-xs uppercase tracking-wider font-bold text-blue-200">
              FreshCart Daily Subscription
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">Daily Milk & Essentials</h3>
              <p className="text-xs text-blue-100 mt-1">
                Fresh morning doorstep delivery at 7 AM. Pause or cancel anytime.
              </p>
            </div>
            <div className="bg-blue-400/20 border border-blue-300/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Save 10% Extra</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('MY_SUBS')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'MY_SUBS'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            My Subscriptions ({subscriptions.filter((s) => s.status !== 'CANCELLED').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('NEW_SUB')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1 ${
              activeTab === 'NEW_SUB'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            Subscribe New Item
          </button>
        </div>

        {/* Status Alert */}
        {statusMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-medium text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'MY_SUBS' ? (
            <div>
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading subscriptions...</div>
              ) : subscriptions.filter((s) => s.status !== 'CANCELLED').length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Milk className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">You don't have any active morning subscriptions yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('NEW_SUB')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Start a Daily Milk Subscription
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions
                    .filter((s) => s.status !== 'CANCELLED')
                    .map((sub) => {
                      const isActive = sub.status === 'ACTIVE';
                      return (
                        <div
                          key={sub.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isActive
                              ? 'border-indigo-200 bg-white shadow-2xs'
                              : 'border-slate-200 bg-slate-50 opacity-75'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">{sub.product_name}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {sub.variant_name}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                                <span>Qty: <b>{sub.quantity}</b></span>
                                <span>•</span>
                                <span>₹{(Number(sub.unit_price) * 0.9).toFixed(2)}/day (10% OFF)</span>
                                <span>•</span>
                                <span className="font-semibold text-indigo-700 uppercase text-[10px]">
                                  {sub.frequency.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTogglePause(sub)}
                                className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  isActive
                                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                                title={isActive ? 'Pause recurring deliveries' : 'Resume deliveries'}
                              >
                                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                <span className="text-[10px]">{isActive ? 'Pause' : 'Resume'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(sub.id)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Cancel subscription"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Morning Slot: {sub.delivery_slot}
                            </span>
                            {isActive && (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Next: {new Date(sub.next_delivery_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Product Presets */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-800">Select Essential</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      sku: 'AMUL-TZ-500ML',
                      productName: 'Amul Taaza Milk',
                      variantName: '500 ml',
                      unitPrice: 27.0,
                    },
                    {
                      sku: 'SKU-BRD-WHT-400G',
                      productName: 'Britannia White Bread',
                      variantName: '400 g',
                      unitPrice: 45.0,
                    },
                    {
                      sku: 'SKU-EGG-6PC',
                      productName: 'Farm Fresh White Eggs',
                      variantName: '6 pcs',
                      unitPrice: 54.0,
                    },
                    {
                      sku: 'SKU-DAHI-400G',
                      productName: 'Mother Dairy Classic Dahi',
                      variantName: '400 g',
                      unitPrice: 35.0,
                    },
                  ].map((p) => {
                    const isSelected = selectedProduct.sku === p.sku;
                    return (
                      <button
                        key={p.sku}
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600 font-semibold'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 truncate">{p.productName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.variantName}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-indigo-700">
                            ₹{(p.unitPrice * 0.9).toFixed(2)}
                          </span>
                          <span className="text-[10px] line-through text-slate-400">
                            ₹{p.unitPrice.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency Selector */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-800">Delivery Frequency</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'DAILY', label: 'Every Day (Daily)' },
                    { id: 'ALTERNATE_DAYS', label: 'Alternate Days' },
                    { id: 'WEEKDAYS_ONLY', label: 'Weekdays Only (Mon-Fri)' },
                    { id: 'WEEKLY', label: 'Weekly (Sundays)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id as any)}
                      className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                        frequency === f.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Counter */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800">Packets per delivery:</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg border border-slate-300 bg-white font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-slate-900">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-7 h-7 rounded-lg border border-slate-300 bg-white font-bold text-xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Subscribe CTA Button */}
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreate}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  {isCreating
                    ? 'Subscribing...'
                    : `Subscribe & Save 10% (₹${(discountedPrice * quantity).toFixed(2)}/delivery)`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pause anytime before 11 PM for next morning</span>
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
