import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Tag,
  Check,
  Truck,
  ShieldCheck,
  MapPin,
  Home,
  Briefcase,
  ChevronRight,
  Zap,
  Clock,
  Calendar,
  Wallet,
  Sparkles,
  Package,
  CreditCard,
} from 'lucide-react';
import { Product, ProductVariant } from '../data/catalog';
import {
  CustomerSavedAddress,
  fetchCustomerAddresses,
  DeliverySlotOption,
  fetchDeliverySlots,
  fetchCustomerWallet,
  CouponItem,
  fetchAvailableCoupons,
  validateCoupon,
  fetchSurgePricingStatus,
  fetchProductRecommendations,
  SurgePricingStatus,
  ProductRecommendation,
} from '../api/client';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
const AddressSelectorModal = React.lazy(() =>
  import('./AddressSelectorModal').then((m) => ({ default: m.AddressSelectorModal }))
);

export interface CartItem {
  variant: ProductVariant;
  product: Product;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (sku: string, delta: number) => void;
  onRemoveItem: (sku: string) => void;
  onCheckout: (
    deliverySlot: string,
    couponCode?: string,
    deliveryAddress?: CustomerSavedAddress,
    paymentMethod?: 'RAZORPAY' | 'COD'
  ) => Promise<void>;
  isCheckingOut: boolean;
  onAddToCart?: (variant: ProductVariant, product: Product) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isCheckingOut,
  onAddToCart,
}) => {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [slotTypeTab, setSlotTypeTab] = useState<'EXPRESS' | 'SCHEDULED'>('EXPRESS');
  const [availableSlots, setAvailableSlots] = useState<DeliverySlotOption[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('express-30');
  const [selectedAddress, setSelectedAddress] = useState<CustomerSavedAddress | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWallet, setUseWallet] = useState<boolean>(true);
  const [availableCoupons, setAvailableCoupons] = useState<CouponItem[]>([]);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // Feature 18: Surge Pricing State
  const [surgeStatus, setSurgeStatus] = useState<SurgePricingStatus | null>(null);

  // Feature 19: AI Recommendations State
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);

  useEffect(() => {
    fetchCustomerAddresses().then((list) => {
      if (list.length > 0 && !selectedAddress) {
        setSelectedAddress(list[0]);
      }
    });

    fetchDeliverySlots().then((slots) => {
      setAvailableSlots(slots);
      if (slots.length > 0) {
        setSelectedSlotId(slots[1]?.id || slots[0].id);
      }
    });

    fetchCustomerWallet().then((w) => {
      setWalletBalance(w.balance);
    });

    fetchAvailableCoupons().then((coupons) => {
      setAvailableCoupons(coupons);
    });

    fetchSurgePricingStatus().then((s) => {
      setSurgeStatus(s);
    }).catch(() => {});
  }, []);

  // Fetch recommendations whenever cart items change
  useEffect(() => {
    if (items.length > 0) {
      const skus = items.map((i) => i.variant.sku);
      fetchProductRecommendations(skus)
        .then((recs) => setRecommendations(recs))
        .catch(() => {});
    } else {
      setRecommendations([]);
    }
  }, [items]);

  // Selected slot details
  const activeSlot = availableSlots.find((s) => s.id === selectedSlotId) || {
    id: selectedSlotId,
    type: slotTypeTab,
    title: 'Standard Express',
    timeWindow: '25-30 Mins',
    fee: 0,
    tag: 'Free over ₹199',
    badgeColor: 'emerald',
    available: true,
  };

  // Pricing calculations
  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const freeShippingThreshold = 499;
  const isFreeDelivery = subtotal >= freeShippingThreshold || appliedCoupon === 'FREESHIP';
  const baseDeliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : 40.0;
  const rushFee = activeSlot.fee || 0;
  const surgeFee = surgeStatus?.isSurgeActive ? surgeStatus.totalSurgeFee : 0;
  const deliveryFee = baseDeliveryFee + rushFee + surgeFee;

  // Coupon discount
  const discount = couponDiscount;

  // Estimated Tax (5% on staples, 18% on personal care - approx 12% blended)
  const estimatedTax = Number(((subtotal - discount) * 0.12).toFixed(2));
  const preWalletTotal = Math.max(0, Number((subtotal - discount + deliveryFee + estimatedTax).toFixed(2)));
  const walletDeduction = 0;
  const grandTotal = Math.max(0, Number((preWalletTotal - walletDeduction).toFixed(2)));

  const handleApplyCoupon = async (e?: React.FormEvent, codeToApply?: string) => {
    if (e) e.preventDefault();
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setCouponSuccess(null);

    try {
      const res = await validateCoupon(code, subtotal);
      setAppliedCoupon(res.code);
      setCouponDiscount(res.discountAmount);
      setCouponSuccess(res.savingsMessage);
      setCouponCode(res.code);
    } catch (err: any) {
      setCouponError(err.message || 'Invalid coupon or order requirement not met');
      setAppliedCoupon(null);
      setCouponDiscount(0);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="gap-0" onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (isAddressModalOpen) { event.preventDefault(); setIsAddressModalOpen(false); } }}>
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <SheetTitle>Your cart</SheetTitle>
              <SheetDescription>{items.length} {items.length === 1 ? 'item' : 'items'}</SheetDescription>
            </div>

          </div>

          {/* Drawer Content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-4">
            {/* Free Delivery Bar */}
            {subtotal > 0 && (
              <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200 text-xs">
                {isFreeDelivery ? (
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>🎉 You have unlocked FREE Express Delivery!</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2 justify-between text-foreground font-medium mb-1.5">
                      <span>Add ₹{(freeShippingThreshold - subtotal).toFixed(2)} more for FREE delivery</span>
                      <span className="font-bold">₹{subtotal.toFixed(0)}/₹{freeShippingThreshold}</span>
                    </div>
                    <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {items.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  <Truck className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Your cart is empty</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Add items from the store to begin checkout
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              /* Items List */
              <div className="divide-y divide-slate-100">
                {items.map(({ variant, product, quantity }) => (
                  <div key={variant.sku} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <img
                      src={variant.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-900 truncate">
                        {product.name}
                      </h4>
                      <div className="text-[11px] text-slate-500">
                        {variant.packSize} • ₹{variant.price.toFixed(2)}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                      <button
                        onClick={() => onUpdateQuantity(variant.sku, -1)}
                        aria-label={`Decrease quantity of ${product.name}`}
                        className="size-8 flex items-center justify-center text-slate-600 hover:text-slate-900"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 w-4 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(variant.sku, 1)}
                        disabled={quantity >= variant.availableStock}
                        aria-label={`Increase quantity of ${product.name}`}
                        className="size-8 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line total & remove */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        ₹{(variant.price * quantity).toFixed(2)}
                      </div>
                      <button
                        onClick={() => onRemoveItem(variant.sku)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery Address Selector (Feature 12) */}
            {items.length > 0 && (
              <div className="pt-2">
                <div className="flex flex-wrap gap-2 items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>Delivering To</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div
                  onClick={() => setIsAddressModalOpen(true)}
                  className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      {selectedAddress?.label === 'WORK' ? (
                        <Briefcase className="w-3.5 h-3.5" />
                      ) : (
                        <Home className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          {selectedAddress?.label || 'HOME'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          • {selectedAddress?.recipientName || 'Valued Customer'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-1">
                        {selectedAddress
                          ? `${selectedAddress.flatNumber ? `${selectedAddress.flatNumber}, ` : ''}${selectedAddress.street}, ${selectedAddress.city} ${selectedAddress.pincode}`
                          : '12th Main Road, HSR Sector 2, Bengaluru'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>
            )}

            {/* Feature 13: Delivery Slot Selector (Express vs Scheduled) */}
            {items.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Delivery Speed & Slot
                  </span>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSlotTypeTab('EXPRESS')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        slotTypeTab === 'EXPRESS'
                          ? 'bg-white text-emerald-700 '
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Express
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlotTypeTab('SCHEDULED')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        slotTypeTab === 'SCHEDULED'
                          ? 'bg-white text-emerald-700 '
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Scheduled
                    </button>
                  </div>
                </div>

                {/* Slot Options List */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {availableSlots
                    .filter((s) => s.type === slotTypeTab)
                    .map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      const isClosed = !slot.available;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={isClosed}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all relative cursor-pointer ${
                            isClosed
                              ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600 text-emerald-950 font-medium '
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex flex-wrap gap-1 items-center justify-between mb-1">
                            <span className="font-bold text-xs flex items-center gap-1">
                              {slot.type === 'EXPRESS' ? (
                                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              ) : (
                                <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                              )}
                              {slot.title}
                            </span>
                            {slot.fee > 0 ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                                +₹{slot.fee}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">
                                FREE
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 font-normal">
                            {slot.timeWindow}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">{slot.tag}</span>
                            {isClosed && <span className="text-red-500 font-medium">Closed</span>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Feature 17: Coupon Code Input & Available Coupons Engine */}
            {items.length > 0 && (
              <div className="pt-2 space-y-2">
                <span className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  Coupons & Offers
                </span>

                <form onSubmit={(e) => handleApplyCoupon(e)} className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      aria-label="Promo code"
                      placeholder="Enter promo code (e.g. WELCOME50)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 uppercase font-mono font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </form>

                {/* Available Coupon Chips (1-Click Apply) */}
                {availableCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableCoupons.map((c) => {
                      const isApplied = appliedCoupon === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleApplyCoupon(undefined, c.code)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                            isApplied
                              ? 'bg-emerald-600 border-emerald-600 text-white '
                              : 'bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                          }`}
                          title={c.description}
                        >
                          {isApplied ? <Check className="w-3 h-3 text-white" /> : <Tag className="w-2.5 h-2.5" />}
                          <span>{c.code}</span>
                          <span className="font-normal opacity-80">
                            ({c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Coupon Alerts */}
                {couponSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{couponSuccess}</span>
                  </div>
                )}
                {couponError && (
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200 flex items-center gap-1.5 text-[11px] text-red-800 font-medium">
                    <X className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Feature 18: Dynamic Surge Pricing Notification */}
            {items.length > 0 && surgeStatus?.isSurgeActive && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 ">
                <div className="flex items-center gap-1.5 font-medium">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                  <span>{surgeStatus.reasons[0] || 'Peak Demand / Rain Surge'}</span>
                </div>
                <span className="font-bold text-amber-950">+₹{surgeFee.toFixed(2)}</span>
              </div>
            )}

            {/* Feature 19: AI-Powered "Frequently Bought Together" Carousel */}
            {items.length > 0 && recommendations.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Frequently Bought Together
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">AI Pairings</span>
                </div>
                <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="w-36 shrink-0 bg-white border border-slate-200 rounded-lg p-2 flex flex-col justify-between hover:border-emerald-300 transition-colors"
                    >
                      <div>
                        <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center overflow-hidden mb-1.5">
                          {rec.recommendedVariant.imageUrl ? (
                            <img
                              src={rec.recommendedVariant.imageUrl}
                              alt={rec.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-900 line-clamp-1 leading-tight">
                          {rec.product.name}
                        </h5>
                        <p className="text-[9px] text-emerald-700 font-medium line-clamp-1 mt-0.5">
                          {rec.affinityReason}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-xs font-black text-slate-900">₹{rec.recommendedVariant.price}</span>
                        {onAddToCart && (
                          <button
                            type="button"
                            onClick={() => onAddToCart(rec.recommendedVariant, rec.product)}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 transition-colors cursor-pointer"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Bill & Checkout CTA */}
          {items.length > 0 && (
            <div className="shrink-0 border-t border-border bg-surface-muted p-4 space-y-3">
              {/* Payment Method Selector (Razorpay Online vs COD) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Payment Method</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {paymentMethod === 'RAZORPAY' ? '⚡ Instant Razorpay / UPI' : 'Pay on Delivery'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('RAZORPAY')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      paymentMethod === 'RAZORPAY'
                        ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs leading-tight">Pay Online</div>
                      <div className="text-[10px] text-slate-500 font-normal truncate">Razorpay, UPI, Card</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      paymentMethod === 'COD'
                        ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-slate-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs leading-tight">Cash on Delivery</div>
                      <div className="text-[10px] text-slate-500 font-normal truncate">Pay at Doorstep</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bill Details */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Item Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  {deliveryFee === 0 ? (
                    <span className="font-semibold text-emerald-700">FREE</span>
                  ) : (
                    <span>₹{deliveryFee.toFixed(2)}</span>
                  )}
                </div>
                {surgeFee > 0 && (
                  <div className="flex justify-between text-amber-800 font-medium">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-600" />
                      Weather / Peak Surge
                    </span>
                    <span>+₹{surgeFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Taxes (GST 5% - 18%)</span>
                  <span>₹{estimatedTax.toFixed(2)}</span>
                </div>
                {walletDeduction > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" />
                      Wallet Balance Applied
                    </span>
                    <span>-₹{walletDeduction.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Grand Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() =>
                  onCheckout(
                    activeSlot.title,
                    appliedCoupon || undefined,
                    selectedAddress || undefined,
                    paymentMethod
                  )
                }
                disabled={isCheckingOut}
                className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isCheckingOut
                    ? 'Reserving Stock...'
                    : paymentMethod === 'RAZORPAY'
                    ? `Pay ₹${grandTotal.toFixed(2)} via Razorpay`
                    : `Place Order · Cash on Delivery`}
                </span>
              </button>
            </div>
          )}
      {/* Address Selector & Management Modal */}
      <React.Suspense fallback={null}>
        <AddressSelectorModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          selectedAddress={selectedAddress}
          onSelectAddress={(addr) => setSelectedAddress(addr)}
        />
      </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};
