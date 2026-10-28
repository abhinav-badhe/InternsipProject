import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, Tag, Check, Truck, ShieldCheck } from 'lucide-react';
import { Product, ProductVariant } from '../data/catalog';

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
  onCheckout: (deliverySlot: string, couponCode?: string) => Promise<void>;
  isCheckingOut: boolean;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isCheckingOut,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('EXPRESS_30');

  if (!isOpen) return null;

  // Pricing calculations
  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const freeShippingThreshold = 499;
  const isFreeDelivery = subtotal >= freeShippingThreshold || appliedCoupon === 'FREESHIP';
  const deliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : 40.0;

  // Coupon discount
  let discount = 0;
  if (appliedCoupon === 'SAVE10' && subtotal >= 300) {
    discount = Number((subtotal * 0.1).toFixed(2));
  } else if (appliedCoupon === 'FREESHIP' && subtotal < freeShippingThreshold) {
    discount = 40.0;
  }

  // Estimated Tax (5% on staples, 18% on personal care - approx 12% blended)
  const estimatedTax = Number(((subtotal - discount) * 0.12).toFixed(2));
  const grandTotal = Math.max(0, Number((subtotal - discount + deliveryFee + estimatedTax).toFixed(2)));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'SAVE10' && subtotal >= 300) {
      setAppliedCoupon('SAVE10');
    } else if (code === 'FREESHIP') {
      setAppliedCoupon('FREESHIP');
    } else {
      alert('Invalid coupon or minimum order requirement not met (Try SAVE10 or FREESHIP)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col justify-between border-l border-slate-200">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Your Cart</h2>
              <span className="text-xs text-slate-500">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    <div className="flex justify-between text-emerald-900 font-medium mb-1.5">
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
                  className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              /* Items List */
              <div className="divide-y divide-slate-100">
                {items.map(({ variant, product, quantity }) => (
                  <div key={variant.sku} className="py-3 flex items-center justify-between gap-3">
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
                        className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-slate-900"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 w-4 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(variant.sku, 1)}
                        disabled={quantity >= variant.availableStock}
                        className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30"
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

            {/* Delivery Slot Selector */}
            {items.length > 0 && (
              <div className="pt-2">
                <span className="block text-xs font-semibold text-slate-800 mb-2">
                  Select Delivery Slot
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('EXPRESS_30')}
                    className={`p-2 rounded border text-left transition-colors ${
                      selectedSlot === 'EXPRESS_30'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">⚡ 30 Mins</span>
                    <span className="text-[10px] text-slate-500">Express Delivery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('TODAY_EVENING')}
                    className={`p-2 rounded border text-left transition-colors ${
                      selectedSlot === 'TODAY_EVENING'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">Today</span>
                    <span className="text-[10px] text-slate-500">5 PM - 7 PM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot('TOMORROW_MORNING')}
                    className={`p-2 rounded border text-left transition-colors ${
                      selectedSlot === 'TOMORROW_MORNING'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">Tomorrow</span>
                    <span className="text-[10px] text-slate-500">7 AM - 9 AM</span>
                  </button>
                </div>
              </div>
            )}

            {/* Coupon Code Input */}
            {items.length > 0 && (
              <div className="pt-2">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Coupon (e.g. SAVE10)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-emerald-500 uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors"
                  >
                    Apply
                  </button>
                </form>
                {appliedCoupon && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Coupon {appliedCoupon} applied successfully!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bill & Checkout CTA */}
          {items.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
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
                <div className="flex justify-between">
                  <span>Taxes (GST 5% - 18%)</span>
                  <span>₹{estimatedTax.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Grand Total</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => onCheckout(selectedSlot, appliedCoupon || undefined)}
                disabled={isCheckingOut}
                className="w-full py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isCheckingOut ? 'Reserving Stock...' : `Proceed to Pay ₹${grandTotal.toFixed(2)}`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
