import React from 'react';
import { Category } from '../data/catalog';
import { ScrollRail } from './ScrollRail';

interface CategoryNavProps {
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categories?: Category[];
}

export const CategoryNav: React.FC<CategoryNavProps> = ({ selectedCategoryId, onSelectCategory, categories = [] }) => (
  <nav aria-label="Product categories" className="border-b border-border bg-surface">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <ScrollRail label="Product categories">
        {categories.map((category) => (
          <button key={category.id} aria-pressed={selectedCategoryId === category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors ${selectedCategoryId === category.id ? 'bg-primary-light text-primary' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'}`}>
            {category.id === 'ALL' ? 'All products' : category.shortLabel || category.name}
          </button>
        ))}
      </ScrollRail>
    </div>
  </nav>
);
