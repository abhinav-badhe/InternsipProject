import React, { useRef, useState, useEffect } from 'react';
import { Category } from '../data/catalog';

interface CategoryNavProps {
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categories?: Category[];
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategoryId,
  onSelectCategory,
  categories = [],
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(40);

  const updateScrollProgress = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress((scrollLeft / maxScroll) * 100);
      const ratio = Math.max(15, Math.min(80, (clientWidth / scrollWidth) * 100));
      setThumbWidthPercent(ratio);
    } else {
      setScrollProgress(0);
      setThumbWidthPercent(100);
    }
  };

  useEffect(() => {
    updateScrollProgress();
    window.addEventListener('resize', updateScrollProgress);
    return () => window.removeEventListener('resize', updateScrollProgress);
  }, [categories]);

  const handleScroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
  };

  return (
    <nav className="bg-white border-b border-gray-100 pt-2 pb-1.5 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Rounded Capsule Category Pills matching reference image */}
        <div
          ref={scrollRef}
          onScroll={updateScrollProgress}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
        >
          {categories.map((cat: Category) => {
            const isSelected = selectedCategoryId === cat.id;
            const label = cat.id === 'ALL' ? 'All' : cat.shortLabel || cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3.5 py-1 text-xs font-normal rounded-full whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-[#007a55] text-white font-medium shadow-2xs'
                    : 'bg-white text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Row 2: Horizontal Slider Track with Left & Right Arrow controls (exact match) */}
        <div className="flex items-center gap-2 mt-1.5 px-0.5">
          {/* Left Arrow Button */}
          <button
            onClick={() => handleScroll(-250)}
            className="p-0.5 text-gray-500 hover:text-gray-800 transition-colors shrink-0 focus:outline-none"
            aria-label="Scroll left"
          >
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <polygon points="18,4 6,12 18,20" />
            </svg>
          </button>

          {/* Slider Track Bar */}
          <div
            onClick={handleTrackClick}
            className="relative flex-1 bg-gray-200 rounded-full h-1.5 cursor-pointer overflow-hidden"
          >
            {/* Sliding Thumb Bar */}
            <div
              className="bg-gray-500 rounded-full h-1.5 transition-all duration-150 ease-out absolute top-0"
              style={{
                width: `${thumbWidthPercent}%`,
                left: `${(scrollProgress / 100) * (100 - thumbWidthPercent)}%`,
              }}
            />
          </div>

          {/* Right Arrow Button */}
          <button
            onClick={() => handleScroll(250)}
            className="p-0.5 text-gray-500 hover:text-gray-800 transition-colors shrink-0 focus:outline-none"
            aria-label="Scroll right"
          >
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <polygon points="6,4 18,12 6,20" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};
