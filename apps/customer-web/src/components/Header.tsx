import React, { useState } from 'react';
import { ShoppingBag, Search, MapPin, MessageSquare, User, FileText, X } from 'lucide-react';
import { CATEGORIES } from '../data/catalog';

interface HeaderProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory: (catId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenOrders,
  searchQuery,
  onSearchChange,
  onSelectCategory,
}) => {
  const [showDisambiguation, setShowDisambiguation] = useState(false);

  const isSoapSearch = searchQuery.toLowerCase().trim() === 'soap';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Top Banner: WhatsApp Express Link & Delivery Notice */}
      <div className="bg-emerald-800 text-emerald-50 px-4 py-1.5 text-xs font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>⚡ Lightning Delivery: Orders dispatched in 30 minutes</span>
        </div>
        <a
          href="https://wa.me/919876543210?text=Hi%2C%20I%20would%20like%20to%20order%20groceries"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-emerald-200 hover:text-white transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
          <span>Order via WhatsApp (+91 98765 43210)</span>
        </a>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              onSelectCategory('ALL');
              onSearchChange('');
            }}
            className="flex items-center gap-2 text-left focus:outline-none"
          >
            <div className="w-9 h-9 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              FC
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight">
                FreshCart
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Omnichannel Grocery
              </span>
            </div>
          </button>

          {/* Delivery Location */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900 leading-tight">HSR Layout, Sector 2</span>
              <span className="text-slate-500 text-[10px]">Delivery in 25-35 mins</span>
            </div>
          </div>
        </div>

        {/* Search Bar with Disambiguation Popover */}
        <div className="flex-1 max-w-xl relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search soaps, atta, milk, laundry detergent..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowDisambiguation(e.target.value.toLowerCase().trim() === 'soap');
              }}
              onFocus={() => {
                if (isSoapSearch) setShowDisambiguation(true);
              }}
              className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setShowDisambiguation(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Clarification / Disambiguation Box (Scenario 09 in Web UI) */}
          {showDisambiguation && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="font-semibold text-slate-800">
                  Multiple categories found for &quot;soap&quot;. What are you looking for?
                </span>
                <button
                  onClick={() => setShowDisambiguation(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    onSelectCategory('BATH_SOAP');
                    setShowDisambiguation(false);
                  }}
                  className="p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
                >
                  <span className="font-semibold text-slate-900 block">1. Bathing Soaps</span>
                  <span className="text-[11px] text-slate-500">Dettol, Dove, Lifebuoy</span>
                </button>
                <button
                  onClick={() => {
                    onSelectCategory('WASH_SOAP');
                    setShowDisambiguation(false);
                  }}
                  className="p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
                >
                  <span className="font-semibold text-slate-900 block">2. Washing Bars</span>
                  <span className="text-[11px] text-slate-500">Surf Excel, Rin</span>
                </button>
                <button
                  onClick={() => {
                    onSelectCategory('UTENSIL_SOAP');
                    setShowDisambiguation(false);
                  }}
                  className="p-2 rounded border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
                >
                  <span className="font-semibold text-slate-900 block">3. Utensil Bars</span>
                  <span className="text-[11px] text-slate-500">Vim, Pril Lemon</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Action Icons: Invoices/Orders + Seller Hub + Cart Drawer */}
        <div className="flex items-center gap-2.5">
          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200"
          >
            <span>Seller Hub</span>
          </a>

          <button
            onClick={onOpenOrders}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">My Orders & Invoices</span>
          </button>

          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>₹{cartTotal.toFixed(2)}</span>
            {cartCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-white text-[10px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
