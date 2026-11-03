import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../data/catalog';
import { Plus, Minus, Star, ArrowRight } from 'lucide-react';

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
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || {
      sku: 'DEFAULT',
      name: product.name,
      packSize: 'Standard',
      price: 0,
      mrp: 0,
      availableStock: 0,
      imageUrl: '',
    }
  );

  useEffect(() => {
    if (product.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product.id, product.variants]);

  const discountPercent =
    selectedVariant.mrp > selectedVariant.price
      ? Math.round(((selectedVariant.mrp - selectedVariant.price) / selectedVariant.mrp) * 100)
      : 0;

  const isOutOfStock = selectedVariant.availableStock === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 p-3.5 flex flex-col justify-between hover:border-gray-300 hover:shadow-xs transition-all">
      {/* 1. Staged Product Image Container */}
      <div className="relative w-full h-44 bg-[#f5f6f8] rounded-xl overflow-hidden flex items-center justify-center p-3 mb-3">
        <img
          src={selectedVariant.imageUrl}
          alt={product.name}
          className="max-h-36 max-w-full object-contain mix-blend-multiply transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&auto=format&fit=crop&q=80';
          }}
        />

        {/* Warm Peach Discount Badge (matching reference) */}
        {discountPercent > 0 && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#fef3ea] text-[#d97706] shadow-2xs">
            {discountPercent}% off
          </span>
        )}
      </div>

      {/* 2. Product Meta & Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Stock Status Badge & Pack Size */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {isOutOfStock ? (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-500">
                Out of Stock
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#e6f4ea] text-[#007a55]">
                In Stock
              </span>
            )}
            <span className="text-[11px] text-gray-500 font-medium">
              {selectedVariant.packSize || selectedVariant.name}
            </span>
          </div>

          {/* Product Title */}
          <h3 className="font-medium text-gray-900 text-xs leading-snug line-clamp-1 mt-1" title={product.name}>
            {product.name}
          </h3>

          {/* Brand & Star Rating */}
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <span className="font-medium text-gray-600">{product.brand}</span>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-0.5 text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-medium text-gray-700">{product.rating}</span>
            </div>
            <span className="text-gray-400">({product.reviewCount})</span>
          </div>

          {/* Multi-variant Pack Selector (if more than 1 variant) */}
          {product.variants.length > 1 && (
            <div className="mt-2 mb-1">
              <select
                value={selectedVariant.sku}
                onChange={(e) => {
                  const found = product.variants.find((v) => v.sku === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:border-[#007a55] cursor-pointer"
              >
                {product.variants.map((v) => (
                  <option key={v.sku} value={v.sku}>
                    {v.name} — ₹{v.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3. Pricing Row & Add to Cart Action */}
        <div className="pt-2.5 mt-2 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900 leading-tight">
              ₹{selectedVariant.price.toFixed(2)}
            </div>
            {selectedVariant.mrp > selectedVariant.price && (
              <div className="text-[11px] text-gray-400 line-through leading-tight">
                ₹{selectedVariant.mrp.toFixed(2)}
              </div>
            )}
          </div>

          {/* Action Button */}
          {isOutOfStock ? (
            <button
              onClick={() => onOpenAlternatives(product, selectedVariant)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <span>Similar items</span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
            </button>
          ) : cartQuantity > 0 ? (
            <div className="flex items-center gap-1.5 bg-[#e6f4ea] border border-[#a3d9b8] rounded-lg px-2 py-1">
              <button
                onClick={() => onUpdateQuantity(selectedVariant.sku, -1)}
                className="w-5 h-5 rounded flex items-center justify-center text-[#007a55] hover:bg-[#007a55]/10 transition-colors font-bold"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-4 text-center text-xs font-bold text-[#007a55]">
                {cartQuantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(selectedVariant.sku, 1)}
                disabled={cartQuantity >= selectedVariant.availableStock}
                className="w-5 h-5 rounded flex items-center justify-center text-[#007a55] hover:bg-[#007a55]/10 disabled:opacity-30 transition-colors font-bold"
                aria-label="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(selectedVariant, product)}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#007a55] hover:bg-[#006345] text-white transition-colors shadow-2xs"
            >
              <span>Add to cart</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
