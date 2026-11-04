import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from '../data/catalog';
import { Plus, Minus, Star, ArrowRight, Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  cartQuantities: Record<string, number>;
  onAddToCart: (variant: ProductVariant, product: Product) => void;
  onUpdateQuantity: (variantSku: string, delta: number) => void;
  onOpenAlternatives: (product: Product, variant: ProductVariant) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantities,
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

  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const cartQuantity = cartQuantities[selectedVariant.sku] || 0;

  const discountPercent =
    selectedVariant.mrp > selectedVariant.price
      ? Math.round(((selectedVariant.mrp - selectedVariant.price) / selectedVariant.mrp) * 100)
      : 0;

  const isOutOfStock = selectedVariant.availableStock <= 0;

  return (
    <article aria-label={product.name} className="@container flex min-w-0 flex-col rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/30 sm:p-4">
      <div className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-surface-muted p-4">
        {selectedVariant.imageUrl && failedImageUrl !== selectedVariant.imageUrl ? (
          <img src={selectedVariant.imageUrl} alt={product.name} loading="lazy"
            className="h-full max-w-full object-contain mix-blend-multiply"
            onError={() => setFailedImageUrl(selectedVariant.imageUrl)} />
        ) : <Package role="img" aria-label="Product image unavailable" className="size-12 text-muted-foreground/40" strokeWidth={1} />}
        {discountPercent > 0 && <span className="absolute left-2 top-2 rounded bg-surface px-2 py-1 text-xs font-semibold text-warning">{discountPercent}% off</span>}
      </div>
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-1.5 text-xs">
        <span className="truncate text-muted-foreground">{selectedVariant.packSize || selectedVariant.name}</span>
        <span className={isOutOfStock ? 'text-muted-foreground' : 'text-primary'}>{isOutOfStock ? 'Out of stock' : 'In stock'}</span>
      </div>
      <h3 className="min-h-10 line-clamp-2 text-[13px] font-semibold leading-5 text-foreground" title={product.name}>{product.name}</h3>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
        <span className="truncate">{product.brand}</span>
        <span className="inline-flex items-center gap-1"><Star aria-hidden="true" className="size-3 fill-warning/20 text-warning" /><span className="text-foreground">{product.rating}</span><span>({product.reviewCount})</span></span>
      </div>
      <div className="mt-auto pt-3">
        {product.variants.length > 1 && (
          <select aria-label={`Pack size for ${product.name}`} value={selectedVariant.sku}
            onChange={(event) => { const variant = product.variants.find((item) => item.sku === event.target.value); if (variant) setSelectedVariant(variant); }}
            className="mb-3 min-h-10 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 focus:border-primary">
            {product.variants.map((variant) => <option key={variant.sku} value={variant.sku}>{variant.name} — ₹{variant.price.toFixed(2)}</option>)}
          </select>
        )}
        <div className="flex flex-col justify-between gap-3 border-t border-border pt-3 @min-[240px]:flex-row @min-[240px]:items-center">
          <div className="flex flex-wrap items-baseline gap-2 @min-[240px]:flex-col @min-[240px]:gap-0.5">
            <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">₹{selectedVariant.price.toFixed(2)}</span>
            {selectedVariant.mrp > selectedVariant.price && <span className="text-xs tabular-nums text-muted-foreground line-through">₹{selectedVariant.mrp.toFixed(2)}</span>}
          </div>
          {isOutOfStock ? (
            <button onClick={() => onOpenAlternatives(product, selectedVariant)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted">
              Similar items <ArrowRight aria-hidden="true" className="size-3.5" />
            </button>
          ) : cartQuantity > 0 ? (
            <div className="flex items-center justify-between gap-1 rounded-md border border-primary/20 bg-primary-light @min-[240px]:justify-center">
              <button onClick={() => onUpdateQuantity(selectedVariant.sku, -1)} aria-label="Decrease quantity" className="flex size-11 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"><Minus aria-hidden="true" className="size-3.5" /></button>
              <span aria-live="polite" className="min-w-4 text-center text-sm font-semibold tabular-nums text-primary">{cartQuantity}</span>
              <button onClick={() => onUpdateQuantity(selectedVariant.sku, 1)} disabled={cartQuantity >= selectedVariant.availableStock} aria-label="Increase quantity" className="flex size-11 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 disabled:opacity-30"><Plus aria-hidden="true" className="size-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => onAddToCart(selectedVariant, product)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"><Plus aria-hidden="true" className="size-3.5" />Add to cart</button>
          )}
        </div>
      </div>
    </article>
  );
};
