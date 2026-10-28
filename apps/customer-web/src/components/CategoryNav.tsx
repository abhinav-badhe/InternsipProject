import React from 'react';
import { CATEGORIES } from '../data/catalog';
import { Sparkles, Shirt, Utensils, Milk, Wheat, LayoutGrid } from 'lucide-react';

interface CategoryNavProps {
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  LayoutGrid,
  Sparkles,
  Shirt,
  Utensils,
  Milk,
  Wheat,
};

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategoryId,
  onSelectCategory,
}) => {
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const Icon = iconMap[cat.iconName] || LayoutGrid;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
