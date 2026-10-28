import React from 'react';
import { X, Plus, AlertTriangle, ArrowRight } from 'lucide-react';
import { Product, ProductVariant, PRODUCTS } from '../data/catalog';

interface AlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProduct: Product | null;
  originalVariant: ProductVariant | null;
  onSelectAlternative: (variant: ProductVariant, product: Product) => void;
}

export const AlternativesModal: React.FC<AlternativesModalProps> = ({
  isOpen,
  onClose,
  originalProduct,
  originalVariant,
  onSelectAlternative,
}) => {
  if (!isOpen || !originalProduct || !originalVariant) return null;

  // Find alternatives in the same category that are currently IN STOCK
  const alternatives = PRODUCTS.filter(
    (p) => p.categoryId === originalProduct.categoryId && p.id !== originalProduct.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Item Out of Stock — Similar Alternatives Available
              </h3>
              <p className="text-xs text-slate-500">
                {originalProduct.name} ({originalVariant.packSize}) is currently unavailable.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alternatives List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Recommended In-Stock Replacements:
          </div>

          {alternatives.map((altProd) => (
            <div key={altProd.id} className="py-3 flex items-center justify-between gap-3">
              <img
                src={altProd.variants[0].imageUrl}
                alt={altProd.name}
                className="w-12 h-12 object-cover rounded border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  {altProd.brand}
                </span>
                <h4 className="text-xs font-semibold text-slate-900 line-clamp-1">
                  {altProd.name}
                </h4>
                <div className="text-[11px] text-slate-500">
                  {altProd.variants[0].packSize} • {altProd.variants[0].availableStock} in stock
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  ₹{altProd.variants[0].price.toFixed(2)}
                </span>
                <button
                  onClick={() => {
                    onSelectAlternative(altProd.variants[0], altProd);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Choose</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
