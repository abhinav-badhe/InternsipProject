import React from 'react';
import { Category } from '../data/catalog';

interface CategoryNavProps {
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categories?: Category[];
}

export const CategoryNav: React.FC<CategoryNavProps> = ({ selectedCategoryId, onSelectCategory, categories = [] }) => (
  <nav aria-label="Product categories" className="border-b border-border bg-surface">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex gap-2 overflow-x-auto py-3">
        {categories.map((category) => (
          <button key={category.id} aria-pressed={selectedCategoryId === category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition-colors ${selectedCategoryId === category.id ? 'border-primary bg-primary-light text-primary' : 'border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground'}`}>
            {category.id === 'ALL' ? 'All products' : category.shortLabel || category.name}
          </button>
        ))}
      </div>
    </div>
  </nav>
);
