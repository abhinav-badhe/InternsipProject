import React, { useState } from 'react';
import { Product, ProductVariant } from '../data/catalog';
import { Plus, Minus, Star, AlertCircle, ArrowRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  onAddToCart: (variant: ProductVariant, product: Product) => void;
  onUpdateQuantity: (variantSku: string, delta: number) => void;
  onOpenAlternatives: (product: Product, variant: ProductVariant) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onOpenAlternatives,
}) => {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(product.variants[0]);

  const discountPercent = Math.round(
    ((selectedVariant.mrp - selectedVariant.price) / selectedVariant.mrp) * 100
  );

  const isOutOfStock = selectedVariant.availableStock === 0;
  const isLastUnit = selectedVariant.availableStock === 1;

  return (
    <div className="bg-white rounded-md border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors">
      {/* Top Image & Badge */}
      <div className="relative aspect-4/3 bg-slate-50 overflow-hidden border-b border-slate-100">
        <img
          src={selectedVariant.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white tracking-wide">
            {discountPercent}% OFF
          </span>
        )}

        {/* Stock Status Badge */}
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Out of Stock
          </span>
        ) : isLastUnit ? (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
            Only 1 Left!
          </span>
        ) : (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/90 text-slate-600 border border-slate-200">
            {selectedVariant.availableStock} in stock
          </span>
        )}
      </div>

      {/* Body Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Rating */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-700">
              {product.brand}
            </span>
            <div className="flex items-center gap-1 text-slate-600">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-slate-400">({product.reviewCount})</span>
            </div>
          </div>

          {/* Product Title */}
          <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 mb-2">
            {product.name}
          </h3>

          {/* Variant Selector Dropdown if multiple variants exist */}
          {product.variants.length > 1 ? (
            <div className="mb-3">
              <select
                value={selectedVariant.sku}
                onChange={(e) => {
                  const found = product.variants.find((v) => v.sku === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {product.variants.map((v) => (
                  <option key={v.sku} value={v.sku}>
                    {v.name} — ₹{v.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-slate-500 mb-3">{selectedVariant.packSize}</div>
          )}
        </div>

        {/* Bottom Price & Action */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-slate-900">
                ₹{selectedVariant.price.toFixed(2)}
              </span>
              {selectedVariant.mrp > selectedVariant.price && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{selectedVariant.mrp.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {isOutOfStock ? (
            <button
              onClick={() => onOpenAlternatives(product, selectedVariant)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            >
              <span>Similar</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          ) : cartQuantity > 0 ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5">
              <button
                onClick={() => onUpdateQuantity(selectedVariant.sku, -1)}
                className="w-6 h-6 rounded flex items-center justify-center text-emerald-800 hover:bg-emerald-100 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-xs font-bold text-emerald-900">
                {cartQuantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(selectedVariant.sku, 1)}
                disabled={cartQuantity >= selectedVariant.availableStock}
                className="w-6 h-6 rounded flex items-center justify-center text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(selectedVariant, product)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
