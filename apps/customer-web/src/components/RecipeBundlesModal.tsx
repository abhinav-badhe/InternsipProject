import React, { useState, useEffect } from 'react';
import {
  X,
  ChefHat,
  Clock,
  Users,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Check,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { fetchRecipeBundles, RecipeBundle, RecipeIngredient } from '../api/client';
import { Product, ProductVariant } from '../data/catalog';

interface RecipeBundlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddIngredient: (variant: ProductVariant, product: Product) => void;
  onShowToast: (message: string) => void;
}

export const RecipeBundlesModal: React.FC<RecipeBundlesModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddIngredient,
  onShowToast,
}) => {
  const [recipes, setRecipes] = useState<RecipeBundle[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedRecipeIds, setAddedRecipeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchRecipeBundles()
        .then((data) => {
          setRecipes(data);
          if (data.length > 0 && !selectedRecipeId) {
            setSelectedRecipeId(data[0].id);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeRecipe = recipes.find((r) => r.id === selectedRecipeId) || recipes[0];

  const handleAddAllToCart = (recipe: RecipeBundle) => {
    let addedCount = 0;
    for (const ing of recipe.ingredients) {
      // Find matching product in catalog
      const matchedProd = products.find((p) =>
        p.variants.some((v) => v.sku.toUpperCase() === ing.sku.toUpperCase())
      );
      if (matchedProd) {
        const matchedVar = matchedProd.variants.find(
          (v) => v.sku.toUpperCase() === ing.sku.toUpperCase()
        );
        if (matchedVar) {
          onAddIngredient(matchedVar, matchedProd);
          addedCount++;
        }
      }
    }

    setAddedRecipeIds((prev) => new Set(prev).add(recipe.id));
    onShowToast(`🎉 Added ${addedCount || recipe.ingredients.length} fresh ingredients for ${recipe.name} to cart!`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60  flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ">
              <ChefHat className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">FreshCart Cook & Shop</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  Recipe Bundles
                </span>
              </div>
              <p className="text-xs text-amber-100">
                1-Click Chef Bundles: All ingredients packed fresh from dark store
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close recipes"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-amber-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs animate-pulse">
            Loading delicious recipe bundles...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Sidebar Recipe List */}
            <div className="md:col-span-5 p-3 space-y-2 bg-slate-50/60 overflow-y-auto max-h-[60vh]">
              {recipes.map((r) => {
                const isSelected = activeRecipe?.id === r.id;
                const isAdded = addedRecipeIds.has(r.id);

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecipeId(r.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                      isSelected
                        ? 'bg-white border-orange-500 ring-1 ring-orange-500/30'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                          {r.cuisine}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {r.prepTimeMinutes}m
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 truncate">{r.name}</h4>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-black text-slate-900">
                          ₹{r.bundlePrice.toFixed(0)}{' '}
                          <span className="text-[10px] text-slate-400 line-through font-normal">
                            ₹{r.originalPrice.toFixed(0)}
                          </span>
                        </span>
                        {isAdded ? (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Added
                          </span>
                        ) : (
                          <span className="text-[10px] text-orange-600 font-bold flex items-center gap-0.5">
                            View <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recipe Details & Ingredients Panel */}
            {activeRecipe && (
              <div className="md:col-span-7 p-5 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="relative rounded-xl overflow-hidden h-40 shadow-inner">
                  <img
                    src={activeRecipe.imageUrl}
                    alt={activeRecipe.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                    <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      {activeRecipe.cuisine} Special
                    </span>
                    <h3 className="text-lg font-black leading-tight drop-shadow-sm">
                      {activeRecipe.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-200 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {activeRecipe.prepTimeMinutes} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        Serves {activeRecipe.servings}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-300 font-bold">
                        <Tag className="w-3.5 h-3.5" />
                        Save ₹{activeRecipe.savings} ({activeRecipe.bundleDiscountPercent}% off)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeRecipe.description}
                </p>

                {/* Ingredients Checklist */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Ingredients Included ({activeRecipe.ingredients.length} items):
                  </h4>
                  <div className="space-y-1.5">
                    {activeRecipe.ingredients.map((ing) => (
                      <div
                        key={ing.id}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-slate-800">{ing.productName}</span>
                          <span className="text-[10px] text-slate-400">({ing.quantity} {ing.unit})</span>
                        </div>
                        <span className="font-semibold text-slate-700">₹{ing.totalItemPrice.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add All CTA */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Bundle Price</span>
                    <div className="text-lg font-black text-slate-900">
                      ₹{activeRecipe.bundlePrice.toFixed(0)}{' '}
                      <span className="text-xs text-slate-400 line-through font-normal">
                        ₹{activeRecipe.originalPrice.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddAllToCart(activeRecipe)}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add All {activeRecipe.ingredients.length} to Cart</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

