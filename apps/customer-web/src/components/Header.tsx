import React, { useState } from 'react';
import { Search, ShoppingCart, X, Store, FileText, SlidersHorizontal, User, LogOut, Wallet, Gift, Milk, ChefHat, MapPin, ChevronDown, Bike } from 'lucide-react';
import { AuthSession, CustomerSavedAddress } from '../api/client';

interface HeaderProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory: (catId: string) => void;
  isBrowseMode: boolean;
  onToggleBrowse: (mode?: 'home' | 'browse') => void;
  userSession?: AuthSession | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  walletBalance?: number;
  onOpenWallet?: () => void;
  onOpenReferral?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenRecipes?: () => void;
  selectedAddress?: CustomerSavedAddress | null;
  onOpenAddressModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenOrders,
  searchQuery,
  onSearchChange,
  onSelectCategory,
  isBrowseMode,
  onToggleBrowse,
  userSession,
  onOpenAuth,
  onSignOut,
  walletBalance,
  onOpenWallet,
  onOpenReferral,
  onOpenSubscriptions,
  onOpenRecipes,
  selectedAddress,
  onOpenAddressModal,
}) => {
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const isSoapSearch = searchQuery.toLowerCase().trim() === 'soap';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* 1. FreshCart Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              onToggleBrowse('home');
              onSelectCategory('ALL');
              onSearchChange('');
            }}
            className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#007a55] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              FC
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-gray-900 block leading-none">
                FreshCart
              </span>
              <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                Omnichannel Grocery
              </span>
            </div>
          </button>

          {/* Delivery Address Pill (Blinkit / Zepto Quick Commerce style) */}
          <button
            onClick={onOpenAddressModal}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#007a55] bg-gray-50/70 hover:bg-emerald-50/50 transition-all cursor-pointer text-left max-w-[210px] md:max-w-[250px] shadow-2xs"
            title="Click to view or add saved delivery addresses"
          >
            <MapPin className="w-4 h-4 text-[#007a55] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-gray-900 flex items-center gap-1">
                <span className="text-[#007a55]">Delivery in 10-15m</span>
                <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
              </span>
              <span className="text-[11px] text-gray-600 truncate font-medium">
                {selectedAddress
                  ? `${selectedAddress.label ? selectedAddress.label + ': ' : ''}${selectedAddress.flatNumber ? selectedAddress.flatNumber + ', ' : ''}${selectedAddress.street}`
                  : 'Select delivery address'}
              </span>
            </div>
          </button>

          {/* Browse Products Button */}
          <button
            onClick={() => onToggleBrowse(isBrowseMode ? 'home' : 'browse')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isBrowseMode
                ? 'bg-[#007a55] text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 shadow-2xs'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Browse Products</span>
          </button>
        </div>

        {/* 2. Center Search Bar */}
        <div className="flex-1 max-w-xl relative">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowDisambiguation(e.target.value.toLowerCase().trim() === 'soap');
              }}
              onFocus={() => {
                if (isSoapSearch) setShowDisambiguation(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onToggleBrowse('browse');
                  setShowDisambiguation(false);
                }
              }}
              className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#007a55] focus:border-[#007a55] transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setShowDisambiguation(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Clarification / Disambiguation Box (Core Platform Feature) */}
          {showDisambiguation && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                <span className="font-semibold text-gray-800">
                  Multiple categories found for &quot;soap&quot;. What are you looking for?
                </span>
                <button
                  onClick={() => setShowDisambiguation(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    onSelectCategory('BATH_SOAP');
                    setShowDisambiguation(false);
                    onToggleBrowse('browse');
                  }}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-[#007a55] hover:bg-[#e6f4ea]/40 text-left transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 block text-xs">1. Bathing Soaps</span>
                  <span className="text-[11px] text-gray-500">Dettol, Dove, Lux</span>
                </button>
                <button
                  onClick={() => {
                    onSelectCategory('WASH_SOAP');
                    setShowDisambiguation(false);
                    onToggleBrowse('browse');
                  }}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-[#007a55] hover:bg-[#e6f4ea]/40 text-left transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 block text-xs">2. Washing Bars</span>
                  <span className="text-[11px] text-gray-500">Surf Excel, Rin</span>
                </button>
                <button
                  onClick={() => {
                    onSelectCategory('UTENSIL_SOAP');
                    setShowDisambiguation(false);
                    onToggleBrowse('browse');
                  }}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-[#007a55] hover:bg-[#e6f4ea]/40 text-left transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 block text-xs">3. Utensil Bars</span>
                  <span className="text-[11px] text-gray-500">Vim Bar, Pril</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Real Platform Actions: Seller Hub, Orders/Invoices, Cart */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Seller Hub Link */}
          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 text-xs font-medium transition-colors"
          >
            <Store className="w-3.5 h-3.5 text-[#007a55]" />
            <span>Seller Hub</span>
          </a>

          {/* Orders & Invoices History */}
          <button
            onClick={onOpenOrders}
            className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span>My Orders</span>
          </button>

          {/* Feature 15: FreshCart Wallet & Cashback */}
          <button
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
            title="FreshCart Wallet & Cashback"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-700" />
            <span>₹{(walletBalance || 0).toFixed(0)}</span>
          </button>

          {/* Feature 16: Daily Subscriptions */}
          <button
            onClick={onOpenSubscriptions}
            className="hidden lg:flex items-center gap-1.5 text-xs text-indigo-900 hover:text-indigo-950 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs"
            title="Daily Milk & Essentials Subscriptions"
          >
            <Milk className="w-3.5 h-3.5 text-indigo-600" />
            <span>Subscriptions</span>
          </button>

          {/* Feature 14: Cook & Shop Recipe Bundles */}
          <button
            onClick={onOpenRecipes}
            className="hidden lg:flex items-center gap-1.5 text-xs text-orange-950 hover:text-orange-900 font-bold px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer shadow-2xs"
            title="Shop Ingredients by Recipe"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-600" />
            <span>Recipes</span>
          </button>

          {/* Feature 17: Refer & Earn Program */}
          <button
            onClick={onOpenReferral}
            className="hidden md:flex items-center gap-1.5 text-xs text-amber-900 hover:text-amber-950 font-bold px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
            title="Invite Friends & Get ₹100"
          >
            <Gift className="w-3.5 h-3.5 text-amber-600" />
            <span>Refer & Earn</span>
          </button>

          {/* Delivery Partner Portal Link */}
          <a
            href="/delivery/login"
            className="hidden xl:flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
            title="Open Dedicated Delivery Partner Portal"
          >
            <Bike className="w-3.5 h-3.5 text-emerald-600" />
            <span>Partner Portal</span>
          </a>

          {/* User Account / Sign In */}
          {userSession ? (
            <div className="flex items-center gap-1.5 pl-1">
              <button
                onClick={onOpenAddressModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs text-[#007a55] font-semibold transition-colors cursor-pointer shadow-2xs"
                title="Manage Saved Addresses"
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">
                  {userSession.user.fullName && userSession.user.fullName !== 'Customer'
                    ? userSession.user.fullName.split(' ')[0]
                    : (userSession.user.phone || 'My Account')}
                </span>
                <ChevronDown className="w-2.5 h-2.5 text-emerald-700" />
              </button>
              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#007a55] hover:bg-[#006345] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>₹{cartTotal.toFixed(2)}</span>
            {cartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-white text-[10px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
