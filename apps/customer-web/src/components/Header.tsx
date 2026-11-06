import React, { useState } from 'react';
import { Search, ShoppingCart, X, Store, FileText, SlidersHorizontal, User, LogOut, Wallet, Gift, Milk, ChefHat, MapPin, ChevronDown, Bike } from 'lucide-react';
import { ScrollRail } from './ScrollRail';
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

  const secondaryAction = "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-3">Skip to products</a>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8">
        <button
          aria-label="FreshCart home"
          onClick={() => { onSelectCategory('ALL'); onSearchChange(''); onToggleBrowse('home'); }}
          className="flex min-h-11 shrink-0 items-center gap-2.5 text-left"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">FC</span>
          <span className="text-xl font-bold tracking-tight text-foreground">FreshCart</span>
        </button>
        <button onClick={onOpenAddressModal} className="order-4 flex min-h-11 w-full items-center gap-2 border-t border-border pt-2 text-left sm:order-none sm:w-auto sm:max-w-48 sm:border-0 sm:pt-0 sm:rounded-md sm:px-2 sm:hover:bg-surface-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-foreground">Deliver to <ChevronDown aria-hidden="true" className="inline size-3" /></span>
            <span className="block truncate text-xs text-muted-foreground">{selectedAddress ? `${selectedAddress.label ? selectedAddress.label + ': ' : ''}${selectedAddress.street}` : 'Select delivery address'}</span>
          </span>
        </button>
        <div className="relative order-3 w-full min-w-0 lg:order-none lg:flex-1">
          <label htmlFor="catalog-search" className="sr-only">Search products, brands, or categories</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="catalog-search" type="search" placeholder="Search products, brands, categories…" value={searchQuery}
            onChange={(e) => { onSearchChange(e.target.value); setShowDisambiguation(e.target.value.toLowerCase().trim() === 'soap'); }}
            onFocus={() => { if (isSoapSearch) setShowDisambiguation(true); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowDisambiguation(false); if (e.key === 'Enter') { onToggleBrowse('browse'); setShowDisambiguation(false); } }}
            aria-expanded={showDisambiguation} aria-controls={showDisambiguation ? 'search-categories' : undefined}
            className="h-11 w-full rounded-md border border-transparent bg-surface-muted pl-10 pr-10 text-sm placeholder:text-muted-foreground transition-colors hover:border-border focus:border-primary focus:bg-surface" />
          {searchQuery && <button aria-label="Clear search" onClick={() => { onSearchChange(''); setShowDisambiguation(false); }} className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground"><X className="size-4" /></button>}
          {showDisambiguation && (
            <div id="search-categories" className="absolute inset-x-0 top-full z-50 mt-2 rounded-lg border border-border bg-surface p-4 shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Which type of soap?</p><button aria-label="Close category suggestions" onClick={() => setShowDisambiguation(false)} className="flex size-11 items-center justify-center"><X className="size-4" /></button></div>
              <div className="flex flex-wrap gap-2">
                {[['BATH_SOAP', 'Bathing soaps'], ['WASH_SOAP', 'Washing bars'], ['UTENSIL_SOAP', 'Utensil bars']].map(([id, label]) => <button key={id} onClick={() => { onSelectCategory(id); setShowDisambiguation(false); onToggleBrowse('browse'); }} className="min-h-11 rounded-md border border-border px-3 text-sm hover:bg-primary-light">{label}</button>)}
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {userSession ? <>
            <button onClick={onOpenAddressModal} aria-label="Manage account and addresses" className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium"><User aria-hidden="true" className="size-4" /><span className="hidden max-w-24 truncate sm:inline">{userSession.user.fullName || 'My account'}</span></button>
            <button onClick={onSignOut} aria-label="Sign out" className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"><LogOut className="size-4" /></button>
          </> : <button onClick={onOpenAuth} className="min-h-11 rounded-md px-3 text-sm font-semibold hover:bg-surface-muted">Sign in</button>}
          <button onClick={onOpenCart} aria-label={`Open cart, ${cartCount} items, ₹${cartTotal.toFixed(2)}`} className="flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">
            <ShoppingCart aria-hidden="true" className="size-4" /><span>₹{cartTotal.toFixed(2)}</span>{cartCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{cartCount}</span>}
          </button>
        </div>
      </div>
      <nav aria-label="Store services" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollRail label="Store services">
          <button onClick={() => onToggleBrowse(isBrowseMode ? 'home' : 'browse')} aria-pressed={isBrowseMode} className={`${secondaryAction} ${isBrowseMode ? 'bg-primary-light text-primary' : ''}`}><SlidersHorizontal aria-hidden="true" className="size-4" />Browse products</button>
          <button onClick={onOpenOrders} className={secondaryAction}><FileText aria-hidden="true" className="size-4" />My orders</button>
          <button onClick={onOpenWallet} className={secondaryAction}><Wallet aria-hidden="true" className="size-4" />Wallet · ₹{(walletBalance || 0).toFixed(0)}</button>
          <button onClick={onOpenSubscriptions} className={secondaryAction}><Milk aria-hidden="true" className="size-4" />Subscriptions</button>
          <button onClick={onOpenRecipes} className={secondaryAction}><ChefHat aria-hidden="true" className="size-4" />Recipes</button>
          <button onClick={onOpenReferral} className={secondaryAction}><Gift aria-hidden="true" className="size-4" />Refer a friend</button>
          <a href="/delivery/login" className={secondaryAction}><Bike aria-hidden="true" className="size-4" />Delivery partner</a>
          <a href={((import.meta as any).env?.VITE_SELLER_HUB_URL || 'http://localhost:5174')} target="_blank" rel="noopener noreferrer" className={`${secondaryAction} lg:ml-auto`}><Store aria-hidden="true" className="size-4" />Seller hub</a>
          </ScrollRail>
        </div>
      </nav>
    </header>
  );
};
